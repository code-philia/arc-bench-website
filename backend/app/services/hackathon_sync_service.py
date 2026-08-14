from __future__ import annotations

import re
import secrets
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.competition_account import CompetitionAccessGrant, ExternalIdentity, IntegrationEvent, Team, TeamMembership
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.competition_access_service import CompetitionAccessService


class HackathonSyncService:
    PROVIDER = "supabase_hackathon"

    def __init__(self, db: Session):
        self.db = db

    def process_event(self, event_id: str, event_type: str, data: dict[str, Any]) -> User | None:
        if self.db.get(IntegrationEvent, event_id):
            return None
        if event_type == "profile.upsert":
            user = self._upsert_profile(data)
        elif event_type == "team.upsert":
            self._upsert_team(data)
            user = None
        elif event_type == "team.delete":
            self._archive_team(data)
            user = None
        elif event_type == "team.membership.sync":
            self._sync_membership(data)
            user = None
        else:
            raise ValueError(f"Unsupported Hackathon event type '{event_type}'")
        self.db.add(IntegrationEvent(id=event_id, provider=self.PROVIDER, event_type=event_type))
        self.db.commit()
        if user is not None:
            self.db.refresh(user)
        return user

    def exchange_access_token(self, access_token: str, *, issuer: str, audience: str) -> User:
        try:
            import jwt
        except ImportError as exc:  # pragma: no cover - dependency is declared for deployments
            raise RuntimeError("PyJWT is required to verify Hackathon access tokens") from exc
        try:
            key_client = jwt.PyJWKClient(f"{issuer.rstrip('/')}/.well-known/jwks.json")
            key = key_client.get_signing_key_from_jwt(access_token).key
            claims = jwt.decode(access_token, key, algorithms=["RS256", "ES256"], audience=audience, issuer=issuer)
        except Exception as exc:  # noqa: BLE001 - library exposes several JWT verification errors
            raise ValueError("Hackathon access token could not be verified") from exc
        if not claims.get("email_confirmed_at"):
            raise PermissionError("Confirm your Hackathon email before opening ARC-Bench")
        return self.process_event(
            event_id=f"token:{claims.get('sub')}:{claims.get('iat')}",
            event_type="profile.upsert",
            data={
                "id": claims.get("sub"),
                "email": claims.get("email"),
                "email_confirmed_at": claims.get("email_confirmed_at"),
                **(claims.get("user_metadata") or {}),
            },
        ) or self._user_for_subject(str(claims.get("sub") or ""))

    def _upsert_profile(self, data: dict[str, Any]) -> User:
        subject = str(data.get("id") or data.get("subject") or "").strip()
        email = str(data.get("email") or "").strip().lower()
        if not subject or "@" not in email:
            raise ValueError("Hackathon profile events require a Supabase user id and email")
        identity = self.db.scalar(
            select(ExternalIdentity).where(
                ExternalIdentity.provider == self.PROVIDER,
                ExternalIdentity.provider_subject == subject,
            )
        )
        user = self.db.get(User, identity.user_id) if identity else self.db.scalar(select(User).where(User.email == email))
        if user is None:
            username = self._username_for(data, email)
            user = User(
                id=secrets.token_hex(16),
                email=email,
                username=username,
                password_hash=AuthService._hash_password(secrets.token_urlsafe(32)),
                registration_source="hackathon",
            )
            self.db.add(user)
            self.db.flush()
        elif user.registration_source != "beta":
            # Confirmed Hackathon registration is authoritative for a directly
            # matched email; no separate account-linking UI is required.
            user.registration_source = "hackathon"
        user.email = email
        user.display_name = self._optional_text(data.get("name")) or user.display_name or user.username
        user.avatar_url = self._optional_text(data.get("avatar")) or user.avatar_url
        github_id = self._optional_text(data.get("github_id"))
        if github_id:
            user.github_username = github_id.removeprefix("https://github.com/").lstrip("@")
        if identity is None:
            identity = ExternalIdentity(user_id=user.id, provider=self.PROVIDER, provider_subject=subject, source_email=email)
            self.db.add(identity)
        else:
            identity.source_email = email
            identity.last_synced_at = datetime.utcnow()
        if data.get("email_confirmed_at") or data.get("email_confirmed") is True:
            CompetitionAccessService(self.db).grant(
                user_id=user.id,
                competition_id=CompetitionAccessService.HACKATHON_ID,
                granted_by="hackathon_email_confirmed",
            )
        return user

    def _upsert_team(self, data: dict[str, Any]) -> Team:
        source_team_id = str(data.get("id") or data.get("team_id") or "").strip()
        leader_subject = str(data.get("leader_id") or data.get("leader_subject") or "").strip()
        name = self._optional_text(data.get("name"))
        if not source_team_id or not leader_subject or not name:
            raise ValueError("Hackathon team events require id, name, and leader_id")
        leader = self._user_for_subject(leader_subject)
        if leader is None:
            raise LookupError("The Hackathon team leader has not been synced yet")
        team = self.db.scalar(
            select(Team).where(Team.source_provider == self.PROVIDER, Team.source_team_id == source_team_id)
        )
        if team is None:
            team = Team(name=name, leader_user_id=leader.id, source_provider=self.PROVIDER, source_team_id=source_team_id)
            self.db.add(team)
            self.db.flush()
        else:
            if not team.is_active:
                # Source team IDs are immutable UUIDs. Once a source team has
                # been deleted, a delayed earlier upsert must not resurrect it.
                return team
            team.name = name
            team.leader_user_id = leader.id
        team.github_repo = self._optional_text(data.get("github_repo"))
        team.model_name = self._optional_text(data.get("model"))
        team.harness = self._optional_text(data.get("harness"))
        return team

    def _archive_team(self, data: dict[str, Any]) -> None:
        source_team_id = str(data.get("id") or data.get("team_id") or "").strip()
        if not source_team_id:
            raise ValueError("Hackathon team deletion events require id")
        team = self.db.scalar(
            select(Team).where(Team.source_provider == self.PROVIDER, Team.source_team_id == source_team_id)
        )
        if team is None:
            return
        team.is_active = False
        for membership in self.db.scalars(select(TeamMembership).where(TeamMembership.team_id == team.id)).all():
            self.db.delete(membership)

    def _sync_membership(self, data: dict[str, Any]) -> None:
        source_team_id = str(data.get("team_id") or "").strip()
        subject = str(data.get("user_id") or data.get("subject") or "").strip()
        active = data.get("active", True) is not False
        if not source_team_id or not subject:
            raise ValueError("Hackathon membership events require team_id and user_id")
        team = self.db.scalar(
            select(Team).where(Team.source_provider == self.PROVIDER, Team.source_team_id == source_team_id)
        )
        user = self._user_for_subject(subject)
        if team is None or user is None:
            raise LookupError("The Hackathon team or member has not been synced yet")
        if not team.is_active:
            # Ignore delayed member-add events that predate a team deletion.
            return
        membership = self.db.scalar(select(TeamMembership).where(TeamMembership.user_id == user.id))
        if not active:
            if membership and membership.team_id == team.id:
                self.db.delete(membership)
            return
        if membership and membership.team_id != team.id:
            self.db.delete(membership)
            self.db.flush()
            membership = None
        role = "leader" if data.get("role") == "leader" or team.leader_user_id == user.id else "member"
        if membership is None:
            self.db.add(TeamMembership(team_id=team.id, user_id=user.id, role=role))
        else:
            membership.role = role

    def _user_for_subject(self, subject: str) -> User | None:
        identity = self.db.scalar(
            select(ExternalIdentity).where(
                ExternalIdentity.provider == self.PROVIDER,
                ExternalIdentity.provider_subject == subject,
            )
        )
        return self.db.get(User, identity.user_id) if identity else None

    def _username_for(self, data: dict[str, Any], email: str) -> str:
        candidates = [self._optional_text(data.get("github_id")), self._optional_text(data.get("name")), email.split("@", 1)[0]]
        for candidate in candidates:
            base = re.sub(r"[^A-Za-z0-9_-]", "", (candidate or "").replace(" ", ""))[:24]
            if len(base) < 3:
                continue
            username = base
            suffix = 1
            while self.db.scalar(select(User.id).where(User.username == username)):
                suffix += 1
                username = f"{base[: 32 - len(str(suffix)) - 1]}-{suffix}"
            return username
        return f"hackathon-{secrets.token_hex(5)}"

    @staticmethod
    def _optional_text(value: Any) -> str | None:
        text = str(value or "").strip()
        return text or None
