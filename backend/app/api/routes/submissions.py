from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import require_current_user
from app.core.enums import RuntimeType, SubmissionStatus
from app.db.session import get_db
from app.models.user import User
from app.schemas.submission import (
    SubmissionCommitHistoryPayload,
    SubmissionCreateResponse,
    SubmissionEditableTaskPayload,
    SubmissionDetail,
    SubmissionLogs,
    SubmissionPreviewStatus,
    SubmissionRewindPayload,
    SubmissionSourcePayload,
    SubmissionSummary,
    SubmissionTraceabilityPayload,
)
from app.services.execution_service import ExecutionService
from app.services.debug_log_service import DebugLogService
from app.services.host_demo_preview_service import HostDemoPreviewService
from app.services.runtime_path_service import RuntimePathService
from app.services.requirement_catalog import RequirementCatalogService
from app.services.submission_artifact_service import SubmissionArtifactService
from app.services.submission_event_stream import SubmissionEventStream
from app.services.submission_service import SubmissionService
from app.services.traceability_seed_builder import TraceabilitySeedBuilder


router = APIRouter(prefix="/submissions", tags=["submissions"])
executor = ThreadPoolExecutor(max_workers=2)
runtime_paths = RuntimePathService()
artifact_service = SubmissionArtifactService()


