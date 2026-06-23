from pathlib import Path

import docker
from docker.errors import APIError, BuildError, DockerException, ImageNotFound

from app.core.config import get_settings


class DockerManager:
    def __init__(self) -> None:
        self.settings = get_settings()
        try:
            self.client = docker.from_env()
            self.client.ping()
        except DockerException as exc:
            raise RuntimeError(self._format_daemon_error(exc)) from exc

    def ensure_image(self, log_callback=None) -> None:
        try:
            self.client.images.get(self.settings.runner_image)
            if log_callback is not None:
                log_callback(f"Using existing runner image: {self.settings.runner_image}")
            return
        except ImageNotFound:
            pass

        try:
            if log_callback is not None:
                log_callback(f"Building runner image: {self.settings.runner_image}")
            _, build_logs = self.client.images.build(
                path=str(self.settings.runner_context_dir),
                tag=self.settings.runner_image,
                rm=True,
                pull=False,
                nocache=False,
                forcerm=True,
            )
            if log_callback is not None:
                for entry in build_logs:
                    line = self._stringify_build_log_entry(entry)
                    if line:
                        log_callback(line)
        except BuildError as exc:
            if log_callback is not None:
                for entry in getattr(exc, "build_log", []) or []:
                    line = self._stringify_build_log_entry(entry)
                    if line:
                        log_callback(line)
            raise RuntimeError(self._format_build_error(exc)) from exc
        except DockerException as exc:
            raise RuntimeError(self._format_docker_api_error("Failed to build runner image", exc)) from exc

    def create_container(self, submission_id: str, workspace_path: str | Path, log_callback=None):
        self.ensure_image(log_callback=log_callback)
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

    @staticmethod
    def _format_daemon_error(exc: DockerException) -> str:
        message = str(exc)
        lowered = message.lower()
        if "pipe/docker_engine" in lowered or "docker desktop" in lowered:
            return "Docker daemon is unavailable. Start Docker Desktop and make sure the backend process can access the Docker engine."
        if "/var/run/docker.sock" in lowered or "permission denied" in lowered:
            return "Docker daemon is unavailable. Make sure the Docker service is running and the current user has permission to access the Docker socket."
        return f"Docker daemon is unavailable: {message}"

    @staticmethod
    def _format_build_error(exc: BuildError) -> str:
        message = str(exc)
        lowered = message.lower()
        if "failed to resolve reference" in lowered and "not found" in lowered:
            return f"Failed to build runner image. The configured base image tag could not be found: {message}"
        return f"Failed to build runner image: {message}"

    @staticmethod
    def _format_docker_api_error(prefix: str, exc: DockerException) -> str:
        message = str(exc)
        if isinstance(exc, APIError):
            return f"{prefix}. Docker API error: {message}"
        return f"{prefix}: {message}"

    @staticmethod
    def _stringify_build_log_entry(entry: dict) -> str:
        stream = entry.get("stream")
        if stream:
            return stream.strip()
        error = entry.get("error") or entry.get("errorDetail", {}).get("message")
        if error:
            return f"ERROR: {error}"
        status = entry.get("status")
        progress = entry.get("progress")
        identifier = entry.get("id")
        if status:
            parts = [status]
            if identifier:
                parts.append(identifier)
            if progress:
                parts.append(progress)
            return " ".join(parts).strip()
        return ""
