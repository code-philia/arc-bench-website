from __future__ import annotations

import json
import sqlite3
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
import re

from app.models.submission import Submission
from app.services.runtime_path_service import RuntimePathService
from app.services.traceability_seed_builder import TraceabilitySeedBuilder


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

COMMIT_MESSAGE_PATTERN = re.compile(r"^(?P<node_id>[A-Z0-9.-]+)\s+\((?P<phase>design|implement)\):\s*(?P<summary>.+)$")


@dataclass(frozen=True)
class GitCommitRecord:
    oid: str
    short_oid: str
    committed_at: str
    message: str


@dataclass(frozen=True)
class GitChangedFileRecord:
    file_path: str
    change_type: str
    old_file_path: str | None = None


class SubmissionArtifactService:
    def __init__(self) -> None:
        self.runtime_paths = RuntimePathService()
        self.traceability_seed_builder = TraceabilitySeedBuilder()

    def read_node_visual_states(self, submission: Submission) -> dict[str, str]:
        snapshot = self._read_traceability_snapshot(submission)
        if snapshot is None:
            return {}
        node_states = snapshot.get("node_states")
        if not isinstance(node_states, list):
            return {}
        visual_states: dict[str, str] = {}
        for row in node_states:
            if not isinstance(row, dict):
                continue
            req_id = str(row.get("req_id") or "").strip()
            visual_state = self._normalize_node_visual_state(row.get("state"))
            if req_id and visual_state:
                visual_states[req_id] = visual_state
        return visual_states

    def read_traceability(self, submission: Submission, node_id: str) -> dict[str, list[dict]]:
        snapshot = self._read_traceability_snapshot(submission)
        if snapshot is None:
            return {"interfaces": [], "tests": []}
        test_status_by_id = self._read_demo_test_statuses(submission)

        interfaces: list[dict] = []
        tests: list[dict] = []

        for row in snapshot.get("interfaces", []):
            if not isinstance(row, dict):
                continue
            req_ids = self._parse_json_list(row.get("req_ids"))
            if node_id and node_id != "__all__" and node_id not in req_ids:
                continue
            interfaces.append(
                {
                    "interface_id": str(row.get("interface_id") or ""),
                    "req_ids": req_ids,
                    "type": str(row.get("type") or ""),
                    "content": str(row.get("content") or ""),
                    "file_path": str(row.get("file_path") or ""),
                    "first_line": self._normalize_first_line_reference(row.get("first_line")),
                    "implemented": bool(row.get("implemented")),
                    "callers": self._parse_json_list(row.get("callers")),
                    "callees": self._parse_json_list(row.get("callees")),
                }
            )

        for row in snapshot.get("tests", []):
            if not isinstance(row, dict):
                continue
            req_id = str(row.get("req_id") or "")
            if node_id and node_id != "__all__" and node_id != req_id:
                continue
            test_id = str(row.get("test_id") or "")
            tests.append(
                {
                    "test_id": test_id,
                    "req_id": req_id,
                    "scenario_id": None,
                    "type": str(row.get("type") or ""),
                    "file_path": str(row.get("file_path") or ""),
                    "first_line": self._normalize_first_line_reference(row.get("first_line")),
                    "status": self._resolve_test_status(
                        test_status_by_id.get(test_id),
                        row.get("passed"),
                    ),
                }
            )

        return {"interfaces": interfaces, "tests": tests}

    def read_source(
        self,
        submission: Submission,
        *,
        file_path: str,
        first_line: str | int | None,
        kind: str,
        commit_oid: str | None = None,
    ) -> dict[str, str | int]:
        if kind not in {"file", "diff"}:
            raise ValueError("Only kind=file and kind=diff are supported")

        if kind == "diff":
            return self._read_diff_source(submission, file_path=file_path, commit_oid=commit_oid)

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
        highlight_line = self._resolve_source_highlight_line(content, first_line)

        return {
            "kind": "file",
            "file_path": normalized_relative_path.as_posix(),
            "language": language,
            "content": content,
            "first_line": highlight_line,
        }

    def read_commit_history(self, submission: Submission) -> dict[str, str | list[dict[str, object]]]:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None or not workspace_path.is_dir():
            return {"availability": "workspace_unavailable", "commits": []}

        project_root = workspace_path / "template"
        if not project_root.is_dir():
            return {"availability": "workspace_unavailable", "commits": []}

        git_dir = project_root / ".git"
        if not git_dir.exists():
            return {"availability": "git_unavailable", "commits": []}

        commits: list[dict[str, object]] = []
        for commit in self._iter_git_commits(project_root):
            parsed = self._parse_commit_message(commit.message)
            changed_files = self._read_commit_changed_files(project_root, commit.oid)
            commits.append(
                {
                    "oid": commit.oid,
                    "short_oid": commit.short_oid,
                    "committed_at": commit.committed_at,
                    "message": commit.message,
                    "node_id": parsed["node_id"],
                    "phase": parsed["phase"],
                    "summary": parsed["summary"],
                    "changed_files": [
                        {
                            "file_path": changed_file.file_path,
                            "change_type": changed_file.change_type,
                            "old_file_path": changed_file.old_file_path,
                        }
                        for changed_file in changed_files
                    ],
                }
            )
        return {"availability": "available", "commits": commits}

    def _get_traceability_snapshot_path(self, submission: Submission) -> Path | None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            return None
        snapshot_path = workspace_path / "artifacts" / "traceability.snapshot.json"
        db_path = workspace_path / "artifacts" / "traceability.db"
        self._refresh_traceability_snapshot_from_db(snapshot_path, db_path)
        return snapshot_path if snapshot_path.is_file() else None

    def refresh_traceability_snapshot_for_workspace(self, workspace_path: Path, *, force: bool = False) -> bool:
        snapshot_path = workspace_path / "artifacts" / "traceability.snapshot.json"
        db_path = workspace_path / "artifacts" / "traceability.db"
        return self._refresh_traceability_snapshot_from_db(snapshot_path, db_path, force=force)

    def _get_project_root(self, submission: Submission) -> Path | None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            return None
        template_root = workspace_path / "template"
        return template_root if template_root.is_dir() else None

    def _read_demo_test_statuses(self, submission: Submission) -> dict[str, str]:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            return {}
        status_path = workspace_path / "artifacts" / "demo-test-statuses.json"
        if not status_path.is_file():
            return {}
        try:
            payload = json.loads(status_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        if not isinstance(payload, dict):
            return {}
        tests = payload.get("tests")
        if not isinstance(tests, dict):
            return {}
        normalized: dict[str, str] = {}
        for test_id, raw_status in tests.items():
            key = str(test_id).strip()
            status = self._normalize_demo_test_status(raw_status)
            if key and status:
                normalized[key] = status
        return normalized

    def _read_traceability_snapshot(self, submission: Submission) -> dict[str, object] | None:
        snapshot_path = self._get_traceability_snapshot_path(submission)
        if snapshot_path is None:
            return None
        try:
            payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        return payload if isinstance(payload, dict) else None

    def _refresh_traceability_snapshot_from_db(
        self,
        snapshot_path: Path,
        db_path: Path,
        *,
        force: bool = False,
    ) -> bool:
        if not db_path.is_file():
            return snapshot_path.is_file()

        if not force and snapshot_path.is_file():
            try:
                if snapshot_path.stat().st_mtime_ns >= db_path.stat().st_mtime_ns:
                    return True
            except OSError:
                pass

        for delay in (0.0, 0.05, 0.15, 0.3):
            if delay > 0:
                time.sleep(delay)
            try:
                self.traceability_seed_builder.write_snapshot_file_from_database(snapshot_path, db_path)
                return True
            except (OSError, sqlite3.Error, ValueError):
                continue
        return snapshot_path.is_file()

    def _read_diff_source(self, submission: Submission, *, file_path: str, commit_oid: str | None) -> dict[str, str | int]:
        if not commit_oid or not commit_oid.strip():
            raise ValueError("commit_oid is required for kind=diff")

        project_root = self._get_project_root(submission)
        if project_root is None:
            raise FileNotFoundError("Submission source workspace is not available")

        git_dir = project_root / ".git"
        if not git_dir.exists():
            raise FileNotFoundError("Git history is not available for this submission")

        safe_commit_oid = commit_oid.strip()
        commit_record = self._get_git_commit(project_root, safe_commit_oid)
        normalized_relative_path = self._normalize_relative_path(file_path) if file_path.strip() else None

        if normalized_relative_path is None:
            diff_output = self._run_git(project_root, ["show", "--format=medium", "--patch", safe_commit_oid])
            output_file_path = f"commit-{commit_record.short_oid}.diff"
        else:
            changed_files = self._read_commit_changed_files(project_root, safe_commit_oid)
            matching_change = self._match_changed_file(normalized_relative_path.as_posix(), changed_files)
            if matching_change is None:
                raise FileNotFoundError(
                    f"Diff file not found in commit {commit_record.short_oid}: {normalized_relative_path.as_posix()}"
                )
            diff_output = self._run_git(
                project_root,
                ["show", "--format=medium", "--patch", safe_commit_oid, "--", matching_change.file_path],
            )
            output_file_path = matching_change.file_path

        return {
            "kind": "diff",
            "file_path": output_file_path,
            "language": "diff",
            "content": diff_output,
            "first_line": 1,
        }

    def _iter_git_commits(self, project_root: Path) -> list[GitCommitRecord]:
        output = self._run_git(
            project_root,
            [
                "log",
                "--reverse",
                "--date=iso-strict",
                "--pretty=format:%H%x1f%h%x1f%cI%x1f%s",
            ],
        )
        commits: list[GitCommitRecord] = []
        for line in output.splitlines():
            parts = line.split("\x1f")
            if len(parts) != 4:
                continue
            oid, short_oid, committed_at, message = parts
            if not message.strip():
                continue
            commits.append(
                GitCommitRecord(
                    oid=oid.strip(),
                    short_oid=short_oid.strip(),
                    committed_at=committed_at.strip(),
                    message=message.strip(),
                )
            )
        return commits

    def _get_git_commit(self, project_root: Path, commit_oid: str) -> GitCommitRecord:
        output = self._run_git(
            project_root,
            [
                "show",
                "--no-patch",
                "--date=iso-strict",
                "--pretty=format:%H%x1f%h%x1f%cI%x1f%s",
                commit_oid,
            ],
        ).strip()
        parts = output.split("\x1f")
        if len(parts) != 4:
            raise FileNotFoundError(f"Commit not found: {commit_oid}")
        return GitCommitRecord(
            oid=parts[0].strip(),
            short_oid=parts[1].strip(),
            committed_at=parts[2].strip(),
            message=parts[3].strip(),
        )

    def _read_commit_changed_files(self, project_root: Path, commit_oid: str) -> list[GitChangedFileRecord]:
        output = self._run_git(project_root, ["show", "--format=", "--name-status", "--find-renames", commit_oid])
        changed_files: list[GitChangedFileRecord] = []
        for raw_line in output.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            status = parts[0].strip()
            change_type = status[:1] if status else ""
            if not change_type:
                continue
            if change_type == "R" and len(parts) >= 3:
                changed_files.append(
                    GitChangedFileRecord(
                        file_path=parts[2].strip(),
                        change_type="R",
                        old_file_path=parts[1].strip(),
                    )
                )
                continue
            changed_files.append(
                GitChangedFileRecord(
                    file_path=parts[1].strip(),
                    change_type=change_type,
                )
            )
        return changed_files

    @staticmethod
    def _match_changed_file(
        normalized_file_path: str, changed_files: list[GitChangedFileRecord]
    ) -> GitChangedFileRecord | None:
        for changed_file in changed_files:
            if changed_file.file_path == normalized_file_path or changed_file.old_file_path == normalized_file_path:
                return changed_file
        return None

    @staticmethod
    def _parse_commit_message(message: str) -> dict[str, str | None]:
        match = COMMIT_MESSAGE_PATTERN.match(message.strip())
        if not match:
            return {"node_id": None, "phase": None, "summary": None}
        return {
            "node_id": match.group("node_id"),
            "phase": match.group("phase"),
            "summary": match.group("summary").strip(),
        }

    @staticmethod
    def _run_git(project_root: Path, args: list[str]) -> str:
        completed = subprocess.run(
            ["git", *args],
            cwd=str(project_root),
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if completed.returncode != 0:
            stderr = completed.stderr.strip() or completed.stdout.strip() or "git command failed"
            raise FileNotFoundError(stderr)
        return completed.stdout

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

    @classmethod
    def _normalize_first_line_reference(cls, raw_value: object) -> str | None:
        if raw_value is None:
            return None
        normalized = str(raw_value).strip()
        if not normalized:
            return None
        parsed_int = cls._parse_positive_int(normalized)
        return str(parsed_int) if parsed_int is not None else normalized

    @classmethod
    def _resolve_source_highlight_line(cls, content: str, first_line: str | int | None) -> int:
        lines = content.replace("\r\n", "\n").split("\n")
        parsed_line_number = cls._parse_positive_int(first_line)
        if parsed_line_number is not None:
            return min(parsed_line_number, max(len(lines), 1))

        normalized_matcher = cls._normalize_first_line_matcher(first_line)
        if normalized_matcher:
            for index, line in enumerate(lines, start=1):
                if line.strip() == normalized_matcher:
                    return index
        return 1

    @staticmethod
    def _normalize_first_line_matcher(raw_value: object) -> str | None:
        if raw_value is None:
            return None
        normalized = str(raw_value).replace("\r\n", "\n").strip()
        if not normalized:
            return None
        first_non_empty_line = next((line.strip() for line in normalized.split("\n") if line.strip()), "")
        return first_non_empty_line or None

    @staticmethod
    def _normalize_demo_test_status(raw_value: object) -> str | None:
        normalized = str(raw_value or "").strip().lower()
        if normalized in {"passed", "failed"}:
            return normalized
        return None

    @classmethod
    def _resolve_test_status(cls, demo_status: object, db_passed: object) -> str | None:
        normalized_demo_status = cls._normalize_demo_test_status(demo_status)
        if normalized_demo_status:
            return normalized_demo_status
        if db_passed is None:
            return None
        normalized_db_passed = str(db_passed).strip().lower()
        if normalized_db_passed in {"1", "true"}:
            return "passed"
        if normalized_db_passed in {"0", "false"}:
            return "failed"
        return None

    @staticmethod
    def _normalize_node_visual_state(raw_value: object) -> str | None:
        normalized = str(raw_value or "").strip().upper()
        if not normalized or normalized == "UNSEEN":
            return "default"
        if normalized == "DESIGNED":
            return "design"
        if normalized in {"PASSED", "CONVERGED", "CONVERGED_WITH_FAILED_CHILDREN"}:
            return "test-passed"
        if normalized == "FAILED":
            return "test-failed"
        return "default"

