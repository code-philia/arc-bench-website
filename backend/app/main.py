from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, requirements, submissions
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.services.requirement_catalog import RequirementCatalogService


settings = get_settings()

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(requirements.router, prefix=settings.api_prefix)
app.include_router(submissions.router, prefix=settings.api_prefix)


@app.on_event("startup")
def on_startup() -> None:
    settings.submissions_root.mkdir(parents=True, exist_ok=True)
    settings.workspaces_root.mkdir(parents=True, exist_ok=True)
    settings.artifacts_root.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        RequirementCatalogService(db).sync()
    finally:
        db.close()
