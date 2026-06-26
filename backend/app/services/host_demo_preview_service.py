from __future__ import annotations

import atexit
import hashlib
import json
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
from app.services.debug_log_service import DebugLogService


class HostDemoPreviewService:
    PREVIEW_ROOT = ROOT_DIR / "runtime" / "host-preview" / "ticketbooking"
    FRONTEND_DIR = PREVIEW_ROOT / "frontend"
    BACKEND_DIR = PREVIEW_ROOT / "backend"
    HEALTH_URL = "http://127.0.0.1:3000/api/health"
    PREVIEW_URL = "http://127.0.0.1:3000"
    LOG_DIR = ROOT_DIR / "runtime" / "host-preview"
    BACKEND_LOG_PATH = LOG_DIR / "preview-backend.log"
    STATE_PATH = LOG_DIR / "preview-state.json"
    SYNC_IGNORE_NAMES = {
        ".git",
        "node_modules",
        "dist",
        "coverage",
        ".cache",
        ".vite",
        # Preserve host-side runtime SQLite files during refresh/rewind.
        "database.db",
        "database.db-wal",
        "database.db-shm",
        "database.db-journal",
    }

    _lock = threading.Lock()
    _backend_process: subprocess.Popen[str] | None = None
    _backend_log_handle = None
    _backend_log_thread: threading.Thread | None = None
    _bootstrap_error: str | None = None
    _current_submission_id: str | None = None
    _current_workspace_head_oid: str | None = None
    _active_debug_log: DebugLogService | None = None

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
        debug_log: DebugLogService | None = None,
    ) -> dict[str, bool | str | None]:
        if debug_log is not None:
            cls._active_debug_log = debug_log
        cls._append_debug(
            f"Refresh requested for submission={submission_id}, source_template_dir={source_template_dir}, workspace_head_oid={workspace_head_oid}"
        )
        try:
            previous_state = cls._load_state()
            current_state = cls._collect_source_state(source_template_dir)
            cls._sync_template(source_template_dir)
            frontend_install_required = cls._should_install(
                previous_state.get("frontend_lock_hash"),
                current_state["frontend_lock_hash"],
                cls.FRONTEND_DIR / "node_modules",
            )
            backend_install_required = cls._should_install(
                previous_state.get("backend_lock_hash"),
                current_state["backend_lock_hash"],
                cls.BACKEND_DIR / "node_modules",
            )
            frontend_build_required = (
                frontend_install_required
                or previous_state.get("frontend_source_hash") != current_state["frontend_source_hash"]
                or not (cls.BACKEND_DIR / "dist" / "index.html").exists()
            )
            backend_restart_required = (
                backend_install_required
                or previous_state.get("backend_source_hash") != current_state["backend_source_hash"]
                or not cls._is_backend_running()
            )
            if not backend_restart_required and not cls._check_health():
                cls._append_debug("Backend process exists but health check failed; forcing restart")
                backend_restart_required = True

            cls._append_debug(
                "Refresh plan: "
                f"frontend_install_required={frontend_install_required}, "
                f"backend_install_required={backend_install_required}, "
                f"frontend_build_required={frontend_build_required}, "
                f"backend_restart_required={backend_restart_required}"
            )

            if frontend_install_required:
                cls._install_frontend()
            else:
                cls._append_debug("Skipping frontend npm install; lockfile unchanged and node_modules exists")

            if backend_install_required:
                cls._install_backend()
            else:
                cls._append_debug("Skipping backend npm install; lockfile unchanged and node_modules exists")

            if frontend_build_required:
                cls._build_frontend()
            else:
                cls._append_debug("Skipping frontend build; source hash unchanged and dist/index.html already exists")

            if backend_restart_required:
                cls._restart_backend()
            else:
                cls._append_debug("Skipping backend restart; backend source unchanged and process is healthy")

            if not cls._wait_until_ready(120):
                raise RuntimeError(cls.last_error() or "Preview backend did not become ready in time")
            cls._save_state(current_state)
            with cls._lock:
                cls._current_submission_id = submission_id
                cls._current_workspace_head_oid = workspace_head_oid
                cls._bootstrap_error = None
            cls._append_debug(f"Refresh completed successfully; preview url={cls.PREVIEW_URL}")
        except Exception as exc:  # noqa: BLE001
            with cls._lock:
                cls._bootstrap_error = str(exc)
            cls._append_debug(f"Refresh failed: {exc}")
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
        cls._append_debug(f"Marked preview stale for submission={submission_id}")

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
        cls.PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
        cls._append_debug(f"Incrementally syncing preview template from {source_template_dir} to {cls.PREVIEW_ROOT}")
        cls._sync_tree(source_template_dir, cls.PREVIEW_ROOT)
        cls._append_debug("Template sync completed")

    @classmethod
    def _install_frontend(cls) -> None:
        if not cls.FRONTEND_DIR.exists():
            raise RuntimeError(f"Preview frontend directory not found: {cls.FRONTEND_DIR}")
        npm = cls._npm_executable()
        cls._append_debug(f"Preview frontend directory ready: {cls.FRONTEND_DIR}")
        cls._run_command([npm, "install"], cwd=cls.FRONTEND_DIR, label="frontend npm install")

    @classmethod
    def _build_frontend(cls) -> None:
        if not cls.FRONTEND_DIR.exists():
            raise RuntimeError(f"Preview frontend directory not found: {cls.FRONTEND_DIR}")
        npm = cls._npm_executable()
        cls._run_command([npm, "run", "build"], cwd=cls.FRONTEND_DIR, label="frontend npm run build")

    @classmethod
    def _install_backend(cls) -> None:
        if not cls.BACKEND_DIR.exists():
            raise RuntimeError(f"Preview backend directory not found: {cls.BACKEND_DIR}")
        npm = cls._npm_executable()
        cls._append_debug(f"Preview backend directory ready: {cls.BACKEND_DIR}")
        cls._run_command([npm, "install", "--omit=dev"], cwd=cls.BACKEND_DIR, label="backend npm install --omit=dev")

    @classmethod
    def _restart_backend(cls) -> None:
        cls.stop_backend()
        if not cls.BACKEND_DIR.exists():
            raise RuntimeError(f"Preview backend directory not found: {cls.BACKEND_DIR}")
        npm = cls._npm_executable()
        env = {
            **os.environ,
            "HOST": "127.0.0.1",
            "PORT": "3000",
        }
        cls.LOG_DIR.mkdir(parents=True, exist_ok=True)
        log_handle = cls.BACKEND_LOG_PATH.open("w", encoding="utf-8")
        cls._backend_log_handle = log_handle
        cls._append_debug(f"Starting preview backend with HOST={env['HOST']} PORT={env['PORT']}")
        cls._backend_process = subprocess.Popen(
            [npm, "run", "start"],
            cwd=str(cls.BACKEND_DIR),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        cls._backend_log_thread = threading.Thread(
            target=cls._stream_backend_logs,
            args=(cls._backend_process, log_handle),
            daemon=True,
        )
        cls._backend_log_thread.start()
        cls._append_debug(f"Preview backend process started with pid={cls._backend_process.pid}")

    @classmethod
    def _run_command(cls, command: list[str], *, cwd: Path, label: str) -> None:
        cls._append_debug(f"Executing {label}: {' '.join(command)} (cwd={cwd})")
        completed = subprocess.run(
            command,
            cwd=str(cwd),
            check=False,
            capture_output=True,
            text=True,
        )
        stdout = (completed.stdout or "").strip()
        stderr = (completed.stderr or "").strip()
        if stdout:
            for line in stdout.splitlines():
                cls._append_debug(f"{label}.stdout | {line}")
        if stderr:
            for line in stderr.splitlines():
                cls._append_debug(f"{label}.stderr | {line}")
        cls._append_debug(f"{label} exit code: {completed.returncode}")
        if completed.returncode != 0:
            raise RuntimeError(f"{label} failed with exit code {completed.returncode}")

    @classmethod
    def _stream_backend_logs(cls, process: subprocess.Popen[str], log_handle) -> None:
        try:
            if process.stdout is None:
                return
            for line in process.stdout:
                log_handle.write(line)
                log_handle.flush()
                stripped = line.rstrip()
                if stripped:
                    cls._append_debug(f"backend.stdout | {stripped}")
        finally:
            try:
                if process.stdout is not None:
                    process.stdout.close()
            except OSError:
                pass
            try:
                log_handle.flush()
                log_handle.close()
            except OSError:
                pass

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
        cls._append_debug(f"Waiting for preview health at {cls.HEALTH_URL} with timeout={timeout_seconds}s")
        while time.time() < deadline:
            if cls._check_health():
                cls._append_debug("Preview health check succeeded")
                return True
            process = cls._backend_process
            if process is not None and process.poll() is not None:
                with cls._lock:
                    cls._bootstrap_error = cls._format_backend_exit_error(process.returncode)
                cls._append_debug(f"Preview backend exited before becoming ready: {cls._bootstrap_error}")
                return False
            time.sleep(1)
        with cls._lock:
            cls._bootstrap_error = "Preview backend did not become ready before timeout"
        cls._append_debug(cls._bootstrap_error)
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
                if cls._backend_log_handle is not None:
                    try:
                        cls._backend_log_handle.close()
                    except OSError:
                        pass
                    cls._backend_log_handle = None
                return
            cls._append_debug("Stopping existing preview backend process")
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                cls._append_debug("Preview backend did not stop after terminate; killing process")
                process.kill()
            cls._backend_process = None
            cls._backend_log_handle = None

    @classmethod
    def _append_debug(cls, message: str) -> None:
        debug_log = cls._active_debug_log
        if debug_log is None:
            return
        debug_log.append("preview", message)

    @classmethod
    def _should_install(cls, previous_lock_hash: object, current_lock_hash: str | None, node_modules_dir: Path) -> bool:
        if current_lock_hash is None:
            return False
        if not node_modules_dir.exists():
            return True
        return previous_lock_hash != current_lock_hash

    @classmethod
    def _is_backend_running(cls) -> bool:
        process = cls._backend_process
        return process is not None and process.poll() is None

    @classmethod
    def _load_state(cls) -> dict[str, str | None]:
        if not cls.STATE_PATH.exists():
            return {}
        try:
            payload = json.loads(cls.STATE_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        if not isinstance(payload, dict):
            return {}
        return {
            "frontend_lock_hash": cls._coerce_state_value(payload.get("frontend_lock_hash")),
            "backend_lock_hash": cls._coerce_state_value(payload.get("backend_lock_hash")),
            "frontend_source_hash": cls._coerce_state_value(payload.get("frontend_source_hash")),
            "backend_source_hash": cls._coerce_state_value(payload.get("backend_source_hash")),
        }

    @classmethod
    def _save_state(cls, state: dict[str, str | None]) -> None:
        cls.LOG_DIR.mkdir(parents=True, exist_ok=True)
        cls.STATE_PATH.write_text(json.dumps(state, ensure_ascii=True, indent=2), encoding="utf-8")
        cls._append_debug(f"Saved preview state to {cls.STATE_PATH}")

    @staticmethod
    def _coerce_state_value(value: object) -> str | None:
        return value if isinstance(value, str) else None

    @classmethod
    def _collect_source_state(cls, source_template_dir: Path) -> dict[str, str | None]:
        frontend_source_dir = source_template_dir / "frontend"
        backend_source_dir = source_template_dir / "backend"
        state = {
            "frontend_lock_hash": cls._file_hash(frontend_source_dir / "package-lock.json") or cls._file_hash(frontend_source_dir / "package.json"),
            "backend_lock_hash": cls._file_hash(backend_source_dir / "package-lock.json") or cls._file_hash(backend_source_dir / "package.json"),
            "frontend_source_hash": cls._tree_hash(frontend_source_dir),
            "backend_source_hash": cls._tree_hash(backend_source_dir),
        }
        cls._append_debug(
            "Collected source state: "
            f"frontend_lock_hash={state['frontend_lock_hash']}, "
            f"backend_lock_hash={state['backend_lock_hash']}, "
            f"frontend_source_hash={state['frontend_source_hash']}, "
            f"backend_source_hash={state['backend_source_hash']}"
        )
        return state

    @classmethod
    def _sync_tree(cls, source_dir: Path, destination_dir: Path) -> None:
        destination_dir.mkdir(parents=True, exist_ok=True)
        source_names = {child.name for child in source_dir.iterdir() if child.name not in cls.SYNC_IGNORE_NAMES}
        destination_names = {child.name for child in destination_dir.iterdir()}

        for extra_name in sorted(destination_names - source_names):
            if extra_name in cls.SYNC_IGNORE_NAMES:
                continue
            extra_path = destination_dir / extra_name
            if extra_path.is_dir():
                shutil.rmtree(extra_path)
            else:
                extra_path.unlink()

        for child in sorted(source_dir.iterdir(), key=lambda entry: entry.name):
            if child.name in cls.SYNC_IGNORE_NAMES:
                continue
            destination_child = destination_dir / child.name
            if child.is_dir():
                cls._sync_tree(child, destination_child)
                continue
            destination_child.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(child, destination_child)

    @classmethod
    def _tree_hash(cls, root: Path) -> str | None:
        if not root.exists():
            return None
        digest = hashlib.sha256()
        for path in sorted(root.rglob("*")):
            relative_path = path.relative_to(root)
            if any(part in cls.SYNC_IGNORE_NAMES for part in relative_path.parts):
                continue
            digest.update(str(relative_path).replace("\\", "/").encode("utf-8"))
            if path.is_file():
                digest.update(b"\0")
                digest.update(path.read_bytes())
        return digest.hexdigest()

    @staticmethod
    def _file_hash(path: Path) -> str | None:
        if not path.exists() or not path.is_file():
            return None
        return hashlib.sha256(path.read_bytes()).hexdigest()


atexit.register(HostDemoPreviewService.stop_backend)
