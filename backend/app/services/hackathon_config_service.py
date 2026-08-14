from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass(frozen=True)
class HackathonConfig:
    supabase_url: str = ""
    jwt_audience: str = "authenticated"
    webhook_secret: str = ""
    leaderboard_secret: str = ""

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json" if self.supabase_url else ""


def load_hackathon_config(path: Path) -> HackathonConfig:
    if not path.is_file():
        return HackathonConfig()
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    values = raw.get("hackathon", {}) if isinstance(raw, dict) else {}
    if not isinstance(values, dict):
        return HackathonConfig()
    return HackathonConfig(
        supabase_url=str(values.get("supabase_url") or "").strip(),
        jwt_audience=str(values.get("jwt_audience") or "authenticated").strip() or "authenticated",
        webhook_secret=str(values.get("webhook_secret") or "").strip(),
        leaderboard_secret=str(values.get("leaderboard_secret") or "").strip(),
    )
