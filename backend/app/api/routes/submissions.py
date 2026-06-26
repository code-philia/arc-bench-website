from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pathlib import Path
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
    SubmissionRewindPayload,
    SubmissionSourcePayload,
    SubmissionSummary,
    SubmissionTraceabilityPayload,
)
from app.services.execution_service import ExecutionService
from app.services.host_demo_preview_service import HostDemoPreviewService
from app.services.runtime_path_service import RuntimePathService
from app.services.requirement_catalog import RequirementCatalogService
from app.services.submission_artifact_service import SubmissionArtifactService
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
    HostDemoPreviewService.start_async()
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
        HostDemoPreviewService.start_async()
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
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"detail": "Submission workspace updated"}


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


@router.get("/{submission_id}/preview/status")
def get_submission_preview_status(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> dict[str, bool | str]:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError:
        return {"available": False}

    available = HostDemoPreviewService.ensure_ready()
    if not available:
        return {"available": False}
    return {"available": True, "entry_file": f"/api/submissions/{submission_id}/preview/"}


@router.get("/{submission_id}/preview")
@router.get("/{submission_id}/preview/{file_path:path}")
def get_submission_preview_file(
    submission_id: str,
    file_path: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    if not HostDemoPreviewService.ensure_ready():
        raise HTTPException(status_code=503, detail="Host demo preview is not ready")

    demo_dist_path = HostDemoPreviewService.BACKEND_DIR / "dist"

    if not file_path or file_path == "/" or file_path.endswith("/"):
        index_file = demo_dist_path / "index.html"
        if index_file.is_file():
            with open(index_file, "r", encoding="utf-8") as file:
                content = file.read()

            content = content.replace('"/assets/', '"assets/')
            content = content.replace("'/assets/", "'assets/")
            content = content.replace('src="/', 'src="')
            content = content.replace('href="/', 'href="')

            from fastapi.responses import Response

            return Response(content=content, media_type="text/html; charset=utf-8")
        raise HTTPException(status_code=404, detail="Index not found")

    requested_file = demo_dist_path / file_path
    if not requested_file.is_file():
        if file_path.startswith("/"):
            file_path = file_path[1:]
        requested_file = demo_dist_path / file_path

    try:
        requested_file = requested_file.resolve()
        demo_dist_resolved = demo_dist_path.resolve()
        if not str(requested_file).startswith(str(demo_dist_resolved)):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        pass

    if requested_file.is_file():
        return FileResponse(requested_file)

    index_file = demo_dist_path / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="File not found")
