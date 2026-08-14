"""Account integration, access control, and competition-entry models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _id() -> str:
    return uuid.uuid4().hex


class ExternalIdentity(Base):
    __tablename__ = "external_identities"
    __table_args__ = (UniqueConstraint("provider", "provider_subject", name="uq_external_identity_provider_subject"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_subject: Mapped[str] = mapped_column(String(128), nullable=False)
    source_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class CompetitionAccessGrant(Base):
    __tablename__ = "competition_access_grants"
    __table_args__ = (UniqueConstraint("user_id", "competition_id", name="uq_competition_access_grant"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # "*" is the global beta grant. All other values are normalized competition IDs.
    competition_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    granted_by: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class BetaInviteCode(Base):
    __tablename__ = "beta_invite_codes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    redeemed_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (UniqueConstraint("source_provider", "source_team_id", name="uq_team_external_source"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    leader_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    source_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_team_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    github_repo: Mapped[str | None] = mapped_column(String(512), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    harness: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class TeamMembership(Base):
    __tablename__ = "team_memberships"
    __table_args__ = (UniqueConstraint("user_id", name="uq_team_membership_user"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="member")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class TeamJoinRequest(Base):
    __tablename__ = "team_join_requests"
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_join_request"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class CompetitionEntry(Base):
    __tablename__ = "competition_entries"
    __table_args__ = (
        CheckConstraint(
            "(owner_kind = 'team' AND team_id IS NOT NULL AND user_id IS NULL) OR "
            "(owner_kind = 'user' AND user_id IS NOT NULL AND team_id IS NULL)",
            name="ck_competition_entry_exactly_one_owner",
        ),
        UniqueConstraint("competition_id", "team_id", name="uq_competition_entry_team"),
        UniqueConstraint("competition_id", "user_id", name="uq_competition_entry_user"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    competition_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    owner_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class IntegrationEvent(Base):
    __tablename__ = "integration_events"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
