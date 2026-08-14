from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserSummary(BaseModel):
    id: str
    email: str
    username: str
    github_email: str | None = None
    github_username: str | None = None
    registration_source: str = "standard"
    display_name: str | None = None
    avatar_url: str | None = None
    created_at: datetime


class RegisterRequest(BaseModel):
    email: str = ""
    username: str = ""
    password: str = ""
    internal_beta_code: str | None = Field(default=None, max_length=128)


class LoginRequest(BaseModel):
    email: str = ""
    password: str = ""


class HackathonSessionRequest(BaseModel):
    access_token: str = Field(min_length=20, max_length=8192)


class AuthResponse(BaseModel):
    user: UserSummary


class UpdateProfileRequest(BaseModel):
    github_email: EmailStr | None = None
    github_username: str | None = Field(default=None, min_length=1, max_length=255)
