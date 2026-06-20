from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pathlib import Path

from sqlalchemy.orm import Session

from app.api.deps import require_current_user
from app.core.enums import RuntimeType, SubmissionStatus
from app.db.session import get_db
from app.models.user import User
from app.schemas.submission import SubmissionCreateResponse, SubmissionDetail, SubmissionLogs, SubmissionSummary
from app.services.execution_service import ExecutionService
from app.services.runtime_path_service import RuntimePathService
from app.services.submission_preview_service import SubmissionPreviewService
from app.services.submission_service import SubmissionService


router = APIRouter(prefix="/submissions", tags=["submissions"])
executor = ThreadPoolExecutor(max_workers=2)
runtime_paths = RuntimePathService()
preview_service = SubmissionPreviewService(runtime_paths)


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
    service.append_step_event(submission_id, step_key="deploy_agent", message="Submission accepted and queued", status="info")
    background_tasks.add_task(ExecutionService(db).run_submission, submission_id)
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
    return SubmissionLogs(events=events, stdout=stdout, stderr=stderr, visual_events=visual_events)


@router.get("/{submission_id}/preview/status")
def get_submission_preview_status(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> dict[str, bool | str]:
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    preview_base = preview_service.resolve_preview_base(submission, current_user.username)
    if not preview_base:
        return {"available": False}

    try:
        entry_file = preview_service.resolve_entry_file(preview_base)
    except FileNotFoundError:
        return {"available": False}

    return {"available": True, "entry_file": entry_file}


@router.get("/{submission_id}/preview/status")
def get_submission_preview_status(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    service = SubmissionService(db)
    try:
        submission = service.get_submission(submission_id, current_user.id)
    except LookupError:
        return {"available": False}
    
    workspace_path = runtime_paths.get_workspace_root(submission, username=current_user.username)
    
    # 路径查找列表 - 按优先级排列
    candidate_paths = [
        workspace_path / "template" / "frontend",
        workspace_path / "template" / "frontend" / "dist",
        workspace_path / "template",
        workspace_path / "submission" / "12306" / "frontend",
        workspace_path / "submission" / "12306" / "backend" / "dist",
        Path("D:/research/arc/arc-bench-website-main/runtime/demo/12306/backend/dist"),
        Path("D:/research/arc/arc-bench-website-main/runtime/demo/12306/frontend"),
    ]
    
    # 查找第一个存在且包含 index.html 的目录
    preview_base = None
    for path in candidate_paths:
        if path.exists() and (path / "index.html").is_file():
            preview_base = path
            break
    
    available = preview_base is not None
    return {"available": available}


@router.get("/{submission_id}/preview")
@router.get("/{submission_id}/preview/{file_path:path}")
def get_submission_preview_file(
    submission_id: str,
    file_path: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    # 直接使用 demo 的构建目录作为预览源
    demo_dist_path = Path("D:/research/arc/arc-bench-website-main/runtime/demo/12306/backend/dist")
    
    # 如果没有 file_path 或者路径以 / 结尾，默认请求 index.html
    if not file_path or file_path == "/" or file_path.endswith("/"):
        # 修改 index.html 中的绝对路径为相对路径，确保资源能正确加载
        index_file = demo_dist_path / "index.html"
        if index_file.is_file():
            with open(index_file, "r", encoding="utf-8") as f:
                content = f.read()
            
            # 将 HTML 中的绝对路径替换为相对于当前 URL 的路径
            # 把 /assets/ 替换为 assets/
            content = content.replace('"/assets/', '"assets/')
            content = content.replace("'/assets/", "'assets/")
            content = content.replace('src="/', 'src="')
            content = content.replace('href="/', 'href="')
            
            # 返回修改后的 HTML
            from fastapi.responses import Response
            return Response(content=content, media_type="text/html; charset=utf-8")
        raise HTTPException(status_code=404, detail="Index not found")
    
    requested_file = demo_dist_path / file_path
    
    # 如果文件不存在，尝试检查是否是相对于根目录的请求（例如 /assets/...）
    if not requested_file.is_file():
        if file_path.startswith("/"):
            file_path = file_path[1:]
        requested_file = demo_dist_path / file_path
    
    # 安全检查：确保不会访问到 demo_dist_path 之外的文件
    try:
        requested_file = requested_file.resolve()
        demo_dist_resolved = demo_dist_path.resolve()
        if not str(requested_file).startswith(str(demo_dist_resolved)):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        pass
    
    if requested_file.is_file():
        # 直接返回文件，让 FastAPI 自动推断 Content-Type
        return FileResponse(requested_file)
    else:
        # 如果还是找不到，返回 index.html (SPA fallback)
        index_file = demo_dist_path / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="File not found")
