from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.competition_account import ExternalIdentity, Team, TeamJoinRequest, TeamMembership
from app.models.notification import Notification
from app.models.user import User


class TeamService:
    def __init__(self, db: Session):
        self.db = db

    def get_my_team_payload(self, user_id: str) -> dict:
        source_managed = self._is_source_managed_user(user_id)
        membership = self._membership_for_user(user_id)
        pending = self.db.scalar(
            select(TeamJoinRequest)
            .where(TeamJoinRequest.user_id == user_id, TeamJoinRequest.status == "PENDING")
            .order_by(TeamJoinRequest.created_at.desc())
            .limit(1)
        )
        if membership is None:
            return {
                "team": None,
                "members": [],
                "incoming_requests": [],
                "pending_request": self._request_summary(pending) if pending else None,
                "source_managed": source_managed,
            }
        team = self.db.get(Team, membership.team_id)
        if team is None:
            return {"team": None, "members": [], "incoming_requests": [], "pending_request": None, "source_managed": source_managed}
        members = self.db.scalars(
            select(TeamMembership).where(TeamMembership.team_id == team.id).order_by(TeamMembership.created_at)
        ).all()
        requests: list[TeamJoinRequest] = []
        if team.leader_user_id == user_id:
            requests = self.db.scalars(
                select(TeamJoinRequest)
                .where(TeamJoinRequest.team_id == team.id, TeamJoinRequest.status == "PENDING")
                .order_by(TeamJoinRequest.created_at)
            ).all()
        return {
            "team": self._team_summary(team),
            "members": [self._member_summary(item) for item in members],
            "incoming_requests": [self._request_summary(item) for item in requests],
            "pending_request": None,
            "source_managed": source_managed,
        }

    def create_team(self, user_id: str, name: str) -> dict:
        self._require_local_team_management(user_id)
        if self._membership_for_user(user_id):
            raise ValueError("Leave your current team before creating another one")
        normalized_name = " ".join(name.strip().split())
        if len(normalized_name) < 2 or len(normalized_name) > 120:
            raise ValueError("Team name must be between 2 and 120 characters")
        user = self._user(user_id)
        if self.db.scalar(select(Team.id).where(Team.name == normalized_name)):
            raise ValueError("That team name is already in use")
        team = Team(name=normalized_name, leader_user_id=user.id)
        self.db.add(team)
        self.db.flush()
        self.db.add(TeamMembership(team_id=team.id, user_id=user.id, role="leader"))
        self.db.commit()
        return self.get_my_team_payload(user_id)

    def request_join(self, user_id: str, team_id: str) -> dict:
        self._require_local_team_management(user_id)
        if self._membership_for_user(user_id):
            raise ValueError("Leave your current team before requesting to join another team")
        team = self.db.get(Team, team_id)
        if team is None:
            raise LookupError("Team not found")
        if team.leader_user_id == user_id:
            raise ValueError("You already lead this team")
        existing = self.db.scalar(
            select(TeamJoinRequest).where(TeamJoinRequest.team_id == team_id, TeamJoinRequest.user_id == user_id)
        )
        if existing and existing.status == "PENDING":
            raise ValueError("Your request is already awaiting the team leader's decision")
        if existing:
            existing.status = "PENDING"
            existing.created_at = datetime.utcnow()
            existing.resolved_at = None
            request = existing
        else:
            request = TeamJoinRequest(team_id=team.id, user_id=user_id)
            self.db.add(request)
        requester = self._user(user_id)
        self.db.add(
            Notification(
                user_id=team.leader_user_id,
                kind="team_join_request",
                title=f"Join request for {team.name}",
                body=f"{requester.username} asked to join your team. Review the request in your profile.",
            )
        )
        self.db.commit()
        self.db.refresh(request)
        return self._request_summary(request)

    def resolve_request(self, leader_user_id: str, request_id: str, *, accept: bool) -> dict:
        self._require_local_team_management(leader_user_id)
        request = self.db.get(TeamJoinRequest, request_id)
        if request is None:
            raise LookupError("Join request not found")
        team = self.db.get(Team, request.team_id)
        if team is None:
            raise LookupError("Team not found")
        if team.leader_user_id != leader_user_id:
            raise PermissionError("Only the team leader can review join requests")
        if request.status != "PENDING":
            raise ValueError("This join request has already been decided")
        if accept:
            if self._membership_for_user(request.user_id):
                request.status = "DECLINED"
                request.resolved_at = datetime.utcnow()
                self.db.commit()
                raise ValueError("This user is already in a team")
            self.db.add(TeamMembership(team_id=team.id, user_id=request.user_id, role="member"))
            request.status = "ACCEPTED"
            message = f"Your request to join {team.name} was accepted."
            kind = "team_join_accepted"
        else:
            request.status = "DECLINED"
            message = f"Your request to join {team.name} was declined."
            kind = "team_join_declined"
        request.resolved_at = datetime.utcnow()
        self.db.add(Notification(user_id=request.user_id, kind=kind, title="Team request updated", body=message))
        self.db.commit()
        return self.get_my_team_payload(leader_user_id)

    def leave_team(self, user_id: str) -> None:
        self._require_local_team_management(user_id)
        membership = self._membership_for_user(user_id)
        if membership is None:
            raise ValueError("You are not currently in a team")
        team = self.db.get(Team, membership.team_id)
        if team is None:
            self.db.delete(membership)
            self.db.commit()
            return
        member_count = int(
            self.db.scalar(select(func.count()).select_from(TeamMembership).where(TeamMembership.team_id == team.id)) or 0
        )
        if team.leader_user_id == user_id and member_count > 1:
            raise ValueError("Transfer leadership or remove the other members before leaving the team")
        if member_count <= 1:
            for request in self.db.scalars(select(TeamJoinRequest).where(TeamJoinRequest.team_id == team.id)).all():
                self.db.delete(request)
            self.db.delete(membership)
            self.db.delete(team)
        else:
            self.db.delete(membership)
        self.db.commit()

    def _membership_for_user(self, user_id: str) -> TeamMembership | None:
        return self.db.scalar(select(TeamMembership).where(TeamMembership.user_id == user_id))

    def _is_source_managed_user(self, user_id: str) -> bool:
        return bool(
            self.db.scalar(
                select(ExternalIdentity.id).where(ExternalIdentity.user_id == user_id, ExternalIdentity.provider == "supabase_hackathon")
            )
        )

    def _require_local_team_management(self, user_id: str) -> None:
        if self._is_source_managed_user(user_id):
            raise ValueError("Manage your Hackathon team from the Hackathon website; ARC-Bench mirrors it automatically")

    def _user(self, user_id: str) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise LookupError("User not found")
        return user

    def _team_summary(self, team: Team) -> dict:
        leader = self._user(team.leader_user_id)
        member_count = int(
            self.db.scalar(select(func.count()).select_from(TeamMembership).where(TeamMembership.team_id == team.id)) or 0
        )
        return {
            "id": team.id,
            "name": team.name,
            "leader_user_id": team.leader_user_id,
            "leader_username": leader.username,
            "member_count": member_count,
            "source_provider": team.source_provider,
            "source_team_id": team.source_team_id,
            "github_repo": team.github_repo,
            "model_name": team.model_name,
            "harness": team.harness,
            "created_at": team.created_at,
        }

    def _member_summary(self, membership: TeamMembership) -> dict:
        user = self._user(membership.user_id)
        return {
            "user_id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "role": membership.role,
            "created_at": membership.created_at,
        }

    def _request_summary(self, request: TeamJoinRequest) -> dict:
        user = self._user(request.user_id)
        return {
            "id": request.id,
            "team_id": request.team_id,
            "user_id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "status": request.status,
            "created_at": request.created_at,
        }
