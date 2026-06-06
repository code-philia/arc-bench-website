from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.services.auth_service import AuthService


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    return AuthService(db).resolve_user_from_request(request)


def require_current_user(current_user: User | None = Depends(get_current_user)) -> User:
    if current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return current_user
