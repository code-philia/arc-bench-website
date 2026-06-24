from __future__ import annotations

from app.core.config import get_settings


class DemoAgentService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.bundle_path = self.settings.demo_agent_zip

    def build_bundle(self) -> tuple[bytes, str]:
        if not self.bundle_path.is_file():
            raise FileNotFoundError(f"Demo agent bundle not found: {self.bundle_path}")
        return self.bundle_path.read_bytes(), self.bundle_path.name
