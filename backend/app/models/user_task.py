from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class UserTask(Base):
    __tablename__ = "user_tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    task_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    root_requirement_id: Mapped[str] = mapped_column(String(64), nullable=False, default="ROOT")
    node_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    atomic_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    yaml_path: Mapped[str] = mapped_column(String(512), nullable=False)
    markdown_path: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
