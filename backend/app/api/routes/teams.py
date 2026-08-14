from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.team import CreateTeamRequest, MyTeamResponse, RequestTeamJoinResponse, TeamJoinRequestSummary
from app.services.team_service import TeamService


router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("/me", response_model=MyTeamResponse)
def get_my_team(db: Session = Depends(get_db), current_user: User = Depends(require_current_user)) -> MyTeamResponse:
    return MyTeamResponse(**TeamService(db).get_my_team_payload(current_user.id))


@router.post("", response_model=MyTeamResponse)
def create_team(
    payload: CreateTeamRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> MyTeamResponse:
    try:
        return MyTeamResponse(**TeamService(db).create_team(current_user.id, payload.name))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{team_id}/join-requests", response_model=RequestTeamJoinResponse)
def request_team_join(
    team_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> RequestTeamJoinResponse:
    try:
        return RequestTeamJoinResponse(request=TeamJoinRequestSummary(**TeamService(db).request_join(current_user.id, team_id)))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/join-requests/{request_id}/accept", response_model=MyTeamResponse)
def accept_team_join_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> MyTeamResponse:
    try:
        return MyTeamResponse(**TeamService(db).resolve_request(current_user.id, request_id, accept=True))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/join-requests/{request_id}/decline", response_model=MyTeamResponse)
def decline_team_join_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> MyTeamResponse:
    try:
        return MyTeamResponse(**TeamService(db).resolve_request(current_user.id, request_id, accept=False))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/leave", status_code=204)
def leave_team(db: Session = Depends(get_db), current_user: User = Depends(require_current_user)) -> None:
    try:
        TeamService(db).leave_team(current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
