from __future__ import annotations

from io import BytesIO
from pathlib import Path
import zipfile

from app.core.config import get_settings


class AgentStarterService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.template_root = self.settings.agent_starter_template_root

    def build_bundle(self, *, task_type: str, language: str = "python", template_kind: str = "blank") -> tuple[bytes, str]:
        language_root, normalized_language = self._resolve_language_template_root(language)
        if not language_root.is_dir():
            raise FileNotFoundError(f"Agent starter template root not found: {language_root}")

        task_template_root = self._resolve_template_root(task_type)
        memory_file = BytesIO()
        with zipfile.ZipFile(memory_file, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            self._add_starter_template_sources(archive, language_root)
            self._add_task_template(archive, task_template_root)
            self._add_selected_agent_template(archive, template_kind)
        normalized_kind = self._normalize_template_kind(template_kind)
        return memory_file.getvalue(), f"arcbench-agent-{normalized_kind}-template-{task_type}-{normalized_language}.zip"

    @staticmethod
    def _normalize_template_kind(template_kind: str) -> str:
        normalized = str(template_kind or "blank").strip().lower()
        if normalized not in {"blank", "arc", "octos", "codex", "claude_code"}:
            raise ValueError(f"Unsupported agent template: {template_kind}")
        return normalized

    def _add_selected_agent_template(self, archive: zipfile.ZipFile, template_kind: str) -> None:
        normalized = self._normalize_template_kind(template_kind)
        if normalized in {"blank", "codex", "claude_code"}:
            return
        if normalized == "arc":
            self._add_source_tree(archive, self.settings.builtin_arc_agent_source_dir, "template/arc")
            return
        self._add_source_tree(archive, self.settings.runner_context_dir / "octos", "template/octos")

    def _add_source_tree(self, archive: zipfile.ZipFile, source_root: Path, archive_root: str) -> None:
        if not source_root.is_dir():
            raise FileNotFoundError(f"Agent template source directory not found: {source_root}")
        for path in sorted(source_root.rglob("*")):
            if path.is_dir() or self._should_exclude_starter_path(path, source_root):
                continue
            relative_path = path.relative_to(source_root)
            archive.write(path, arcname=f"{archive_root}/{relative_path.as_posix()}")

    def _resolve_language_template_root(self, language: str) -> tuple[Path, str]:
        normalized = str(language or "").strip().lower()
        aliases = {
            "js": "javascript",
            "node": "javascript",
            "nodejs": "javascript",
            "ts": "typescript",
            "py": "python",
        }
        normalized = aliases.get(normalized, normalized)
        if normalized not in {"python", "javascript", "typescript"}:
            raise ValueError(f"Unsupported agent template language: {language}")
        return self.template_root / normalized, normalized

    def _add_starter_template_sources(self, archive: zipfile.ZipFile, source_root: Path) -> None:
        for path in sorted(source_root.rglob("*")):
            if path.is_dir() or self._should_exclude_starter_path(path, source_root):
                continue
            relative_path = path.relative_to(source_root)
            archive.write(path, arcname=relative_path.as_posix())

    def _should_exclude_starter_path(self, path: Path, source_root: Path) -> bool:
        relative_path = path.relative_to(source_root)
        excluded_parts = {
            ".git",
            ".mypy_cache",
            ".pytest_cache",
            ".ruff_cache",
            ".venv",
            "__pycache__",
            "build",
            "dist",
            "node_modules",
            "target",
            "venv",
        }
        excluded_files = {".DS_Store", ".env", ".env.local", ".env.development", ".env.production"}
        return (
            bool(set(relative_path.parts) & excluded_parts)
            or relative_path.name in excluded_files
            or relative_path.suffix == ".pyc"
        )

    def _add_task_template(self, archive: zipfile.ZipFile, template_root: Path) -> None:
        if not template_root.is_dir():
            raise FileNotFoundError(f"Task template directory not found: {template_root}")
        for path in sorted(template_root.rglob("*")):
            if path.is_dir():
                continue
            relative_path = path.relative_to(template_root)
            archive.write(path, arcname=f"template/{relative_path.as_posix()}")

    def _resolve_template_root(self, task_type: str) -> Path:
        normalized = str(task_type or "").strip().lower()
        if normalized == "cli":
            return self.settings.builtin_arc_agent_source_dir / "templates" / "cli"
        arc_bench_root = self.settings.requirements_root.parent.parent
        if normalized == "mobile":
            return arc_bench_root / "mobileapp" / "template"
        return arc_bench_root / "webapp" / "template"
