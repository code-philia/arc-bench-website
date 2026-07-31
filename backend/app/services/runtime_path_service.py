from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings
from app.models.submission import Submission
from app.models.user import User


class RuntimePathService:
    def __init__(self) -> None:
        self.settings = get_settings()

    @staticmethod
    def _sanitize_segment(value: str) -> str:
        normalized = "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in value.strip())
        normalized = normalized.strip("-")
        return normalized or "unknown"

    def get_user_root_by_identity(self, username: str, user_id: str) -> Path:
        user_segment = self._sanitize_segment(username)
        return self.settings.user_submissions_root / f"{user_segment}-{user_id}"

    def get_user_root(self, user: User) -> Path:
        return self.get_user_root_by_identity(user.username, user.id)

    def get_submission_root(self, submission: Submission, username: str | None = None) -> Path:
        user_name = username or "user"
        if submission.user_id:
            return self.get_user_root_by_identity(user_name, submission.user_id) / submission.id
        return self.settings.user_submissions_root / "anonymous" / submission.id

    def get_submission_root_by_identity(self, username: str, user_id: str, submission_id: str) -> Path:
        return self.get_user_root_by_identity(username, user_id) / submission_id

    def get_workspace_root(self, submission: Submission, username: str | None = None) -> Path:
        return self.get_submission_root(submission, username=username) / "workspace"

    @staticmethod
    def get_template_root_from_workspace(workspace_path: Path) -> Path:
        return workspace_path / "template"

    @staticmethod
    def get_arc_dir_from_workspace(workspace_path: Path) -> Path:
        return workspace_path / "template" / ".arc"

    def get_archive_path(self, submission: Submission, username: str | None = None) -> Path:
        return self.get_submission_root(submission, username=username) / "agent.zip"

    @staticmethod
    def resolve_existing_path(path_value: str | None) -> Path | None:
        if not path_value:
            return None
        path = Path(path_value)
        return path if path.exists() else None
