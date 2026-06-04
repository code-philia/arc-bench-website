from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.requirement import RequirementDetail, RequirementSummary
from app.services.requirement_catalog import RequirementCatalogService


router = APIRouter(prefix="/requirements", tags=["requirements"])


@router.get("", response_model=list[RequirementSummary])
def list_requirements(db: Session = Depends(get_db)) -> list[RequirementSummary]:
    service = RequirementCatalogService(db)
    return service.list_requirements()


@router.get("/{requirement_id}", response_model=RequirementDetail)
def get_requirement(requirement_id: str, request: Request, db: Session = Depends(get_db)) -> RequirementDetail:
    service = RequirementCatalogService(db)
    try:
        return service.get_requirement_detail(requirement_id, str(request.base_url).rstrip("/"))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{requirement_id}/document")
def get_document(
    requirement_id: str,
    kind: str = Query(pattern="^(requirements|prerequisites)$"),
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    service = RequirementCatalogService(db)
    try:
        return PlainTextResponse(service.get_document(requirement_id, kind))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{requirement_id}/{asset_kind}/{asset_path:path}")
def get_asset(requirement_id: str, asset_kind: str, asset_path: str, db: Session = Depends(get_db)) -> FileResponse:
    if asset_kind not in {"assets", "references"}:
        raise HTTPException(status_code=404, detail="Unknown asset kind")
    service = RequirementCatalogService(db)
    try:
        return FileResponse(service.get_asset_path(requirement_id, asset_kind, asset_path))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
