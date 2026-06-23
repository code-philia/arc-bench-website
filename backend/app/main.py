from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.routes import auth, health, requirements, submissions, user_tasks
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine


settings = get_settings()
api_path_prefix = settings.api_prefix.strip("/")

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(requirements.router, prefix=settings.api_prefix)
app.include_router(requirements.competition_router, prefix=settings.api_prefix)
app.include_router(submissions.router, prefix=settings.api_prefix)
app.include_router(user_tasks.router, prefix=settings.api_prefix)


@app.on_event("startup")
def on_startup() -> None:
    settings.user_submissions_root.mkdir(parents=True, exist_ok=True)
    settings.user_tasks_root.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)


def _frontend_index() -> Path:
    return settings.frontend_dist / "index.html"


def _resolve_frontend_path(full_path: str) -> Path | None:
    candidate = (settings.frontend_dist / full_path).resolve()
    try:
        candidate.relative_to(settings.frontend_dist.resolve())
    except ValueError:
        return None
    return candidate


@app.get("/", include_in_schema=False)
def serve_frontend_index() -> FileResponse:
    index_file = _frontend_index()
    if not index_file.is_file():
        raise HTTPException(status_code=404, detail="Frontend build not found")
    return FileResponse(index_file)


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str) -> FileResponse:
    if api_path_prefix and (full_path == api_path_prefix or full_path.startswith(f"{api_path_prefix}/")):
        raise HTTPException(status_code=404, detail="API route not found")

    requested_file = _resolve_frontend_path(full_path)
    if requested_file and requested_file.is_file():
        return FileResponse(requested_file)

    index_file = _frontend_index()
    if index_file.is_file():
        return FileResponse(index_file)

    raise HTTPException(status_code=404, detail="Frontend build not found")
