from __future__ import annotations

import atexit
import subprocess
import threading
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from app.core.config import ROOT_DIR


class HostDemoPreviewService:
    DEMO_ROOT = ROOT_DIR / "runtime" / "demo" / "12306"
    FRONTEND_DIR = DEMO_ROOT / "frontend"
    BACKEND_DIR = DEMO_ROOT / "backend"
    HEALTH_URL = "http://127.0.0.1:3000/api/health"
    PREVIEW_URL = "http://127.0.0.1:3000"

    _lock = threading.Lock()
    _backend_process: subprocess.Popen[str] | None = None

    @classmethod
    def ensure_ready(cls, timeout_seconds: int = 120) -> bool:
        with cls._lock:
            try:
                cls._build_frontend()
                if cls._is_backend_running():
                    return True
                cls._start_backend()
            except Exception:
                return False

        return cls._wait_until_ready(timeout_seconds)

    @classmethod
    def preview_url(cls) -> str:
        return cls.PREVIEW_URL

    @classmethod
    def _build_frontend(cls) -> None:
        if not cls.FRONTEND_DIR.exists():
            raise RuntimeError(f"Demo frontend directory not found: {cls.FRONTEND_DIR}")
        subprocess.run(
            ["npm.cmd", "run", "build"],
            cwd=str(cls.FRONTEND_DIR),
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    @classmethod
    def _start_backend(cls) -> None:
        if not cls.BACKEND_DIR.exists():
            raise RuntimeError(f"Demo backend directory not found: {cls.BACKEND_DIR}")
        env = {
            **__import__("os").environ,
            "HOST": "127.0.0.1",
            "PORT": "3000",
        }
        cls._backend_process = subprocess.Popen(
            ["npm.cmd", "run", "dev"],
            cwd=str(cls.BACKEND_DIR),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            text=True,
        )

    @classmethod
    def _is_backend_running(cls) -> bool:
        process = cls._backend_process
        if process is not None and process.poll() is None and cls._check_health():
            return True
        return cls._check_health()

    @classmethod
    def _wait_until_ready(cls, timeout_seconds: int) -> bool:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            if cls._check_health():
                return True
            time.sleep(1)
        return False

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
