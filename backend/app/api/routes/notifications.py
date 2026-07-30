from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import NotificationItem, NotificationList
from app.services.notification_service import NotificationService


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationList)
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> NotificationList:
    items, unread_count = NotificationService(db).list_for_user(current_user.id)
    return NotificationList(items=[NotificationItem.model_validate(item, from_attributes=True) for item in items], unread_count=unread_count)


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
