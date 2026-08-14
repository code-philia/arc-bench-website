from datetime import datetime

from pydantic import BaseModel, Field


class TeamSummary(BaseModel):
    id: str
    name: str
    leader_user_id: str
    leader_username: str
    member_count: int
    source_provider: str | None = None
    source_team_id: str | None = None
    github_repo: str | None = None
    model_name: str | None = None
    harness: str | None = None
    created_at: datetime


class TeamMemberSummary(BaseModel):
    user_id: str
    username: str
    display_name: str | None = None
    role: str
    created_at: datetime


class TeamJoinRequestSummary(BaseModel):
    id: str
    team_id: str
    user_id: str
    username: str
    display_name: str | None = None
    status: str
    created_at: datetime


class MyTeamResponse(BaseModel):
    team: TeamSummary | None = None
    members: list[TeamMemberSummary] = Field(default_factory=list)
    incoming_requests: list[TeamJoinRequestSummary] = Field(default_factory=list)
    pending_request: TeamJoinRequestSummary | None = None
    source_managed: bool = False


class CreateTeamRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class RequestTeamJoinResponse(BaseModel):
    request: TeamJoinRequestSummary
