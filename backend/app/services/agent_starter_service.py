from __future__ import annotations

from io import BytesIO
from pathlib import Path
import zipfile

from app.core.config import get_settings


class AgentStarterService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.template_root = self.settings.agent_starter_template_root

    def build_bundle(self, *, task_type: str) -> tuple[bytes, str]:
        if not self.template_root.is_dir():
            raise FileNotFoundError(f"Agent starter template root not found: {self.template_root}")

        task_template_root = self._resolve_template_root(task_type)
        memory_file = BytesIO()
        with zipfile.ZipFile(memory_file, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            self._add_starter_template_sources(archive)
            self._add_task_template(archive, task_template_root)
        return memory_file.getvalue(), f"arcbench-agent-starter-{task_type}.zip"

    def _add_starter_template_sources(self, archive: zipfile.ZipFile) -> None:
        for path in sorted(self.template_root.rglob("*")):
            if path.is_dir() or self._should_exclude_starter_path(path):
                continue
            relative_path = path.relative_to(self.template_root)
            archive.write(path, arcname=relative_path.as_posix())

    def _should_exclude_starter_path(self, path: Path) -> bool:
        relative_path = path.relative_to(self.template_root)
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
