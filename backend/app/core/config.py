from functools import lru_cache
import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
import yaml


ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    app_name: str = "ArcBench API"
    api_prefix: str = "/api"
    # Deliberately empty: production must explicitly configure PostgreSQL.
    database_url: str = ""
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    frontend_dist: Path = ROOT_DIR / "frontend" / "dist"
    site_assets_root: Path = ROOT_DIR / "assets"
    host_preview_host: str = "127.0.0.1"
    host_preview_port: int = 3000
    host_preview_public_url: str | None = None
    data_root: Path = ROOT_DIR / "data"
    arc_bench_root: Path = data_root / "arc-bench"
    playground_root: Path = data_root / "playground"
    competition_root: Path = data_root / "competition"
    arc_template_root: Path = ROOT_DIR / "arc-template" / "templates"
    web_template_files_root: Path = arc_template_root / "web-react-express"
    mobile_template_files_root: Path = arc_template_root / "mobile-android-java"
    cli_template_files_root: Path = arc_template_root / "cli-python"
    requirements_root: Path = arc_bench_root / "web"
    tests_root: Path = arc_bench_root / "web"
    playground_requirements_root: Path = playground_root / "web"
    playground_tests_root: Path = playground_root / "web"
    demo_agent_zip: Path = ROOT_DIR / "runtime" / "demo-agent.zip"
    reference_implementations_root: Path = ROOT_DIR / "reference-implementations"
    builtin_arc_agent_source_dir: Path = ROOT_DIR / "reference-implementations" / "arc" / "src"
    agent_reference_arc_root: Path = ROOT_DIR / "reference-implementations" / "arc"
    agent_reference_octos_root: Path = ROOT_DIR / "reference-implementations" / "octos"
    agent_reference_codex_root: Path = ROOT_DIR / "reference-implementations" / "codex"
    agent_reference_claude_code_root: Path = ROOT_DIR / "reference-implementations" / "claude-code"
    agent_starter_template_root: Path = ROOT_DIR / "packages"
    agent_runtime_package_root: Path = ROOT_DIR / "packages" / "shared" / "arcbench-agent-runtime"
    agent_skills_package_root: Path = ROOT_DIR / "packages" / "shared" / "skills"
    user_submissions_root: Path = ROOT_DIR / "runtime" / "user-submissions"
    user_tasks_root: Path = ROOT_DIR / "runtime" / "user-tasks"
    runner_context_dir: Path = ROOT_DIR
    runner_dockerfile: str = "backend/runner/Dockerfile"
    runner_image: str = "arcbench-runner:latest"
    runner_build_on_demand: bool = False
    runtime_config_path: Path = ROOT_DIR / "config.yaml"
    beta_invite_codes_path: Path = ROOT_DIR / "data" / "beta-invite-codes.yaml"
    session_secret: str = "arcbench-dev-session-secret"
    secure_cookies: bool = False
    redis_url: str = "redis://127.0.0.1:6379/0"
    worker_soft_time_limit_seconds: int = 1900
    worker_hard_time_limit_seconds: int = 2000
    max_concurrent_runs: int = 4
    recovery_interval_seconds: int = 30
    recovery_max_attempts: int = 3

    runner_cpu_limit: int = 2
    runner_memory_limit: str = "4g"
    runner_timeout_seconds: int = 0
    agent_health_timeout_seconds: int = 90
    runner_network_mode: str | None = None
    runner_extra_hosts: str | None = None
    pip_index_url: str = "https://pypi.tuna.tsinghua.edu.cn/simple"
    pip_trusted_host: str = "pypi.tuna.tsinghua.edu.cn"
    # pip treats index URLs as a combined candidate pool. Keep the regional mirror
    # as the primary source and include PyPI for packages not mirrored there.
    # Multiple extra indexes may be supplied as a comma- or whitespace-separated list.
    pip_extra_index_url: str | None = "https://pypi.org/simple"

    model_config = SettingsConfigDict(env_prefix="ARCBENCH_", case_sensitive=False, extra="ignore")

    @staticmethod
    def _split_csv(value: str | None) -> list[str]:
        if value is None:
            return []
        return [item.strip() for item in value.split(",") if item.strip()]

    def get_runner_extra_hosts(self) -> dict[str, str]:
        entries: dict[str, str] = {}
        for item in self._split_csv(self.runner_extra_hosts):
            host, separator, target = item.partition(":")
            normalized_host = host.strip()
            normalized_target = target.strip()
            if separator and normalized_host and normalized_target:
                entries[normalized_host] = normalized_target
        return entries

    def get_pip_extra_index_urls(self) -> list[str]:
        value = (self.pip_extra_index_url or "").replace(",", " ")
        return [item.strip() for item in value.split() if item.strip()]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Environment variables remain the highest-priority production override.
    # For a single-host deployment, config.yaml can provide the database URL.
    environment_url = os.environ.get("ARCBENCH_DATABASE_URL", "").strip()
    if environment_url:
        return settings.model_copy(update={"database_url": _require_postgresql_url(environment_url)})

    config_path = settings.runtime_config_path
    if not config_path.is_file():
        raise RuntimeError(
            "PostgreSQL configuration is missing. Set ARCBENCH_DATABASE_URL "
            "or add database_url to config.yaml. SQLite is disabled."
        )
    try:
        payload = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as exc:
        raise RuntimeError(f"Application configuration is invalid: {config_path}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Application configuration must be a YAML mapping: {config_path}")
    database_url = str(payload.get("database_url") or "").strip()
    if not database_url:
        raise RuntimeError(
            f"PostgreSQL database_url is missing from {config_path}. "
            "Set ARCBENCH_DATABASE_URL or add database_url to config.yaml. "
            "SQLite is disabled."
        )
    return settings.model_copy(update={"database_url": _require_postgresql_url(database_url)})


def _require_postgresql_url(value: str) -> str:
    """Validate that the configured URL targets PostgreSQL, never SQLite."""
    try:
        url = make_url(value)
    except Exception as exc:  # SQLAlchemy raises multiple URL-specific exceptions.
        raise RuntimeError("Invalid database URL. Expected a PostgreSQL URL.") from exc
    if url.get_backend_name() != "postgresql":
        raise RuntimeError(
            "ARC-Bench requires PostgreSQL. Configure a postgresql+psycopg:// "
            "URL via ARCBENCH_DATABASE_URL or config.yaml; SQLite is disabled."
        )
    if not url.database:
        raise RuntimeError("PostgreSQL database URL must include a database name.")
    return value
