from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UpdateProfileRequest, UserSummary
from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    service = AuthService(db)
    try:
        user = service.register_user(payload.email, payload.username, payload.password)
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
        secure=False,
        max_age=AuthService.SESSION_TTL_DAYS * 24 * 60 * 60,
        path="/",
    )
