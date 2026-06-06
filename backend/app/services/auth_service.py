from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.user import User


class AuthService:
    COOKIE_NAME = "arcbench_session"
    SESSION_TTL_DAYS = 14

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.secret = self._get_secret()

    def register_user(self, email: str, username: str, password: str) -> User:
        normalized_email = email.strip().lower()
        normalized_username = self._normalize_username(username)
        self._validate_password(password)

        if self.db.scalar(select(User).where(User.email == normalized_email)):
            raise ValueError("Email is already registered")
        if self.db.scalar(select(User).where(User.username == normalized_username)):
            raise ValueError("Username is already taken")

        user = User(
            id=uuid.uuid4().hex,
            email=normalized_email,
            username=normalized_username,
            password_hash=self._hash_password(password),
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def authenticate_user(self, email: str, password: str) -> User:
        normalized_email = email.strip().lower()
        user = self.db.scalar(select(User).where(User.email == normalized_email))
        if not user or not self._verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")
        return user

    def build_session_token(self, user: User) -> str:
        expires_at = int((datetime.utcnow() + timedelta(days=self.SESSION_TTL_DAYS)).timestamp())
        nonce = secrets.token_hex(16)
        payload = f"{user.id}:{expires_at}:{nonce}"
        signature = hmac.new(self.secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
        return f"{payload}:{signature}"

    def resolve_user_from_request(self, request: Request) -> User | None:
        token = request.cookies.get(self.COOKIE_NAME)
        if not token:
            return None
        parts = token.split(":")
        if len(parts) != 4:
            return None
        user_id, expires_at_raw, nonce, signature = parts
        payload = f"{user_id}:{expires_at_raw}:{nonce}"
        expected_signature = hmac.new(self.secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_signature):
            return None
        try:
            expires_at = int(expires_at_raw)
        except ValueError:
            return None
        if expires_at < int(datetime.utcnow().timestamp()):
            return None
        return self.db.get(User, user_id)

    @staticmethod
    def _normalize_username(username: str) -> str:
        normalized = "".join(username.strip().split())
        if len(normalized) < 3 or len(normalized) > 32:
            raise ValueError("Username must be between 3 and 32 characters")
        allowed = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-")
        if any(char not in allowed for char in normalized):
            raise ValueError("Username can only contain letters, numbers, underscore, and hyphen")
        return normalized

    @staticmethod
    def _validate_password(password: str) -> None:
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters")

    @staticmethod
    def _hash_password(password: str) -> str:
        salt = secrets.token_hex(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000)
        return f"{salt}${digest.hex()}"

    @staticmethod
    def _verify_password(password: str, stored_hash: str) -> bool:
        try:
            salt, digest = stored_hash.split("$", 1)
        except ValueError:
            return False
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000).hex()
        return hmac.compare_digest(candidate, digest)

    def _get_secret(self) -> bytes:
        secret = self.settings.session_secret.strip()
        if not secret:
            secret = "arcbench-dev-session-secret"
        return secret.encode("utf-8")
