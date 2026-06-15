from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.requirement import CompetitionDetail, CompetitionSummary, RequirementDetail, RequirementSummary
from app.services.requirement_catalog import RequirementCatalogService


router = APIRouter(prefix="/requirements", tags=["requirements"])
competition_router = APIRouter(prefix="/competitions", tags=["competitions"])


@router.get("", response_model=list[RequirementSummary])
def list_requirements(db: Session = Depends(get_db)) -> list[RequirementSummary]:
    service = RequirementCatalogService(db)
    return service.list_requirements()


@competition_router.get("", response_model=list[CompetitionSummary])
def list_competitions(db: Session = Depends(get_db)) -> list[CompetitionSummary]:
    service = RequirementCatalogService(db)
    return service.list_competitions()


@competition_router.get("/{competition_id}", response_model=CompetitionDetail)
def get_competition(competition_id: str, request: Request, db: Session = Depends(get_db)) -> CompetitionDetail:
    service = RequirementCatalogService(db)
    try:
        return service.get_competition_detail(competition_id, str(request.base_url).rstrip("/"))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@competition_router.get("/public/download")
def download_public_competition(db: Session = Depends(get_db)) -> Response:
    service = RequirementCatalogService(db)
    content, filename = service.build_public_competition_bundle()
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@competition_router.get("/public/tasks/{requirement_id}/download/{download_kind}")
def download_public_task(requirement_id: str, download_kind: str, db: Session = Depends(get_db)) -> Response:
    service = RequirementCatalogService(db)
    try:
        if download_kind == "requirements":
            content, filename = service.build_public_task_document(requirement_id, "requirements")
            media_type = "text/markdown; charset=utf-8"
        elif download_kind == "prerequisites":
            content, filename = service.build_public_task_document(requirement_id, "prerequisites")
            media_type = "text/markdown; charset=utf-8"
        elif download_kind == "tests":
            content, filename = service.build_public_task_tests_bundle(requirement_id)
            media_type = "application/zip"
        elif download_kind == "demo":
            content, filename = service.build_public_task_demo_bundle(requirement_id)
            media_type = "application/zip"
        elif download_kind == "full":
            content, filename = service.build_public_task_bundle(requirement_id)
            media_type = "application/zip"
        else:
            raise HTTPException(status_code=404, detail="Unknown download kind")
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@competition_router.get("/public/demo-agent")
def download_demo_agent() -> FileResponse:
    demo_agent_path = get_settings().demo_agent_zip
    if not demo_agent_path.is_file():
        raise HTTPException(status_code=404, detail="Demo agent bundle not found")
    return FileResponse(
        demo_agent_path,
        media_type="application/zip",
        filename=demo_agent_path.name,
    )


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
