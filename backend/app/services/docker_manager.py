from pathlib import Path

import docker
from docker.errors import APIError, BuildError, DockerException, ImageNotFound, NotFound

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
        needs_build = False
        try:
            image = self.client.images.get(self.settings.runner_image)
            if self._is_image_stale(image):
                needs_build = True
                if log_callback is not None:
                    log_callback(f"Runner source newer than image, rebuilding: {self.settings.runner_image}")
            elif log_callback is not None:
                log_callback(f"Using existing runner image: {self.settings.runner_image}")
        except ImageNotFound:
            needs_build = True

        if not needs_build:
            return

        try:
            if log_callback is not None:
                log_callback(f"Building runner image: {self.settings.runner_image}")
            _, build_logs = self.client.images.build(
                path=str(self.settings.runner_context_dir.parents[2]),
                dockerfile=str(self.settings.runner_context_dir.relative_to(self.settings.runner_context_dir.parents[2]) / "Dockerfile"),
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

    def _is_image_stale(self, image) -> bool:
        source_paths = [
            self.settings.runner_context_dir / "run_submission.py",
            self.settings.runner_context_dir / "Dockerfile",
            self.settings.builtin_arc_agent_dist_dir / "arc_agent-0.1.0-py3-none-any.whl",
        ]
        if any(not path.exists() for path in source_paths):
            return False
        source_mtime = max(path.stat().st_mtime for path in source_paths)
        created_at = str(image.attrs.get("Created", ""))
        if not created_at:
            return False
        try:
            from datetime import datetime, timezone

            # Docker reports something like "2026-06-25T20:27:24.123456789Z".
            created_at_normalized = created_at.split(".")[0] + "+00:00" if created_at.endswith("Z") else created_at
            created_time = datetime.fromisoformat(created_at_normalized).astimezone(timezone.utc).timestamp()
            return source_mtime > created_time
        except Exception:  # noqa: BLE001
            return False

    def create_container(
        self,
        submission_id: str,
        workspace_path: str | Path,
        *,
        agent_source: str = "upload",
        github_email: str | None = None,
        github_username: str | None = None,
        log_callback=None,
    ):
        self.ensure_image(log_callback=log_callback)
        builtin_openai_base_url = self.settings.builtin_openai_base_url or self.settings.builtin_openai_api_base_url or ""
        builtin_openai_api_key = self.settings.builtin_openai_api_key or ""
        builtin_visual_api_key = self.settings.builtin_visual_api_key or builtin_openai_api_key
        builtin_visual_base_url = self.settings.builtin_visual_base_url or builtin_openai_base_url
        environment = {
            "SUBMISSION_ID": submission_id,
            "RUNNER_TIMEOUT_SECONDS": str(self.settings.runner_timeout_seconds),
            "AGENT_HEALTH_TIMEOUT_SECONDS": str(self.settings.agent_health_timeout_seconds),
            "OPENAI_API_KEY": builtin_openai_api_key,
            "OPENAI_BASE_URL": builtin_openai_base_url,
            "OPENAI_API_BASE_URL": builtin_openai_base_url,
            "VISUAL_API_KEY": builtin_visual_api_key,
            "VISUAL_BASE_URL": builtin_visual_base_url,
            "VISUAL_MODEL": self.settings.builtin_visual_model or "",
            "ARC_DEBUG": str(self.settings.builtin_debug_mode),
        }
        if agent_source == "builtin_arc_agent":
            if github_email and github_email.strip():
                environment["ARC_GIT_USER_EMAIL"] = github_email.strip()
            if github_username and github_username.strip():
                environment["ARC_GIT_USER_NAME"] = github_username.strip()
        return self.client.containers.create(
            self.settings.runner_image,
            name=f"arcbench-{submission_id}",
            detach=True,
            environment=environment,
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
    def kill_container_process(container, *, signal_name: str = "SIGTERM") -> None:
        container.kill(signal=signal_name)

    @staticmethod
    def remove_container(container) -> None:
        container.remove(force=True)

    def remove_submission_container(self, submission_id: str) -> bool:
        container_name = f"arcbench-{submission_id}"
        try:
            container = self.client.containers.get(container_name)
        except NotFound:
            return False
        container.remove(force=True)
        return True

    @staticmethod
    def collect_logs(container) -> tuple[str, str]:
        stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
        stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
        return stdout, stderr

    @staticmethod
    def exec(container, command: list[str], workdir: str = "/workspace") -> tuple[int, str]:
        result = container.exec_run(command, workdir=workdir, stdout=True, stderr=True)
        output = result.output.decode("utf-8", errors="replace") if isinstance(result.output, (bytes, bytearray)) else str(result.output)
        return int(result.exit_code), output

    @staticmethod
    def kill_agent_process(container, *, signal_name: str = "TERM") -> tuple[int, str]:
        # Target the user-uploaded main.py process or the built-in arc-agent CLI
        # without touching run_submission.py itself.
        return DockerManager.exec(container, ["pkill", f"-{signal_name}", "-f", "main.py|arc-agent"])

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
