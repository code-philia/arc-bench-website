from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.competition_account import CompetitionAccessGrant
from app.models.user import User


class CompetitionAccessService:
    """Single server-side policy for competition visibility and participation."""

    HACKATHON_ID = "hackathon"
    GLOBAL_GRANT = "*"

    def __init__(self, db: Session):
        self.db = db

    def can_access(self, user: User | None, competition_id: str) -> bool:
        normalized_id = competition_id.strip().lower()
        if not normalized_id:
            return False
        if user is None:
            return normalized_id != self.HACKATHON_ID
        grant_ids = set(
            self.db.scalars(
                select(CompetitionAccessGrant.competition_id).where(CompetitionAccessGrant.user_id == user.id)
            ).all()
        )
        if normalized_id == self.GLOBAL_GRANT:
            return self.GLOBAL_GRANT in grant_ids
        if self.GLOBAL_GRANT in grant_ids or normalized_id in grant_ids:
            return True
        if user.registration_source == "hackathon":
            # A source profile may arrive before Supabase confirms its email.
            # Hackathon access is therefore grant-based, not merely based on
            # the profile's registration source.
            return False
        return normalized_id != self.HACKATHON_ID

    def require_access(self, user: User | None, competition_id: str) -> None:
        if user is None and competition_id.strip().lower() == self.HACKATHON_ID:
            raise PermissionError("Sign in with a Hackathon account to access this competition")
        if not self.can_access(user, competition_id):
            raise PermissionError("Your account is not eligible for this competition")

    def grant(self, *, user_id: str, competition_id: str, granted_by: str) -> CompetitionAccessGrant:
        normalized_id = competition_id.strip().lower()
        existing = self.db.scalar(
            select(CompetitionAccessGrant).where(
                CompetitionAccessGrant.user_id == user_id,
                CompetitionAccessGrant.competition_id == normalized_id,
            )
        )
        if existing:
            return existing
        grant = CompetitionAccessGrant(user_id=user_id, competition_id=normalized_id, granted_by=granted_by)
        self.db.add(grant)
        return grant