@router.get("", response_model=list[SubmissionSummary])
def list_submissions(
    requirement_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> list[SubmissionSummary]:
    return SubmissionService(db).list_submissions(current_user.id, requirement_id=requirement_id)


@router.post("", response_model=SubmissionCreateResponse)
def create_submission(
    requirement_id: str = Form(...),
    runtime: RuntimeType = Form(...),
    catalog: str = Form(default="playground"),
    display_name: str | None = Form(None),
    model_name: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionCreateResponse:
    try:
        submission = SubmissionService(db).create_submission(
            requirement_id,
            runtime,
            file,
            user_id=current_user.id,
            catalog=catalog,
            display_name=display_name,
            model_name=model_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return SubmissionCreateResponse(submission=SubmissionSummary.model_validate(submission, from_attributes=True))


@router.post("/{submission_id}/start", response_model=SubmissionDetail)
def start_submission(
    submission_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionDetail:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if submission.status != SubmissionStatus.PENDING.value:
        raise HTTPException(status_code=409, detail="Submission is already running or completed")
    HostDemoPreviewService.stop_backend()
    service.append_step_event(submission_id, step_key="deploy_agent", message="Submission accepted and queued", status="info")
    background_tasks.add_task(ExecutionService(db).run_submission, submission_id)
    return service.to_detail(submission)


@router.post("/{submission_id}/pause", response_model=SubmissionDetail)
def pause_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionDetail:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not service.can_pause(submission):
        raise HTTPException(status_code=409, detail="Submission is not running")
    try:
        service.request_pause(submission)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return service.to_detail(submission)


@router.post("/{submission_id}/resume", response_model=SubmissionDetail)
def resume_submission(
    submission_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionDetail:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not service.can_resume(submission):
        raise HTTPException(status_code=409, detail="Submission is not paused")
    try:
        service.clear_runtime_request_files(submission)
        service.set_checkpoint_restart_flag(submission)
        service.update_status(submission, SubmissionStatus.RUNNING)
        service.update_steps(
            submission,
            service.build_step_states(
                active_key="deploy_agent",
                description="Restarting runner from checkpoint",
            ),
        )
        HostDemoPreviewService.stop_backend()
        background_tasks.add_task(ExecutionService(db).rerun_submission, submission_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return service.to_detail(submission)


@router.post("/{submission_id}/rewind", response_model=SubmissionDetail)
def rewind_submission(
    submission_id: str,
    payload: SubmissionRewindPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionDetail:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not service.can_rewind(submission):
        raise HTTPException(status_code=409, detail="Submission must be paused or completed before rewinding")
    try:
        service.rewind_to_commit(submission, payload.commit_oid)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return service.to_detail(submission)


@router.get("/{submission_id}", response_model=SubmissionDetail)
def get_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionDetail:
    service = SubmissionService(db)
    try:
        return service.to_detail(service.get_submission(submission_id, current_user.id))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{submission_id}/logs", response_model=SubmissionLogs)
def get_submission_logs(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionLogs:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    events = ""
    stdout = ""
    stderr = ""
    event_log_path = service.get_event_log_path(submission)
    if event_log_path.exists():
        events = "\n".join(service.read_event_lines(submission))
    stdout_path = runtime_paths.resolve_existing_path(submission.stdout_path)
    stderr_path = runtime_paths.resolve_existing_path(submission.stderr_path)
    if stdout_path:
        with stdout_path.open("r", encoding="utf-8") as stdout_file:
            stdout = stdout_file.read()
    if stderr_path:
        with stderr_path.open("r", encoding="utf-8") as stderr_file:
            stderr = stderr_file.read()
    visual_events = service.read_visual_events(submission)
    runner_events = service.read_runner_events(submission)
    return SubmissionLogs(events=events, stdout=stdout, stderr=stderr, visual_events=visual_events, runner_events=runner_events)


@router.get("/{submission_id}/events")
async def stream_submission_events(
    submission_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> StreamingResponse:
    service = SubmissionService(db)
    try:
        service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    async def event_generator():
        event_queue = SubmissionEventStream.subscribe(submission_id)
        try:
            yield ": connected\n\n"
            for event in SubmissionEventStream.snapshot(submission_id):
                yield SubmissionEventStream.encode_sse(event)
            while True:
                if await request.is_disconnected():
                    break
                event = await asyncio.to_thread(event_queue.get)
                if event is None:
                    break
                yield SubmissionEventStream.encode_sse(event)
        finally:
            SubmissionEventStream.unsubscribe(submission_id, event_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{submission_id}/editable-task", response_model=SubmissionEditableTaskPayload)
def get_submission_editable_task(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionEditableTaskPayload:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    payload = service.read_submission_task_documents(submission)
    return SubmissionEditableTaskPayload(**{
        "requirements_md": payload["requirements_md"],
        "requirements_yaml": payload["requirements_yaml"],
        "prerequisites_md": payload["prerequisites_md"],
    })


@router.post("/{submission_id}/editable-task")
def update_submission_editable_task(
    submission_id: str,
    payload: SubmissionEditableTaskPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> dict[str, str]:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    try:
        service.write_submission_task_documents(
            submission,
            requirements_md=payload.requirements_md,
            requirements_yaml=payload.requirements_yaml,
            prerequisites_md=payload.prerequisites_md,
        )
        service.write_submission_traceability_store(submission, payload.requirements_yaml)
        if payload.edited_node_id and payload.edited_node_id.strip():
            service.reset_progress_for_edited_node(submission, payload.edited_node_id)
        SubmissionEventStream.publish(submission.id, "requirement_state", reason="task_updated")
        SubmissionEventStream.publish(submission.id, "traceability_db", reason="task_updated")
        SubmissionEventStream.publish(submission.id, "commit_history", reason="task_updated")
        HostDemoPreviewService.mark_stale(submission.id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"detail": "Submission workspace updated"}


@router.get("/{submission_id}/task-assets/{asset_kind}/{asset_path:path}")
def get_submission_task_asset(
    submission_id: str,
    asset_kind: str,
    asset_path: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> FileResponse:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
        return FileResponse(service.get_submission_task_asset_path(submission, asset_kind, asset_path))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{submission_id}/traceability", response_model=SubmissionTraceabilityPayload)
def get_submission_traceability(
    submission_id: str,
    node_id: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionTraceabilityPayload:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    payload = artifact_service.read_traceability(submission, node_id=node_id)
    return SubmissionTraceabilityPayload(**payload)


@router.get("/{submission_id}/commit-history", response_model=SubmissionCommitHistoryPayload)
def get_submission_commit_history(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionCommitHistoryPayload:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    payload = artifact_service.read_commit_history(submission)
    return SubmissionCommitHistoryPayload(**payload)


@router.get("/{submission_id}/source", response_model=SubmissionSourcePayload)
def get_submission_source(
    submission_id: str,
    file_path: str = "",
    first_line: int | None = None,
    kind: str = "file",
    commit_oid: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionSourcePayload:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    try:
        payload = artifact_service.read_source(
            submission,
            file_path=file_path,
            first_line=first_line,
            kind=kind,
            commit_oid=commit_oid,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return SubmissionSourcePayload(**payload)


@router.get("/{submission_id}/preview/status", response_model=SubmissionPreviewStatus)
def get_submission_preview_status(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionPreviewStatus:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    template_path = runtime_paths.resolve_existing_path(submission.workspace_path)
    debug_log = DebugLogService(template_path) if template_path is not None else None
    workspace_head_oid = None
    error = None
    if template_path is None:
        error = "Submission workspace is not available"
    else:
        project_root = Path(template_path) / "template"
        if not project_root.is_dir():
            error = f"Preview workspace is not available: {project_root}"
        elif not (project_root / ".git").exists():
            error = "Git history is not available for this submission preview"
        else:
            try:
                workspace_head_oid = service._run_git(project_root, ["rev-parse", "HEAD"]).strip()  # noqa: SLF001
            except RuntimeError as exc:
                error = str(exc)
    payload = HostDemoPreviewService.get_status(
            submission_id=submission.id,
            workspace_head_oid=workspace_head_oid,
            error=error,
        )
    if debug_log is not None:
        debug_log.append(
            "preview",
            "HTTP status requested: "
            f"available={payload.get('available')} "
            f"stale={payload.get('stale')} "
            f"workspace_head_oid={payload.get('workspace_head_oid')} "
            f"preview_head_oid={payload.get('preview_head_oid')} "
            f"error={payload.get('error')}",
        )
    return SubmissionPreviewStatus(**payload)


@router.post("/{submission_id}/preview/refresh", response_model=SubmissionPreviewStatus)
def refresh_submission_preview(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> SubmissionPreviewStatus:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    workspace_path = runtime_paths.resolve_existing_path(submission.workspace_path)
    if workspace_path is None:
        return SubmissionPreviewStatus(
            available=False,
            stale=False,
            workspace_head_oid=None,
            preview_head_oid=None,
            error="Submission workspace is not available",
        )
    debug_log = DebugLogService(workspace_path)
    debug_log.append("preview", f"HTTP refresh requested for submission {submission.id}")
    template_path = workspace_path / "template"
    if not template_path.is_dir():
        debug_log.append("preview", f"Refresh rejected: preview workspace is not available: {template_path}")
        return SubmissionPreviewStatus(
            available=False,
            stale=False,
            workspace_head_oid=None,
            preview_head_oid=None,
            error=f"Preview workspace is not available: {template_path}",
        )
    try:
        workspace_head_oid = service._run_git(template_path, ["rev-parse", "HEAD"]).strip()  # noqa: SLF001
    except RuntimeError as exc:
        debug_log.append("preview", f"Refresh rejected: failed to resolve workspace HEAD: {exc}")
        return SubmissionPreviewStatus(
            available=False,
            stale=False,
            workspace_head_oid=None,
            preview_head_oid=None,
            error=str(exc),
        )
    response_payload = HostDemoPreviewService.refresh(
            submission_id=submission.id,
            source_template_dir=template_path,
            workspace_head_oid=workspace_head_oid,
            debug_log=debug_log,
        )
    debug_log.append(
        "preview",
        "HTTP refresh finished: "
        f"available={response_payload.get('available')} "
        f"stale={response_payload.get('stale')} "
        f"workspace_head_oid={response_payload.get('workspace_head_oid')} "
        f"preview_head_oid={response_payload.get('preview_head_oid')} "
        f"error={response_payload.get('error')}",
    )
    return SubmissionPreviewStatus(**response_payload)

@router.get("/{submission_id}/preview")
@router.get("/{submission_id}/preview/{file_path:path}")
def get_submission_preview_file(
    submission_id: str,
    file_path: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    try:
        SubmissionService(db).get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    raise HTTPException(
        status_code=410,
        detail="Submission-scoped preview proxy is disabled. Use the fixed host preview at http://1.95.169.80:3001/.",
    )
