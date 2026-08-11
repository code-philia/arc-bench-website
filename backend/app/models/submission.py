from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Submission(Base):
    """An immutable user-uploaded agent snapshot.

    A submission never represents evaluation state.  Each execution is stored
    separately as a ``Run`` and references this snapshot.
    """

    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    catalog: Mapped[str] = mapped_column(String(32), nullable=False, default="playground", index=True)
    competition_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # Playground snapshots are scoped to a task.  Competition snapshots use
    # competition_id; a legacy sentinel can remain in the physical column.
    requirement_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    runtime: Mapped[str] = mapped_column(String(32), nullable=False)
    agent_source: Mapped[str] = mapped_column(String(64), nullable=False, default="upload", index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    archive_path: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
