import base64
import hashlib
import hmac
import json
import time
from urllib.parse import quote

from fastapi import APIRouter, Depends, Form, HTTPException, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthResponse, HackathonSessionRequest, LoginRequest, RegisterRequest, UpdateProfileRequest, UserSummary
from app.services.auth_service import AuthService
from app.core.config import get_settings
from app.services.hackathon_config_service import load_hackathon_config
from app.services.hackathon_sync_service import HackathonSyncService
from app.services.team_service import TeamService


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    service = AuthService(db)
    try:
        user = service.register_user(payload.email, payload.username, payload.password, payload.internal_beta_code)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _set_session_cookie(response, service, user)
    return AuthResponse(user=UserSummary.model_validate(user, from_attributes=True))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    service = AuthService(db)
    try:
        user = service.authenticate_user(payload.email, payload.password)
    except ValueError as exc:
        message = str(exc)
        status_code = 400 if message in {"Email is required", "Password is required"} else 401
        raise HTTPException(status_code=status_code, detail=message) from exc
    _set_session_cookie(response, service, user)
    return AuthResponse(user=UserSummary.model_validate(user, from_attributes=True))


@router.post("/hackathon/session", response_model=AuthResponse)
def exchange_hackathon_session(
    payload: HackathonSessionRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    config = load_hackathon_config(get_settings().runtime_config_path)
    if not config.supabase_url:
        raise HTTPException(status_code=503, detail="Hackathon sign-in is not configured")
    try:
        user = HackathonSyncService(db).exchange_access_token(
            payload.access_token,
            issuer=f"{config.supabase_url.rstrip('/')}/auth/v1",
            audience=config.jwt_audience,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    _set_session_cookie(response, AuthService(db), user)
    return AuthResponse(user=UserSummary.model_validate(user, from_attributes=True))


@router.post("/hackathon/continue")
def continue_from_hackathon(
    access_token: str = Form(...),
    return_to: str = "/competitions/hackathon",
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if not return_to.startswith("/") or return_to.startswith("//"):
        raise HTTPException(status_code=400, detail="Invalid return path")
    config = load_hackathon_config(get_settings().runtime_config_path)
    if not config.supabase_url:
        raise HTTPException(status_code=503, detail="Hackathon sign-in is not configured")
    try:
        user = HackathonSyncService(db).exchange_access_token(
            access_token,
            issuer=f"{config.supabase_url.rstrip('/')}/auth/v1",
            audience=config.jwt_audience,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    response = RedirectResponse(return_to, status_code=303)
    _set_session_cookie(response, AuthService(db), user)
    return response


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(key=AuthService.COOKIE_NAME, path="/")
    return {"detail": "Logged out"}


@router.get("/meter/continue")
def continue_to_meter(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> RedirectResponse:
    settings = get_settings()
    meter_base_url = settings.meter_base_url.strip().rstrip("/")
    bridge_secret = settings.meter_bridge_secret.strip()
    if not meter_base_url:
        raise HTTPException(status_code=503, detail="Meter bridge is not configured")
    if not bridge_secret:
        raise HTTPException(status_code=503, detail="Meter bridge secret is not configured")

    team_payload = TeamService(db).get_my_team_payload(current_user.id)
    team = team_payload.get("team") if isinstance(team_payload, dict) else None
    subject_type = "team" if team else "user"
    subject_id = str(team.get("id") if team else current_user.id)
    display_name = str(team.get("name") if team else (current_user.display_name or current_user.username))
    payload = {
        "purpose": "meter-bridge",
        "subject_type": subject_type,
        "subject_id": subject_id,
        "user_id": current_user.id,
        "username": current_user.username,
        "team_id": team.get("id") if team else None,
        "team_name": team.get("name") if team else None,
        "display_name": display_name,
        "issued_at": int(time.time()),
        "expires_at": int(time.time()) + max(30, int(settings.meter_bridge_token_ttl_seconds or 120)),
    }
    token = _sign_meter_bridge_token(payload, bridge_secret)
    target = f"{meter_base_url}/api/user/bridge?token={quote(token, safe='')}"
    return RedirectResponse(target, status_code=303)


@router.get("/me", response_model=AuthResponse)
def me(current_user: User | None = Depends(get_current_user)) -> AuthResponse:
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return AuthResponse(user=UserSummary.model_validate(current_user, from_attributes=True))


@router.put("/profile", response_model=AuthResponse)
def update_profile(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> AuthResponse:
    service = AuthService(db)
    try:
        user = service.update_profile(
            current_user,
            github_email=payload.github_email,
            github_username=payload.github_username,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AuthResponse(user=UserSummary.model_validate(user, from_attributes=True))


def _set_session_cookie(response: Response, service: AuthService, user: User) -> None:
    response.set_cookie(
        key=AuthService.COOKIE_NAME,
        value=service.build_session_token(user),
        httponly=True,
        samesite="lax",
        secure=service.settings.secure_cookies,
        max_age=AuthService.SESSION_TTL_DAYS * 24 * 60 * 60,
        path="/",
    )


def _sign_meter_bridge_token(payload: dict[str, object], secret: str) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    body = base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")
    signature = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).digest()
    signed = base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")
    return f"{body}.{signed}"
