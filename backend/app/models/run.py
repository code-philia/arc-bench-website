from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Run(Base):
    """One execution of an agent Submission against a concrete task."""

    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # No foreign key by design: deleting a competition submission must retain
    # the historical runs that were created from it.
    submission_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    submission_display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Copied from the source snapshot so an historical run remains fully
    # navigable even after that reusable submission is deleted.
    catalog: Mapped[str] = mapped_column(String(32), nullable=False, default="playground", index=True)
    competition_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    competition_entry_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    competition_owner_display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    requirement_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    runtime: Mapped[str] = mapped_column(String(32), nullable=False)
    agent_source: Mapped[str] = mapped_column(String(64), nullable=False, default="upload", index=True)
    agent_archive_path: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    test_pass_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    passed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    run_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    feature_implemented_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    feature_total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    feature_implementation_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    workspace_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    stdout_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    stderr_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    result_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
