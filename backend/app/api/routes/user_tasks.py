from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse, Response
from sqlalchemy.orm import Session

from app.api.deps import require_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.agent_starter_service import AgentStarterService
from app.schemas.user_task import (
    UserTaskCreateRequest,
    UserTaskDetail,
    UserTaskDraftResponse,
    UserTaskDraftSaveRequest,
    UserTaskSummary,
    UserTaskUpdateRequest,
)
from app.services.user_task_service import UserTaskService


router = APIRouter(prefix="/my-tasks", tags=["my-tasks"])


@router.get("", response_model=list[UserTaskSummary])
def list_my_tasks(current_user: User = Depends(require_current_user), db: Session = Depends(get_db)) -> list[UserTaskSummary]:
    return UserTaskService(db).list_user_tasks(current_user)


@router.post("", response_model=UserTaskDetail)
def create_my_task(
    payload: UserTaskCreateRequest,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> UserTaskDetail:
    return UserTaskService(db).create_user_task(current_user, payload)


@router.put("/{task_id}", response_model=UserTaskDetail)
def update_my_task(
    task_id: str,
    payload: UserTaskUpdateRequest,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> UserTaskDetail:
    try:
        return UserTaskService(db).update_user_task(current_user, task_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/drafts", response_model=UserTaskDraftResponse)
def create_my_task_draft(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> UserTaskDraftResponse:
    return UserTaskService(db).create_draft(current_user)


@router.put("/drafts/{draft_id}", response_model=UserTaskDraftResponse)
def save_my_task_draft(
    draft_id: str,
    payload: UserTaskDraftSaveRequest,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> UserTaskDraftResponse:
    return UserTaskService(db).save_draft(current_user, draft_id, payload)


@router.post("/drafts/{draft_id}/reference")
async def upload_my_task_draft_reference(
    draft_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded image filename is required")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")
    try:
        stored_filename = UserTaskService(db).save_draft_reference(current_user, draft_id, file.filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "filename": stored_filename,
        "relative_path": f"reference/{stored_filename}",
        "url": f"/api/my-tasks/drafts/{draft_id}/reference/{stored_filename}",
    }


@router.post("/{task_id}/reference")
async def upload_my_task_reference(
    task_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded image filename is required")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")
    try:
        stored_filename = UserTaskService(db).save_task_reference(current_user, task_id, file.filename, content)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "filename": stored_filename,
        "relative_path": f"reference/{stored_filename}",
        "url": f"/api/my-tasks/{task_id}/reference/{stored_filename}",
    }


@router.get("/{task_id}", response_model=UserTaskDetail)
def get_my_task(
    task_id: str,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> UserTaskDetail:
    try:
        return UserTaskService(db).get_user_task_detail(current_user, task_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/drafts/{draft_id}/reference/{asset_path:path}")
def get_my_task_draft_reference(
    draft_id: str,
    asset_path: str,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    try:
        path = UserTaskService(db).get_draft_reference_path(current_user, draft_id, asset_path)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(path)


@router.get("/drafts/{draft_id}/bundle")
def download_my_task_draft_bundle(
    draft_id: str,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        content, filename = UserTaskService(db).build_draft_bundle(current_user, draft_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{task_id}/bundle")
def download_my_task_bundle(
    task_id: str,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        content, filename = UserTaskService(db).build_task_bundle(current_user, task_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{task_id}/starter-agent")
def download_my_task_starter_agent(
    task_id: str,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        task = UserTaskService(db)._get_owned_task(current_user, task_id)  # noqa: SLF001
        content, filename = AgentStarterService().build_bundle(task_type=task.task_type)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (FileNotFoundError, RuntimeError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/{task_id}/document")
def download_my_task_document(
    task_id: str,
    kind: str = Query(pattern="^(yaml|markdown)$"),
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    try:
        content, filename = UserTaskService(db).get_document(current_user, task_id, kind)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return PlainTextResponse(content, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/{task_id}/reference/{asset_path:path}")
def get_my_task_reference_asset(
    task_id: str,
    asset_path: str,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    service = UserTaskService(db)
    try:
        task = service._get_owned_task(current_user, task_id)  # noqa: SLF001
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    reference_root = (Path(task.yaml_path).parent / "reference").resolve()
    target = (reference_root / asset_path).resolve()
    try:
        target.relative_to(reference_root)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Reference image path is invalid") from exc
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Reference image not found")
    return FileResponse(target)
