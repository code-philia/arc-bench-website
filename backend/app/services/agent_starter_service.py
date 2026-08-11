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
        normalized_kind = self._normalize_template_kind(template_kind)
        language_root, normalized_language = self._resolve_language_template_root(language)
        if normalized_kind != "blank" and normalized_language != "python":
            raise ValueError(f"The {normalized_kind} agent template is only available for Python.")

        memory_file = BytesIO()
        with zipfile.ZipFile(memory_file, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            if normalized_kind == "blank":
                if not language_root.is_dir():
                    raise FileNotFoundError(f"Agent starter template root not found: {language_root}")
                self._add_starter_template_sources(archive, language_root)
                self._add_task_template(archive, self._resolve_template_root(task_type))
            else:
                self._add_reference_agent_template(archive, normalized_kind, task_type)
        return memory_file.getvalue(), f"arcbench-agent-{normalized_kind}-template-{task_type}-{normalized_language}.zip"

    @staticmethod
    def _normalize_template_kind(template_kind: str) -> str:
        normalized = str(template_kind or "blank").strip().lower()
        if normalized not in {"blank", "arc", "codex", "claude_code"}:
            raise ValueError(f"Unsupported agent template: {template_kind}")
        return normalized

    def _add_reference_agent_template(self, archive: zipfile.ZipFile, template_kind: str, task_type: str) -> None:
        """Add a runnable reference agent at the archive root.

        The runner always invokes ``/workspace/submission/main.py``.  Reference
        agents therefore cannot be shipped as files below ``template/<kind>``:
        that layout leaves the blank starter as the active entry point.
        """
        if template_kind == "arc":
            self._add_arc_agent_template(archive)
            return

        source_roots = {
            "codex": self.settings.agent_reference_codex_root,
            "claude_code": self.settings.agent_reference_claude_code_root,
        }
        self._add_source_tree(
            archive,
            source_roots[template_kind],
            "",
            excluded_top_level_names={"template"},
        )
        self._add_task_template(archive, self._resolve_template_root(task_type))

    def _add_arc_agent_template(self, archive: zipfile.ZipFile) -> None:
        source_root = self.settings.builtin_arc_agent_source_dir
        if not source_root.is_dir():
            raise FileNotFoundError(f"Agent template source directory not found: {source_root}")

        for path in sorted(source_root.rglob("*")):
            if path.is_dir() or self._should_exclude_starter_path(path, source_root):
                continue
            relative_path = path.relative_to(source_root)
            archive_name = "arc_main.py" if relative_path == Path("main.py") else relative_path.as_posix()
            archive.write(path, arcname=archive_name)

        archive.writestr("main.py", self._build_arc_entrypoint())

    @staticmethod
    def _build_arc_entrypoint() -> str:
        return '''from __future__ import annotations

import os
import sys

from arc_main import main as arc_main


def main() -> None:
    arguments = sys.argv[1:]
    if "--type" not in arguments:
        arguments.extend(["--type", os.environ.get("ARCBENCH_TASK_TYPE", "web")])
    sys.argv = [sys.argv[0], "compile", *arguments]
    arc_main()


if __name__ == "__main__":
    main()
'''

    def _add_source_tree(
        self,
        archive: zipfile.ZipFile,
        source_root: Path,
        archive_root: str,
        *,
        excluded_top_level_names: set[str] | None = None,
    ) -> None:
        if not source_root.is_dir():
            raise FileNotFoundError(f"Agent template source directory not found: {source_root}")
        for path in sorted(source_root.rglob("*")):
            if path.is_dir() or self._should_exclude_starter_path(path, source_root):
                continue
            relative_path = path.relative_to(source_root)
            if excluded_top_level_names and relative_path.parts[0] in excluded_top_level_names:
                continue
            archive_name = relative_path.as_posix()
            if archive_root:
                archive_name = f"{archive_root.rstrip('/')}/{archive_name}"
            archive.write(path, arcname=archive_name)

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
            return self.settings.builtin_arc_agent_source_dir / "arc-template" / "templates" / "cli-python"
        if normalized in {"mobile", "android"}:
            return self.settings.mobile_template_files_root
        return self.settings.web_template_files_root
