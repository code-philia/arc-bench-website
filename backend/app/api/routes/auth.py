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
