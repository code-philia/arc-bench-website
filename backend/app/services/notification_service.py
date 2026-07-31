from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.models.notification import Notification


class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    def create_once(self, *, user_id: str | None, submission_id: str, kind: str, title: str, body: str) -> None:
        if not user_id:
            return
        existing = self.db.scalar(
            select(Notification.id).where(
                Notification.user_id == user_id,
                Notification.submission_id == submission_id,
                Notification.kind == kind,
            )
        )
        if existing:
            return
        self.db.add(Notification(user_id=user_id, submission_id=submission_id, kind=kind, title=title, body=body))
        self.db.commit()

    def list_for_user(self, user_id: str) -> tuple[list[Notification], int]:
        items = self.db.scalars(
            select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc()).limit(100)
        ).all()
        unread_count = int(self.db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user_id, Notification.is_read.is_(False))) or 0)
        return items, unread_count

    def mark_read(self, notification_id: str, user_id: str) -> Notification:
        notification = self.db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id))
        if notification is None:
            raise LookupError("Notification not found")
        notification.is_read = True
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def mark_all_read(self, user_id: str) -> int:
        result = self.db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True)
        )
        self.db.commit()
        return int(result.rowcount or 0)

    def delete(self, notification_id: str, user_id: str) -> None:
        notification = self.db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id))
        if notification is None:
            raise LookupError("Notification not found")
        self.db.delete(notification)
        self.db.commit()

    def delete_all(self, user_id: str) -> int:
        result = self.db.execute(delete(Notification).where(Notification.user_id == user_id))
        self.db.commit()
        return int(result.rowcount or 0)
