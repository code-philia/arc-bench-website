from __future__ import annotations

from datetime import datetime
from pathlib import Path


class DebugLogService:
    def __init__(self, workspace_path: Path):
        self.workspace_path = workspace_path
        self.log_path = workspace_path / "template" / ".arc" / "execution.debug.log"

    def append(self, source: str, message: str) -> Path:
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        with self.log_path.open("a", encoding="utf-8") as output:
            output.write(f"[{timestamp}] [{source}] {message}\n")
        return self.log_path

    def append_block(self, source: str, title: str, content: str) -> Path:
        self.append(source, title)
        if not content:
            return self.log_path
        for line in content.splitlines():
            self.append(source, f"| {line}")
        return self.log_path
