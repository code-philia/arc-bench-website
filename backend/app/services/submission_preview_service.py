from __future__ import annotations

from pathlib import Path

from app.models.submission import Submission
from app.services.runtime_path_service import RuntimePathService


class SubmissionPreviewService:
    ENTRY_CANDIDATES = ("index.html", "simple-demo.html")

    def __init__(self, runtime_paths: RuntimePathService | None = None) -> None:
        self.runtime_paths = runtime_paths or RuntimePathService()

    def resolve_preview_base(self, submission: Submission, username: str) -> Path | None:
        workspace = self.runtime_paths.get_workspace_root(submission, username=username)
        candidates: list[Path] = [
            workspace / "template" / "frontend" / "dist",
            workspace / "template" / "frontend",
        ]

        submission_dir = workspace / "submission"
        if submission_dir.is_dir():
            for child in sorted(submission_dir.iterdir()):
                if child.is_dir():
                    candidates.append(child / "frontend")

        for candidate in candidates:
            if self._has_preview_content(candidate):
                return candidate
        return None

    def is_preview_available(self, submission: Submission, username: str) -> bool:
        return self.resolve_preview_base(submission, username) is not None

    def resolve_entry_file(self, preview_base: Path) -> str:
        index_file = preview_base / "index.html"
        simple_demo = preview_base / "simple-demo.html"

        if index_file.is_file() and not self._is_vite_dev_index(index_file):
            return "index.html"
        if simple_demo.is_file():
            return "simple-demo.html"
        if index_file.is_file():
            return "index.html"
        raise FileNotFoundError("Preview entry file not found")

    def resolve_requested_file(self, preview_base: Path, file_path: str) -> Path:
        normalized_path = file_path.strip("/")
        if not normalized_path:
            normalized_path = self.resolve_entry_file(preview_base)

        requested_file = (preview_base / normalized_path).resolve()
        preview_base_resolved = preview_base.resolve()
        requested_file.relative_to(preview_base_resolved)

        if requested_file.is_file():
            return requested_file

        index_file = preview_base / "index.html"
        if index_file.is_file():
            return index_file

        raise FileNotFoundError(normalized_path)

    @staticmethod
    def media_type_for(path: Path) -> str | None:
        mapping = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".jsx": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".ico": "image/x-icon",
            ".woff": "font/woff",
            ".woff2": "font/woff2",
        }
        return mapping.get(path.suffix.lower())

    @staticmethod
    def _has_preview_content(path: Path) -> bool:
        if not path.is_dir():
            return False
        return any((path / name).is_file() for name in SubmissionPreviewService.ENTRY_CANDIDATES)

    @staticmethod
    def _is_vite_dev_index(path: Path) -> bool:
        content = path.read_text(encoding="utf-8", errors="ignore")
        return "/src/main.jsx" in content or "/src/main.tsx" in content
