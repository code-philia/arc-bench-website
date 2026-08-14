from __future__ import annotations

import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.hackathon_config_service import load_hackathon_config
from app.core.config import get_settings
from app.services.hackathon_sync_service import HackathonSyncService


router = APIRouter(prefix="/integrations/hackathon", tags=["hackathon integration"])


class HackathonEvent(BaseModel):
    event_id: str = Field(min_length=1, max_length=128)
    event_type: str = Field(min_length=1, max_length=64)
    data: dict


@router.post("/events")
async def receive_hackathon_event(
    request: Request,
    x_arcbench_signature: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    raw = await request.body()
    config = load_hackathon_config(get_settings().runtime_config_path)
    if not config.webhook_secret:
        raise HTTPException(status_code=503, detail="Hackathon webhook integration is not configured")
    expected = hmac.new(config.webhook_secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    supplied = (x_arcbench_signature or "").removeprefix("sha256=")
    if not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="Invalid Hackathon webhook signature")
    try:
        payload = HackathonEvent.model_validate(json.loads(raw))
        HackathonSyncService(db).process_event(payload.event_id, payload.event_type, payload.data)
    except (ValueError, LookupError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"detail": "accepted"}
