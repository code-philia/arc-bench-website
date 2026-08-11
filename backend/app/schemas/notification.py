from datetime import datetime

from pydantic import BaseModel


class NotificationItem(BaseModel):
    id: str
    run_id: str | None
    kind: str
    title: str
    body: str
    is_read: bool
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationItem]
    unread_count: int
