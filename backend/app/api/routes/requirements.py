import hmac
import subprocess

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.requirement import (
    BenchmarkDetail,
    BenchmarkSummary,
    CompetitionDetail,
    CompetitionLeaderboardEntry,
    CompetitionSubmissionHistoryEntry,
    CompetitionSummary,
    RequirementDetail,
    RequirementTests,
    RequirementSummary,
)
from app.services.agent_starter_service import AgentStarterService
from app.services.demo_agent_service import DemoAgentService
from app.services.requirement_catalog import RequirementCatalogService
from app.services.competition_access_service import CompetitionAccessService
from app.services.hackathon_config_service import load_hackathon_config
from app.core.config import get_settings


def _require_competition_access(current_user: User | None, competition_id: str, db: Session) -> None:
    try:
        CompetitionAccessService(db).require_access(current_user, competition_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403 if current_user else 401, detail=str(exc)) from exc


def _competition_id_for_requirement(requirement_id: str) -> str:
    return requirement_id.split("--", 1)[0].strip().lower()


router = APIRouter(prefix="/requirements", tags=["requirements"])
competition_router = APIRouter(prefix="/competitions", tags=["competitions"])
benchmark_router = APIRouter(prefix="/benchmarks", tags=["benchmarks"])


@router.get("", response_model=list[RequirementSummary])
def list_requirements(
    catalog: str = Query(default="playground", pattern="^(playground|competition|benchmark)$"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> list[RequirementSummary]:
    service = RequirementCatalogService.for_catalog(db, catalog)
    requirements = service.list_requirements()
    if catalog != "competition":
        return requirements
    access = CompetitionAccessService(db)
    return [item for item in requirements if access.can_access(current_user, _competition_id_for_requirement(item.id))]


@competition_router.get("", response_model=list[CompetitionSummary])
def list_competitions(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> list[CompetitionSummary]:
    service = RequirementCatalogService.for_catalog(db, "competition")
    access = CompetitionAccessService(db)
    return [item for item in service.list_competitions() if access.can_access(current_user, item.id)]


@competition_router.get("/leaderboard", response_model=list[CompetitionLeaderboardEntry])
def get_competition_leaderboard(
    track: str = Query(default="all", pattern="^(all|web|mobile|kernel)$"),
    competition_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
    x_arcbench_leaderboard_secret: str | None = Header(default=None),
) -> list[CompetitionLeaderboardEntry]:
    is_hackathon_proxy = False
    if competition_id:
        config = load_hackathon_config(get_settings().runtime_config_path)
        is_hackathon_proxy = (
            competition_id.strip().lower() == CompetitionAccessService.HACKATHON_ID
            and bool(config.leaderboard_secret)
            and hmac.compare_digest(config.leaderboard_secret, x_arcbench_leaderboard_secret or "")
        )
        if not is_hackathon_proxy:
            _require_competition_access(current_user, competition_id, db)
    service = RequirementCatalogService.for_catalog(db, "competition")
    access = CompetitionAccessService(db)
    allowed_ids = {item.id for item in service.list_competitions() if access.can_access(current_user, item.id)}
    if is_hackathon_proxy:
        # The Hackathon site's server-side leaderboard proxy is authenticated
        # with a separate shared secret; it must not inherit anonymous UI
        # visibility filtering from ARC-Bench.
        allowed_ids.add(CompetitionAccessService.HACKATHON_ID)
    return service.list_competition_leaderboard(track, competition_id=competition_id, allowed_competition_ids=allowed_ids)


@competition_router.get("/{competition_id}/submissions", response_model=list[CompetitionSubmissionHistoryEntry])
def get_competition_submission_history(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
) -> list[CompetitionSubmissionHistoryEntry]:
    _require_competition_access(current_user, competition_id, db)
    service = RequirementCatalogService.for_catalog(db, "competition")
    try:
        return service.list_competition_submission_history(competition_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@competition_router.get("/{competition_id}/starter-agent")
def download_competition_starter_agent(
    competition_id: str,
    language: str = Query(default="python", pattern="^(python|javascript|typescript|nodejs|js|ts|py)$"),
    template: str = Query(default="blank", pattern="^(blank|arc|octos|codex|claude_code)$"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> Response:
    _require_competition_access(current_user, competition_id, db)
    service = RequirementCatalogService.for_catalog(db, "competition")
    if not any(competition.id == competition_id for competition in service.list_competitions()):
        raise HTTPException(status_code=404, detail=f"Competition '{competition_id}' not found")
    try:
        content, filename = AgentStarterService().build_bundle(task_type="web", language=language, template_kind=template)
    except (FileNotFoundError, RuntimeError, ValueError, subprocess.CalledProcessError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@competition_router.get("/{competition_id}", response_model=CompetitionDetail)
def get_competition(
    competition_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> CompetitionDetail:
    _require_competition_access(current_user, competition_id, db)
    service = RequirementCatalogService.for_catalog(db, "competition")
    try:
        return service.get_competition_detail(competition_id, str(request.base_url).rstrip("/"))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@competition_router.get("/public/download")
def download_public_competition(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> Response:
    # The aggregate archive contains every competition, including Hackathon.
    # Only a global grant may receive it.
    _require_competition_access(current_user, CompetitionAccessService.HACKATHON_ID, db)
    if not CompetitionAccessService(db).can_access(current_user, "*"):
        raise HTTPException(status_code=403, detail="A global competition grant is required for the full archive")
    service = RequirementCatalogService.for_catalog(db, "competition")
    content, filename = service.build_public_competition_bundle()
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@competition_router.get("/public/tasks/{requirement_id}/download/{download_kind}")
def download_public_task(
    requirement_id: str,
    download_kind: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> Response:
    _require_competition_access(current_user, _competition_id_for_requirement(requirement_id), db)
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
    template: str = Query(default="blank", pattern="^(blank|arc|octos|codex|claude_code)$"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> Response:
    if catalog == "competition":
        _require_competition_access(current_user, _competition_id_for_requirement(requirement_id), db)
    service = RequirementCatalogService.for_catalog(db, catalog)
    try:
        requirement = service.get_entry(requirement_id)
        task_type = requirement.category if catalog != "competition" else "web"
        content, filename = AgentStarterService().build_bundle(task_type=task_type, language=language, template_kind=template)
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


@router.get("/{requirement_id}/tests", response_model=RequirementTests)
def get_requirement_tests(
    requirement_id: str,
    catalog: str = Query(default="playground", pattern="^(playground|competition|benchmark)$"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> RequirementTests:
    if catalog == "competition":
        _require_competition_access(current_user, _competition_id_for_requirement(requirement_id), db)
    service = RequirementCatalogService.for_catalog(db, catalog)
    try:
        return service.get_requirement_tests(requirement_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{requirement_id}", response_model=RequirementDetail)
def get_requirement(
    requirement_id: str,
    request: Request,
    catalog: str = Query(default="playground", pattern="^(playground|competition|benchmark)$"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
) -> RequirementDetail:
    if catalog == "competition":
        _require_competition_access(current_user, _competition_id_for_requirement(requirement_id), db)
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
    current_user: User | None = Depends(get_current_user),
) -> PlainTextResponse:
    if catalog == "competition":
        _require_competition_access(current_user, _competition_id_for_requirement(requirement_id), db)
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
    current_user: User | None = Depends(get_current_user),
) -> FileResponse:
    if asset_kind not in {"assets", "references"}:
        raise HTTPException(status_code=404, detail="Unknown asset kind")
    if catalog == "competition":
        _require_competition_access(current_user, _competition_id_for_requirement(requirement_id), db)
    service = RequirementCatalogService.for_catalog(db, catalog)
    try:
        return FileResponse(service.get_asset_path(requirement_id, asset_kind, asset_path))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
