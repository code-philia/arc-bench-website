from functools import lru_cache
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[3]
load_dotenv(ROOT_DIR / ".env", override=False)


class Settings(BaseSettings):
    app_name: str = "ArcBench API"
    api_prefix: str = "/api"
    database_url: str = f"sqlite:///{(ROOT_DIR / 'runtime' / 'app.db').as_posix()}"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    frontend_dist: Path = ROOT_DIR / "frontend" / "dist"
    requirements_root: Path = ROOT_DIR / "arc-bench" / "webapp" / "requirements"
    tests_root: Path = ROOT_DIR / "arc-bench" / "webapp" / "tests"
    templates_root: Path = ROOT_DIR / "arc-bench" / "webapp" / "template"
    playground_requirements_root: Path = ROOT_DIR / "arc-bench-playground" / "webapp" / "requirements"
    playground_tests_root: Path = ROOT_DIR / "arc-bench-playground" / "webapp" / "tests"
    playground_templates_root: Path = ROOT_DIR / "arc-bench-playground" / "webapp" / "template"
    demo_agent_zip: Path = ROOT_DIR / "runtime" / "demo-agent.zip"
    agent_runtime_package_root: Path = ROOT_DIR / "packages" / "arcbench-agent-runtime"
    user_submissions_root: Path = ROOT_DIR / "runtime" / "user-submissions"
    user_tasks_root: Path = ROOT_DIR / "runtime" / "user-tasks"
    runner_context_dir: Path = ROOT_DIR / "backend" / "runner" / "agent-runner"
    runner_image: str = "arcbench-agent-runner:latest"
    builtin_openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY", "ARCBENCH_BUILTIN_OPENAI_API_KEY"),
    )
    builtin_openai_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "OPENAI_BASE_URL",
            "OPENAI_API_BASE_URL",
            "ARCBENCH_BUILTIN_OPENAI_BASE_URL",
            "ARCBENCH_BUILTIN_OPENAI_API_BASE_URL",
        ),
    )
    builtin_visual_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("VISUAL_API_KEY", "ARCBENCH_BUILTIN_VISUAL_API_KEY"),
    )
    builtin_visual_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("VISUAL_BASE_URL", "ARCBENCH_BUILTIN_VISUAL_BASE_URL"),
    )
    builtin_visual_model: str | None = Field(
        default=None,
        validation_alias=AliasChoices("VISUAL_MODEL", "ARCBENCH_BUILTIN_VISUAL_MODEL"),
    )
    builtin_model: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MODEL", "ARCBENCH_BUILTIN_MODEL"),
    )
    builtin_debug_mode: str = Field(
        default="0",
        validation_alias=AliasChoices("ARC_DEBUG", "DEBUG_MODE", "ARCBENCH_BUILTIN_DEBUG_MODE"),
    )
    session_secret: str = "arcbench-dev-session-secret"

    runner_cpu_limit: int = 2
    runner_memory_limit: str = "4g"
    runner_timeout_seconds: int = 1200
    agent_health_timeout_seconds: int = 90
    runner_network_mode: str | None = None
    runner_dns_servers: str | None = None
    runner_extra_hosts: str | None = None
    pip_index_url: str = "https://pypi.tuna.tsinghua.edu.cn/simple"
    pip_trusted_host: str = "pypi.tuna.tsinghua.edu.cn"
    pip_extra_index_url: str | None = None

    model_config = SettingsConfigDict(env_prefix="ARCBENCH_", case_sensitive=False, extra="ignore")

    @staticmethod
    def _split_csv(value: str | None) -> list[str]:
        if value is None:
            return []
        return [item.strip() for item in value.split(",") if item.strip()]

    def get_runner_dns_servers(self) -> list[str]:
        return self._split_csv(self.runner_dns_servers)

    def get_runner_extra_hosts(self) -> dict[str, str]:
        entries: dict[str, str] = {}
        for item in self._split_csv(self.runner_extra_hosts):
            host, separator, target = item.partition(":")
            normalized_host = host.strip()
            normalized_target = target.strip()
            if separator and normalized_host and normalized_target:
                entries[normalized_host] = normalized_target
        return entries


@lru_cache
def get_settings() -> Settings:
    return Settings()
