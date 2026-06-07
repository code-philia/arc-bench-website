from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_current_user
from app.core.enums import RuntimeType, SubmissionStatus
from app.db.session import get_db
from app.models.user import User
from app.schemas.submission import SubmissionCreateResponse, SubmissionDetail, SubmissionLogs, SubmissionSummary
from app.services.execution_service import ExecutionService
from app.services.runtime_path_service import RuntimePathService
from app.services.submission_service import SubmissionService


router = APIRouter(prefix="/submissions", tags=["submissions"])
executor = ThreadPoolExecutor(max_workers=2)
runtime_paths = RuntimePathService()


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
    return SubmissionLogs(events=events, stdout=stdout, stderr=stderr)
