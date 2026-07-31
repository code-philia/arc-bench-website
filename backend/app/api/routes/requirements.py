import subprocess

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.requirement import (
    BenchmarkDetail,
    BenchmarkSummary,
    CompetitionDetail,
    CompetitionLeaderboardEntry,
    CompetitionSummary,
    RequirementDetail,
    RequirementSummary,
)
from app.services.agent_starter_service import AgentStarterService
from app.services.demo_agent_service import DemoAgentService
from app.services.requirement_catalog import RequirementCatalogService


router = APIRouter(prefix="/requirements", tags=["requirements"])
competition_router = APIRouter(prefix="/competitions", tags=["competitions"])
benchmark_router = APIRouter(prefix="/benchmarks", tags=["benchmarks"])


@router.get("", response_model=list[RequirementSummary])
def list_requirements(
    catalog: str = Query(default="playground", pattern="^(playground|competition|benchmark)$"),
    db: Session = Depends(get_db),
) -> list[RequirementSummary]:
    service = RequirementCatalogService.for_catalog(db, catalog)
    return service.list_requirements()


@competition_router.get("", response_model=list[CompetitionSummary])
def list_competitions(db: Session = Depends(get_db)) -> list[CompetitionSummary]:
    service = RequirementCatalogService.for_catalog(db, "competition")
    return service.list_competitions()


@competition_router.get("/leaderboard", response_model=list[CompetitionLeaderboardEntry])
def get_competition_leaderboard(
    track: str = Query(default="all", pattern="^(all|web|mobile|kernel)$"),
    db: Session = Depends(get_db),
) -> list[CompetitionLeaderboardEntry]:
    service = RequirementCatalogService.for_catalog(db, "competition")
    return service.list_competition_leaderboard(track)


@competition_router.get("/{competition_id}/starter-agent")
def download_competition_starter_agent(
    competition_id: str,
    language: str = Query(default="python", pattern="^(python|javascript|typescript|nodejs|js|ts|py)$"),
    db: Session = Depends(get_db),
) -> Response:
    service = RequirementCatalogService.for_catalog(db, "competition")
    if not any(competition.id == competition_id for competition in service.list_competitions()):
        raise HTTPException(status_code=404, detail=f"Competition '{competition_id}' not found")
    try:
        content, filename = AgentStarterService().build_bundle(task_type="web", language=language)
    except (FileNotFoundError, RuntimeError, ValueError, subprocess.CalledProcessError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


@benchmark_router.get("", response_model=list[BenchmarkSummary])
def list_benchmarks(request: Request, db: Session = Depends(get_db)) -> list[BenchmarkSummary]:
    service = RequirementCatalogService.for_catalog(db, "benchmark")
    return service.list_benchmarks(str(request.base_url).rstrip("/"))


@benchmark_router.get("/{benchmark_id}", response_model=BenchmarkDetail)
def get_benchmark(benchmark_id: str, request: Request, db: Session = Depends(get_db)) -> BenchmarkDetail:
    service = RequirementCatalogService.for_catalog(db, "benchmark")
    try:
        return service.get_benchmark_detail(benchmark_id, str(request.base_url).rstrip("/"))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@benchmark_router.get("/{benchmark_id}/download")
def download_benchmark_track(benchmark_id: str, db: Session = Depends(get_db)) -> Response:
    service = RequirementCatalogService.for_catalog(db, "benchmark")
    try:
        content, filename = service.build_benchmark_track_bundle(benchmark_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@benchmark_router.get("/tasks/{requirement_id}/download")
def download_benchmark_task(requirement_id: str, db: Session = Depends(get_db)) -> Response:
    service = RequirementCatalogService.for_catalog(db, "benchmark")
    try:
        content, filename = service.build_benchmark_task_bundle(requirement_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{requirement_id}/starter-agent")
def download_starter_agent(
    requirement_id: str,
    catalog: str = Query(default="playground", pattern="^(playground|competition|benchmark)$"),
    language: str = Query(default="python", pattern="^(python|javascript|typescript|nodejs|js|ts|py)$"),
    db: Session = Depends(get_db),
) -> Response:
    service = RequirementCatalogService.for_catalog(db, catalog)
    try:
        requirement = service.get_entry(requirement_id)
        task_type = requirement.category if catalog != "competition" else "web"
        content, filename = AgentStarterService().build_bundle(task_type=task_type, language=language)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (FileNotFoundError, RuntimeError, ValueError, subprocess.CalledProcessError) as exc:
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
    catalog: str = Query(default="playground", pattern="^(playground|competition|benchmark)$"),
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
    catalog: str = Query(default="playground", pattern="^(playground|competition|benchmark)$"),
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
    catalog: str = Query(default="playground", pattern="^(playground|competition|benchmark)$"),
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
