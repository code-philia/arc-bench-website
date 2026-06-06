from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    app_name: str = "ArcBench API"
    api_prefix: str = "/api"
    database_url: str = f"sqlite:///{(ROOT_DIR / 'runtime' / 'app.db').as_posix()}"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    frontend_dist: Path = ROOT_DIR / "frontend" / "dist"
    requirements_root: Path = ROOT_DIR / "arc-bench" / "webapp" / "requirements"
    tests_root: Path = ROOT_DIR / "arc-bench" / "webapp" / "tests"
    submissions_root: Path = ROOT_DIR / "runtime" / "submissions"
    workspaces_root: Path = ROOT_DIR / "runtime" / "workspaces"
    artifacts_root: Path = ROOT_DIR / "runtime" / "artifacts"
    runner_context_dir: Path = ROOT_DIR / "backend" / "runner" / "agent-runner"
    runner_image: str = "arcbench-agent-runner:latest"
    session_secret: str = "arcbench-dev-session-secret"

    runner_cpu_limit: int = 2
    runner_memory_limit: str = "4g"
    runner_timeout_seconds: int = 600
    agent_health_timeout_seconds: int = 90

    model_config = SettingsConfigDict(env_prefix="ARCBENCH_", case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()
