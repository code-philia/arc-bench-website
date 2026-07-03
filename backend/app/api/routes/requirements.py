import subprocess

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.requirement import CompetitionDetail, CompetitionSummary, RequirementDetail, RequirementSummary
from app.services.agent_starter_service import AgentStarterService
from app.services.demo_agent_service import DemoAgentService
from app.services.requirement_catalog import RequirementCatalogService


router = APIRouter(prefix="/requirements", tags=["requirements"])
competition_router = APIRouter(prefix="/competitions", tags=["competitions"])


@router.get("", response_model=list[RequirementSummary])
def list_requirements(
    catalog: str = Query(default="playground", pattern="^(playground|competition)$"),
    db: Session = Depends(get_db),
) -> list[RequirementSummary]:
    service = RequirementCatalogService.for_catalog(db, catalog)
    return service.list_requirements()


@competition_router.get("", response_model=list[CompetitionSummary])
def list_competitions(db: Session = Depends(get_db)) -> list[CompetitionSummary]:
    service = RequirementCatalogService.for_catalog(db, "competition")
    return service.list_competitions()


@competition_router.get("/{competition_id}", response_model=CompetitionDetail)
def get_competition(competition_id: str, request: Request, db: Session = Depends(get_db)) -> CompetitionDetail:
    service = RequirementCatalogService.for_catalog(db, "competition")
    try:
        return service.get_competition_detail(competition_id, str(request.base_url).rstrip("/"))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@competition_router.get("/public/download")
def download_public_competition(db: Session = Depends(get_db)) -> Response:
    service = RequirementCatalogService.for_catalog(db, "competition")
    content, filename = service.build_public_competition_bundle()
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@competition_router.get("/public/tasks/{requirement_id}/download/{download_kind}")
def download_public_task(requirement_id: str, download_kind: str, db: Session = Depends(get_db)) -> Response:
    service = RequirementCatalogService.for_catalog(db, "competition")
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
def download_demo_agent() -> Response:
    try:
        content, filename = DemoAgentService().build_bundle()
    except (FileNotFoundError, RuntimeError, subprocess.CalledProcessError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content=content,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/starter-agent")
def download_starter_agent() -> Response:
    try:
        content, filename = AgentStarterService().build_bundle()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content=content,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/{requirement_id}", response_model=RequirementDetail)
def get_requirement(
    requirement_id: str,
    request: Request,
    catalog: str = Query(default="playground", pattern="^(playground|competition)$"),
    db: Session = Depends(get_db),
) -> RequirementDetail:
    service = RequirementCatalogService.for_catalog(db, catalog)
    try:
        return service.get_requirement_detail(requirement_id, str(request.base_url).rstrip("/"))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{requirement_id}/document")
def get_document(
    requirement_id: str,
    kind: str = Query(pattern="^(requirements|prerequisites)$"),
    catalog: str = Query(default="playground", pattern="^(playground|competition)$"),
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    service = RequirementCatalogService.for_catalog(db, catalog)
    try:
        return PlainTextResponse(service.get_document(requirement_id, kind))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{requirement_id}/{asset_kind}/{asset_path:path}")
def get_asset(
    requirement_id: str,
    asset_kind: str,
    asset_path: str,
    catalog: str = Query(default="playground", pattern="^(playground|competition)$"),
    db: Session = Depends(get_db),
) -> FileResponse:
    if asset_kind not in {"assets", "references"}:
        raise HTTPException(status_code=404, detail="Unknown asset kind")
    service = RequirementCatalogService.for_catalog(db, catalog)
    try:
        return FileResponse(service.get_asset_path(requirement_id, asset_kind, asset_path))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
