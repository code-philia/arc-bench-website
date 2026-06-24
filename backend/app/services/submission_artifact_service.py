from __future__ import annotations

import json
import sqlite3
from pathlib import Path, PurePosixPath

from app.models.submission import Submission
from app.services.runtime_path_service import RuntimePathService


LANGUAGE_BY_SUFFIX = {
    ".c": "c",
    ".cc": "cpp",
    ".cpp": "cpp",
    ".css": "css",
    ".go": "go",
    ".html": "html",
    ".java": "java",
    ".js": "javascript",
    ".jsx": "jsx",
    ".json": "json",
    ".md": "markdown",
    ".mjs": "javascript",
    ".py": "python",
    ".rb": "ruby",
    ".rs": "rust",
    ".sh": "shell",
    ".sql": "sql",
    ".svg": "svg",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".txt": "text",
    ".vue": "vue",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
}


class SubmissionArtifactService:
    def __init__(self) -> None:
        self.runtime_paths = RuntimePathService()

    def read_traceability(self, submission: Submission, node_id: str) -> dict[str, list[dict]]:
        traceability_db_path = self._get_traceability_db_path(submission)
        if traceability_db_path is None:
            return {"interfaces": [], "tests": []}

        interfaces: list[dict] = []
        tests: list[dict] = []

        connection = sqlite3.connect(traceability_db_path)
        connection.row_factory = sqlite3.Row
        try:
            cursor = connection.cursor()
            for row in cursor.execute("SELECT * FROM interfaces ORDER BY interface_id"):
                req_ids = self._parse_json_list(row["req_ids"])
                if node_id not in req_ids:
                    continue
                interfaces.append(
                    {
                        "interface_id": str(row["interface_id"]),
                        "req_ids": req_ids,
                        "type": str(row["type"] or ""),
                        "content": str(row["content"] or ""),
                        "file_path": str(row["file_path"] or ""),
                        "first_line": self._parse_positive_int(row["first_line"]),
                        "implemented": bool(row["implemented"]),
                        "callers": self._parse_json_list(row["callers"]),
                        "callees": self._parse_json_list(row["callees"]),
                    }
                )

            for row in cursor.execute(
                "SELECT * FROM tests WHERE req_id = ? ORDER BY test_id",
                (node_id,),
            ):
                tests.append(
                    {
                        "test_id": str(row["test_id"]),
                        "req_id": str(row["req_id"]),
                        "scenario_id": str(row["scenario_id"]) if row["scenario_id"] else None,
                        "type": str(row["type"] or ""),
                        "file_path": str(row["file_path"] or ""),
                        "first_line": self._parse_positive_int(row["first_line"]),
                    }
                )
        finally:
            connection.close()

        return {"interfaces": interfaces, "tests": tests}

    def read_source(
        self,
        submission: Submission,
        *,
        file_path: str,
        first_line: int | None,
        kind: str,
    ) -> dict[str, str | int]:
        if kind != "file":
            raise ValueError("Only kind=file is supported")

        project_root = self._get_project_root(submission)
        if project_root is None:
            raise FileNotFoundError("Submission source workspace is not available")

        normalized_relative_path = self._normalize_relative_path(file_path)
        target_path = (project_root / normalized_relative_path).resolve()
        project_root_resolved = project_root.resolve()

        try:
            target_path.relative_to(project_root_resolved)
        except ValueError as exc:
            raise FileNotFoundError(f"Source path is outside the submission workspace: {file_path}") from exc

        if not target_path.is_file():
            raise FileNotFoundError(f"Source file not found: {normalized_relative_path.as_posix()}")

        content = target_path.read_text(encoding="utf-8", errors="replace")
        language = LANGUAGE_BY_SUFFIX.get(target_path.suffix.lower(), "text")
        highlight_line = first_line if first_line and first_line > 0 else 1

        return {
            "kind": "file",
            "file_path": normalized_relative_path.as_posix(),
            "language": language,
            "content": content,
            "first_line": highlight_line,
        }

    def _get_traceability_db_path(self, submission: Submission) -> Path | None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            return None
        traceability_db_path = workspace_path / "artifacts" / "traceability.db"
        return traceability_db_path if traceability_db_path.is_file() else None

    def _get_project_root(self, submission: Submission) -> Path | None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            return None
        template_root = workspace_path / "template"
        return template_root if template_root.is_dir() else None

    @staticmethod
    def _normalize_relative_path(file_path: str) -> Path:
        normalized = PurePosixPath(file_path.strip())
        if str(normalized) in {"", "."}:
            raise FileNotFoundError("Source file path is required")
        if normalized.is_absolute() or ".." in normalized.parts:
            raise FileNotFoundError(f"Invalid source file path: {file_path}")
        return Path(*normalized.parts)

    @staticmethod
    def _parse_json_list(raw_value: object) -> list[str]:
        if raw_value is None:
            return []
        if isinstance(raw_value, list):
            return [str(item) for item in raw_value]
        try:
            parsed = json.loads(str(raw_value))
        except json.JSONDecodeError:
            return []
        if not isinstance(parsed, list):
            return []
        return [str(item) for item in parsed if str(item).strip()]

    @staticmethod
    def _parse_positive_int(raw_value: object) -> int | None:
        if raw_value is None:
            return None
        try:
            parsed = int(str(raw_value).strip())
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None
