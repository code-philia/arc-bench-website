from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import require_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user_task import UserTaskCreateRequest, UserTaskDetail, UserTaskSummary
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
