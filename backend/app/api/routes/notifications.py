from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import NotificationItem, NotificationList
from app.services.notification_service import NotificationService


router = APIRouter(prefix="/notifications", tags=["notifications"])


def _notification_list(service: NotificationService, user_id: str) -> NotificationList:
    items, unread_count = service.list_for_user(user_id)
    return NotificationList(items=[NotificationItem.model_validate(item, from_attributes=True) for item in items], unread_count=unread_count)


@router.get("", response_model=NotificationList)
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> NotificationList:
    return _notification_list(NotificationService(db), current_user.id)


@router.post("/read-all", response_model=NotificationList)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> NotificationList:
    service = NotificationService(db)
    service.mark_all_read(current_user.id)
    return _notification_list(service, current_user.id)


@router.delete("/clear", response_model=NotificationList)
def clear_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> NotificationList:
    service = NotificationService(db)
    service.delete_all(current_user.id)
    return _notification_list(service, current_user.id)


@router.post("/{notification_id}/read", response_model=NotificationItem)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> NotificationItem:
    try:
        notification = NotificationService(db).mark_read(notification_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return NotificationItem.model_validate(notification, from_attributes=True)


@router.delete("/{notification_id}", response_model=NotificationList)
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> NotificationList:
    service = NotificationService(db)
    try:
        service.delete(notification_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _notification_list(service, current_user.id)
