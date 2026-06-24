from __future__ import annotations

import zipfile
from io import BytesIO
from pathlib import Path

from app.core.config import get_settings


class DemoAgentService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.demo_root = self.settings.demo_agent_zip.parent
        self.project_root = self.demo_root / "meetingroom"
        self.queue_path = self.demo_root / "queue.json"

    def build_bundle(self) -> tuple[bytes, str]:
        if not self.demo_root.is_dir():
            raise FileNotFoundError(f"Demo root not found: {self.demo_root}")
        if not self.project_root.is_dir():
            raise FileNotFoundError(f"Demo project not found: {self.project_root}")
        if not self.queue_path.is_file():
            raise FileNotFoundError(f"Demo queue file not found: {self.queue_path}")
        output = BytesIO()

        with zipfile.ZipFile(output, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(self.demo_root / "main.py", arcname="main.py")
            archive.write(self.demo_root / "requirements.txt", arcname="requirements.txt")
            archive.write(self.queue_path, arcname="queue.json")
            for file_path in self.project_root.rglob("*"):
                if not file_path.is_file():
                    continue
                archive.write(file_path, arcname=str(file_path.relative_to(self.demo_root)).replace("\\", "/"))

        return output.getvalue(), self.settings.demo_agent_zip.name
