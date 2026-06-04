from pathlib import Path

import docker
from docker.errors import BuildError, DockerException, ImageNotFound

from app.core.config import get_settings


class DockerManager:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = docker.from_env()

    def ensure_image(self) -> None:
        try:
            self.client.images.get(self.settings.runner_image)
        except ImageNotFound:
            try:
                self.client.images.build(
                    path=str(self.settings.runner_context_dir),
                    tag=self.settings.runner_image,
                )
            except (BuildError, DockerException) as exc:
                raise RuntimeError(f"Failed to build runner image: {exc}") from exc

    def create_container(self, submission_id: str, workspace_path: str | Path):
        self.ensure_image()
        return self.client.containers.create(
            self.settings.runner_image,
            name=f"arcbench-{submission_id}",
            detach=True,
            environment={
                "SUBMISSION_ID": submission_id,
                "RUNNER_TIMEOUT_SECONDS": str(self.settings.runner_timeout_seconds),
                "AGENT_HEALTH_TIMEOUT_SECONDS": str(self.settings.agent_health_timeout_seconds),
            },
            volumes={str(Path(workspace_path).resolve()): {"bind": "/workspace", "mode": "rw"}},
            mem_limit=self.settings.runner_memory_limit,
            nano_cpus=self.settings.runner_cpu_limit * 1_000_000_000,
            user="1000:1000",
            working_dir="/workspace",
        )

    @staticmethod
    def start_container(container) -> None:
        container.start()

    @staticmethod
    def stop_container(container) -> None:
        container.stop(timeout=5)

    @staticmethod
    def remove_container(container) -> None:
        container.remove(force=True)

    @staticmethod
    def collect_logs(container) -> tuple[str, str]:
        stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
        stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
        return stdout, stderr

    @staticmethod
    def collect_result(workspace_path: str | Path) -> Path:
        return Path(workspace_path) / "artifacts" / "result.json"
