from __future__ import annotations

import hashlib
import os
import tempfile
from datetime import datetime
from pathlib import Path

import yaml
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.competition_account import BetaInviteCode


class BetaInviteService:
    """Seed and redeem one-time internal beta invitation codes."""

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def code_hash(code: str) -> str:
        return hashlib.sha256(code.strip().encode("utf-8")).hexdigest()

    def seed_from_file(self, path: Path) -> None:
        if not path.is_file():
            return
        payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        rows = payload.get("codes", []) if isinstance(payload, dict) else []
        changed = False
        for row in rows:
            if not isinstance(row, dict):
                continue
            code = str(row.get("code") or "").strip()
            if not code:
                continue
            digest = self.code_hash(code)
            if self.db.scalar(select(BetaInviteCode.id).where(BetaInviteCode.code_hash == digest)):
                continue
            self.db.add(
                BetaInviteCode(
                    code_hash=digest,
                    label=str(row.get("label") or "").strip() or None,
                    is_used=bool(row.get("is_used", False)),
                )
            )
            changed = True
        if changed:
            self.db.commit()

    def redeem(self, code: str, user_id: str) -> None:
        normalized = code.strip()
        if not normalized:
            raise ValueError("An internal beta invitation code is required")
        result = self.db.execute(
            update(BetaInviteCode)
            .where(BetaInviteCode.code_hash == self.code_hash(normalized), BetaInviteCode.is_used.is_(False))
            .values(is_used=True, redeemed_by_user_id=user_id, redeemed_at=datetime.utcnow())
        )
        if int(result.rowcount or 0) != 1:
            raise ValueError("The internal beta invitation code is invalid or has already been used")

    def mark_used_in_seed_file(self, path: Path, code: str) -> None:
        """Keep the operator-visible code file aligned with database state.

        The database remains authoritative for atomic redemption. This file is
        updated best-effort so operators can inspect which seeded codes have
        been consumed and can safely reseed a rebuilt local database.
        """

        if not path.is_file():
            return
        payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        rows = payload.get("codes", []) if isinstance(payload, dict) else []
        changed = False
        for row in rows:
            if isinstance(row, dict) and str(row.get("code") or "").strip() == code.strip():
                if row.get("is_used") is not True:
                    row["is_used"] = True
                    changed = True
                break
        if not changed:
            return
        descriptor, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as temporary:
                yaml.safe_dump(payload, temporary, allow_unicode=True, sort_keys=False)
            os.replace(temp_name, path)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
