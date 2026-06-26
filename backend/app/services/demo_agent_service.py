from __future__ import annotations

from pathlib import Path
import zipfile

from app.core.config import get_settings


class DemoAgentService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.bundle_path = self.settings.demo_agent_zip
        self.bundle_root = self.settings.demo_agent_zip.with_suffix("")

    def build_bundle(self) -> tuple[bytes, str]:
        if self.bundle_root.is_dir():
            return self._build_bundle_from_directory(self.bundle_root), self.bundle_path.name
        if not self.bundle_path.is_file():
            raise FileNotFoundError(f"Demo agent bundle not found: {self.bundle_path}")
        return self.bundle_path.read_bytes(), self.bundle_path.name

    def _build_bundle_from_directory(self, source_root: Path) -> bytes:
        buffer = bytearray()
        from io import BytesIO

        memory_file = BytesIO()
        with zipfile.ZipFile(memory_file, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(source_root.rglob("*")):
                relative_path = path.relative_to(source_root)
                if path.is_dir():
                    continue
                archive.write(path, arcname=relative_path.as_posix())
        return memory_file.getvalue()
