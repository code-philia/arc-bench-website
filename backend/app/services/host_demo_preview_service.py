from __future__ import annotations

import atexit
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path
from shutil import which
from urllib.error import URLError
from urllib.request import urlopen

from app.core.config import ROOT_DIR


class HostDemoPreviewService:
    PREVIEW_ROOT = ROOT_DIR / "runtime" / "host-preview" / "ticketbooking"
    FRONTEND_DIR = PREVIEW_ROOT / "frontend"
    BACKEND_DIR = PREVIEW_ROOT / "backend"
    HEALTH_URL = "http://127.0.0.1:3000/api/health"
    PREVIEW_URL = "http://1.95.169.80:3001"
    LOG_DIR = ROOT_DIR / "runtime" / "host-preview"
    BACKEND_LOG_PATH = LOG_DIR / "preview-backend.log"

    _lock = threading.Lock()
    _backend_process: subprocess.Popen[str] | None = None
    _bootstrap_error: str | None = None
    _current_submission_id: str | None = None
    _current_workspace_head_oid: str | None = None

    @classmethod
    def get_status(
        cls,
        *,
        submission_id: str,
        workspace_head_oid: str | None,
        error: str | None = None,
    ) -> dict[str, bool | str | None]:
        available = cls._check_health() and cls._current_submission_id == submission_id
        stale = bool(available and workspace_head_oid and cls._current_workspace_head_oid and workspace_head_oid != cls._current_workspace_head_oid)
        combined_error = error or cls.last_error()
        if not available and not combined_error:
            combined_error = "Preview is not running for this submission"
        return {
            "available": available,
            "stale": stale,
            "workspace_head_oid": workspace_head_oid,
            "preview_head_oid": cls._current_workspace_head_oid,
            "error": combined_error,
        }

    @classmethod
    def refresh(
        cls,
        *,
        submission_id: str,
        source_template_dir: Path,
        workspace_head_oid: str | None,
    ) -> dict[str, bool | str | None]:
        try:
            cls._sync_template(source_template_dir)
            cls._build_frontend()
            cls._restart_backend()
            if not cls._wait_until_ready(120):
                raise RuntimeError(cls.last_error() or "Preview backend did not become ready in time")
            with cls._lock:
                cls._current_submission_id = submission_id
                cls._current_workspace_head_oid = workspace_head_oid
                cls._bootstrap_error = None
        except Exception as exc:  # noqa: BLE001
            with cls._lock:
                cls._bootstrap_error = str(exc)
            return {
                "available": False,
                "stale": False,
                "workspace_head_oid": workspace_head_oid,
                "preview_head_oid": cls._current_workspace_head_oid,
                "error": str(exc),
            }
        return cls.get_status(submission_id=submission_id, workspace_head_oid=workspace_head_oid)

    @classmethod
    def ensure_ready(cls, timeout_seconds: int = 120) -> bool:
        return cls._wait_until_ready(timeout_seconds)

    @classmethod
    def mark_stale(cls, submission_id: str) -> None:
        with cls._lock:
            if cls._current_submission_id == submission_id:
                cls._bootstrap_error = None

    @classmethod
    def preview_url(cls) -> str:
        return cls.PREVIEW_URL

    @classmethod
    def last_error(cls) -> str | None:
        with cls._lock:
            return cls._bootstrap_error

    @classmethod
    def _sync_template(cls, source_template_dir: Path) -> None:
        if not source_template_dir.is_dir():
            raise RuntimeError(f"Preview template directory not found: {source_template_dir}")
        cls.LOG_DIR.mkdir(parents=True, exist_ok=True)
        if cls.PREVIEW_ROOT.exists():
            shutil.rmtree(cls.PREVIEW_ROOT)
        shutil.copytree(
            source_template_dir,
            cls.PREVIEW_ROOT,
            ignore=shutil.ignore_patterns(".git", "node_modules", "dist", "coverage", ".cache"),
        )

    @classmethod
    def _build_frontend(cls) -> None:
        if not cls.FRONTEND_DIR.exists():
            raise RuntimeError(f"Preview frontend directory not found: {cls.FRONTEND_DIR}")
        subprocess.run(
            [cls._npm_executable(), "install"],
            cwd=str(cls.FRONTEND_DIR),
            check=True,
        )
        subprocess.run(
            [cls._npm_executable(), "run", "build"],
            cwd=str(cls.FRONTEND_DIR),
            check=True,
        )

    @classmethod
    def _restart_backend(cls) -> None:
        cls.stop_backend()
        if not cls.BACKEND_DIR.exists():
            raise RuntimeError(f"Preview backend directory not found: {cls.BACKEND_DIR}")
        subprocess.run(
            [cls._npm_executable(), "install", "--omit=dev"],
            cwd=str(cls.BACKEND_DIR),
            check=True,
        )
        env = {
            **os.environ,
            "HOST": "127.0.0.1",
            "PORT": "3000",
        }
        cls.LOG_DIR.mkdir(parents=True, exist_ok=True)
        log_handle = cls.BACKEND_LOG_PATH.open("w", encoding="utf-8")
        cls._backend_process = subprocess.Popen(
            [cls._npm_executable(), "run", "start"],
            cwd=str(cls.BACKEND_DIR),
            env=env,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            text=True,
        )

    @staticmethod
    def _npm_executable() -> str:
        candidates = ["npm.cmd", "npm.exe", "npm"] if os.name == "nt" else ["npm", "npm.cmd"]
        for candidate in candidates:
            if which(candidate):
                return candidate
        raise RuntimeError("npm executable was not found in PATH")

    @classmethod
    def _wait_until_ready(cls, timeout_seconds: int) -> bool:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            if cls._check_health():
                return True
            process = cls._backend_process
            if process is not None and process.poll() is not None:
                with cls._lock:
                    cls._bootstrap_error = cls._format_backend_exit_error(process.returncode)
                return False
            time.sleep(1)
        with cls._lock:
            cls._bootstrap_error = "Preview backend did not become ready before timeout"
        return False

    @classmethod
    def _format_backend_exit_error(cls, return_code: int | None) -> str:
        message = f"Preview backend exited with code {return_code}"
        if cls.BACKEND_LOG_PATH.exists():
            try:
                lines = cls.BACKEND_LOG_PATH.read_text(encoding="utf-8", errors="replace").splitlines()
            except OSError:
                return message
            tail = " | ".join(line.strip() for line in lines[-10:] if line.strip())
            if tail:
                return f"{message}: {tail}"
        return message

    @classmethod
    def _check_health(cls) -> bool:
        try:
            with urlopen(cls.HEALTH_URL, timeout=2) as response:
                return response.status == 200
        except (URLError, TimeoutError, OSError):
            return False

    @classmethod
    def stop_backend(cls) -> None:
        with cls._lock:
            process = cls._backend_process
            if process is None or process.poll() is not None:
                cls._backend_process = None
                return
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
            cls._backend_process = None


atexit.register(HostDemoPreviewService.stop_backend)
