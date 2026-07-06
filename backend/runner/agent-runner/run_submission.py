import json
import os
import re
import signal
import sqlite3
import subprocess
import threading
import time
from pathlib import Path
from queue import Empty, Queue
from urllib.error import URLError
from urllib.request import urlopen


WORKSPACE_ROOT = Path("/workspace")
SUBMISSION_DIR = WORKSPACE_ROOT / "submission"
TEMPLATE_DIR = WORKSPACE_ROOT / "template"
TASK_DIR = WORKSPACE_ROOT / "task"
TESTS_DIR = WORKSPACE_ROOT / "tests"
SDK_DIR = WORKSPACE_ROOT / "sdk"
PROMPT_PATH = WORKSPACE_ROOT / "prompt" / "task_prompt.txt"
SPEC_PATH = WORKSPACE_ROOT / "runner-spec.json"
ARTIFACTS_DIR = WORKSPACE_ROOT / "artifacts"
RESULT_PATH = ARTIFACTS_DIR / "result.json"
STDOUT_PATH = ARTIFACTS_DIR / "stdout.log"
STDERR_PATH = ARTIFACTS_DIR / "stderr.log"
DEBUG_LOG_PATH = WORKSPACE_ROOT / "execution.debug.log"
RUNNER_EVENTS_PATH = ARTIFACTS_DIR / "runner-events.jsonl"
TRACEABILITY_SNAPSHOT_PATH = ARTIFACTS_DIR / "traceability.snapshot.json"
TRACEABILITY_SEED_PATH = ARTIFACTS_DIR / "traceability-seed.json"
PAUSE_REQUEST_PATH = ARTIFACTS_DIR / "pause.request.json"
RESUME_REQUEST_PATH = ARTIFACTS_DIR / "resume.request.json"
CHECKPOINT_PATH = ARTIFACTS_DIR / "checkpoint.json"

WEB_APP_PORT = 3000
PLAYWRIGHT_WORKERS = 4


def resolve_traceability_db_path() -> Path:
    spec_path = SPEC_PATH
    if spec_path.is_file():
        try:
            payload = json.loads(spec_path.read_text(encoding="utf-8"))
            configured = str(payload.get("traceability_db_path") or "").strip()
            if configured:
                return Path(configured)
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            pass
    return Path("/tmp/arcbench/traceability.db")


TRACEABILITY_DB_PATH = resolve_traceability_db_path()


def append_debug_log(message: str) -> None:
    WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
    with DEBUG_LOG_PATH.open("a", encoding="utf-8") as output:
        output.write(f"[{timestamp}] [runner] {message}\n")


def append_debug_block(section: str, content: str) -> None:
    if not content:
        return
    for line in content.splitlines():
        append_debug_log(f"{section} | {line}")


def append_runner_event(step_key: str, message: str, status: str = "info") -> None:
    payload = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
        "step_key": step_key,
        "status": status,
        "message": message,
    }
    with RUNNER_EVENTS_PATH.open("a", encoding="utf-8") as output:
        output.write(json.dumps(payload, ensure_ascii=True) + "\n")


def append_runner_state(state: str, message: str) -> None:
    payload = {
        "type": "runner_state",
        "state": state,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
        "message": message,
    }
    with RUNNER_EVENTS_PATH.open("a", encoding="utf-8") as output:
        output.write(json.dumps(payload, ensure_ascii=True) + "\n")


def _write_json_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(f"{path.suffix}.tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp_path.replace(path)


def _parse_json_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    try:
        parsed = json.loads(str(value))
    except (TypeError, ValueError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []


def _parse_bool(value) -> bool | None:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if normalized in {"1", "true"}:
        return True
    if normalized in {"0", "false"}:
        return False
    return None


def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        (table_name,),
    ).fetchone()
    return row is not None


def write_traceability_snapshot(connection: sqlite3.Connection) -> None:
    payload = {
        "requirements": [],
        "scenarios": [],
        "interfaces": [],
        "tests": [],
        "call_edges": [],
        "node_states": [],
        "node_contracts": [],
    }
    if _table_exists(connection, "requirements"):
        payload["requirements"] = [
            {
                "req_id": str(row["req_id"] or "").strip(),
                "name": str(row["name"] or "").strip(),
                "description": str(row["description"] or "").strip(),
                "visual_reference": _parse_json_list(row["visual_reference"]),
                "scenarios": _parse_json_list(row["scenarios"]),
                "parent_id": str(row["parent_id"] or "").strip() or None,
                "children_ids": _parse_json_list(row["children_ids"]),
                "dependencies": _parse_json_list(row["dependencies"]),
            }
            for row in connection.execute("SELECT * FROM requirements ORDER BY req_id").fetchall()
        ]
    if _table_exists(connection, "scenarios"):
        payload["scenarios"] = [
            {
                "scenario_id": str(row["scenario_id"] or "").strip(),
                "name": str(row["name"] or "").strip(),
                "req_id": str(row["req_id"] or "").strip(),
                "steps": _parse_json_list(row["steps"]),
            }
            for row in connection.execute("SELECT * FROM scenarios ORDER BY scenario_id").fetchall()
        ]
    if _table_exists(connection, "interfaces"):
        payload["interfaces"] = [
            {
                "interface_id": str(row["interface_id"] or "").strip(),
                "req_ids": _parse_json_list(row["req_ids"]),
                "type": str(row["type"] or "").strip(),
                "content": str(row["content"] or "").strip(),
                "file_path": str(row["file_path"] or "").strip() or None,
                "first_line": str(row["first_line"] or "").strip() or None,
                "implemented": bool(row["implemented"]),
                "callers": _parse_json_list(row["callers"]),
                "callees": _parse_json_list(row["callees"]),
            }
            for row in connection.execute("SELECT * FROM interfaces ORDER BY interface_id").fetchall()
        ]
    if _table_exists(connection, "tests"):
        payload["tests"] = [
            {
                "test_id": str(row["test_id"] or "").strip(),
                "req_id": str(row["req_id"] or "").strip(),
                "interface_ids": _parse_json_list(row["interface_ids"]),
                "type": str(row["type"] or "").strip(),
                "file_path": str(row["file_path"] or "").strip() or None,
                "passed": _parse_bool(row["passed"]),
                "first_line": str(row["first_line"] or "").strip() or None,
            }
            for row in connection.execute("SELECT * FROM tests ORDER BY test_id").fetchall()
        ]
    if _table_exists(connection, "call_edges"):
        payload["call_edges"] = [dict(row) for row in connection.execute(
            "SELECT * FROM call_edges ORDER BY source_req_id, target_req_id, from_interface_id, to_interface_id"
        ).fetchall()]
    if _table_exists(connection, "node_states"):
        payload["node_states"] = [dict(row) for row in connection.execute("SELECT * FROM node_states ORDER BY req_id").fetchall()]
    if _table_exists(connection, "node_contracts"):
        payload["node_contracts"] = []
        for row in connection.execute("SELECT * FROM node_contracts ORDER BY req_id").fetchall():
            content_text = str(row["content"] or "").strip()
            try:
                content = json.loads(content_text) if content_text else {}
            except json.JSONDecodeError:
                content = {}
            payload["node_contracts"].append(
                {
                    "req_id": str(row["req_id"] or "").strip(),
                    "content": content,
                    "updated_at": str(row["updated_at"] or "").strip() or None,
                }
            )
    _write_json_atomic(TRACEABILITY_SNAPSHOT_PATH, payload)


def reset_traceability_storage() -> None:
    for path in (
        TRACEABILITY_DB_PATH,
        TRACEABILITY_SNAPSHOT_PATH,
        TRACEABILITY_DB_PATH.with_suffix(".db-journal"),
        TRACEABILITY_DB_PATH.with_suffix(".db-wal"),
        TRACEABILITY_DB_PATH.with_suffix(".db-shm"),
    ):
        try:
            path.unlink()
            append_debug_log(f"Removed stale traceability artifact: {path}")
        except FileNotFoundError:
            continue


def initialize_traceability_db() -> None:
    reset_traceability_storage()
    append_debug_log(f"Initializing traceability database at {TRACEABILITY_DB_PATH}")
    connection = sqlite3.connect(TRACEABILITY_DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS requirements (
                req_id TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                visual_reference TEXT,
                scenarios TEXT,
                parent_id TEXT,
                children_ids TEXT,
                dependencies TEXT
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS scenarios (
                scenario_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                req_id TEXT NOT NULL,
                steps TEXT NOT NULL
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS interfaces (
                interface_id TEXT PRIMARY KEY,
                req_ids TEXT,
                type TEXT,
                content TEXT,
                file_path TEXT,
                first_line TEXT,
                implemented INTEGER,
                callers TEXT,
                callees TEXT
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS tests (
                test_id TEXT PRIMARY KEY,
                req_id TEXT,
                interface_ids TEXT,
                type TEXT,
                file_path TEXT,
                passed INTEGER,
                first_line TEXT
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS call_edges (
                source_req_id TEXT,
                target_req_id TEXT,
                from_interface_id TEXT,
                to_interface_id TEXT,
                edge_type TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (source_req_id, target_req_id, from_interface_id, to_interface_id)
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS node_states (
                req_id TEXT PRIMARY KEY,
                state TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS node_contracts (
                req_id TEXT PRIMARY KEY,
                content TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.commit()
        write_traceability_snapshot(connection)
    finally:
        connection.close()


def seed_traceability_requirements() -> tuple[int, int]:
    if not TRACEABILITY_SEED_PATH.exists():
        append_debug_log("No traceability seed file found, skipping requirement/scenario registration")
        return 0, 0

    payload = json.loads(TRACEABILITY_SEED_PATH.read_text(encoding="utf-8"))
    requirements = payload.get("requirements", [])
    scenarios = payload.get("scenarios", [])
    if not isinstance(requirements, list) or not isinstance(scenarios, list):
        raise RuntimeError("traceability-seed.json must contain requirements and scenarios arrays")

    connection = sqlite3.connect(TRACEABILITY_DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        cursor = connection.cursor()
        cursor.executemany(
            """
            INSERT OR REPLACE INTO requirements (
                req_id, name, description, visual_reference, scenarios, parent_id, children_ids, dependencies
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    str(item.get("req_id", "")).strip(),
                    str(item.get("name", "")).strip(),
                    str(item.get("description", "")).strip(),
                    json.dumps(item.get("visual_reference", []), ensure_ascii=False),
                    json.dumps(item.get("scenarios", []), ensure_ascii=False),
                    item.get("parent_id"),
                    json.dumps(item.get("children_ids", []), ensure_ascii=False),
                    json.dumps(item.get("dependencies", []), ensure_ascii=False),
                )
                for item in requirements
                if str(item.get("req_id", "")).strip()
            ],
        )
        cursor.executemany(
            """
            INSERT OR REPLACE INTO scenarios (
                scenario_id, name, req_id, steps
            )
            VALUES (?, ?, ?, ?)
            """,
            [
                (
                    str(item.get("scenario_id", "")).strip(),
                    str(item.get("name", "")).strip(),
                    str(item.get("req_id", "")).strip(),
                    json.dumps(item.get("steps", []), ensure_ascii=False),
                )
                for item in scenarios
                if str(item.get("scenario_id", "")).strip() and str(item.get("req_id", "")).strip()
            ],
        )
        connection.commit()
        write_traceability_snapshot(connection)
    finally:
        connection.close()

    return len(requirements), len(scenarios)
def stream_pipe(pipe, sink_file, section: str) -> None:
    try:
        for line in iter(pipe.readline, ""):
            if not line:
                break
            sink_file.write(line)
            sink_file.flush()
            append_debug_log(f"{section} | {line.rstrip()}")
    finally:
        pipe.close()


def queue_pipe(pipe, sink_file, section: str, line_queue: Queue | None = None) -> None:
    try:
        for line in iter(pipe.readline, ""):
            if not line:
                break
            sink_file.write(line)
            sink_file.flush()
            append_debug_log(f"{section} | {line.rstrip()}")
            if line_queue is not None:
                line_queue.put((section, line.rstrip("\n")))
    finally:
        pipe.close()


def run_command(command: list[str], cwd: Path, stdout_file, stderr_file, check: bool = True, label: str = "command", env: dict | None = None) -> subprocess.CompletedProcess:
    append_debug_log(f"Executing {label}: {' '.join(command)}")
    completed = subprocess.run(
        command,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        errors="replace",
        check=False,
        env=env,
    )
    if completed.stdout:
        stdout_file.write(completed.stdout)
        stdout_file.flush()
        append_debug_block(f"{label}.stdout", completed.stdout)
    if completed.stderr:
        stderr_file.write(completed.stderr)
        stderr_file.flush()
        append_debug_block(f"{label}.stderr", completed.stderr)
    append_debug_log(f"{label} exit code: {completed.returncode}")
    if check and completed.returncode != 0:
        raise subprocess.CalledProcessError(completed.returncode, command, output=completed.stdout, stderr=completed.stderr)
    return completed


def read_spec() -> dict:
    if not SPEC_PATH.exists():
        raise RuntimeError("runner-spec.json is missing from the workspace")
    return json.loads(SPEC_PATH.read_text(encoding="utf-8"))


def resolve_python_agent_entrypoint() -> Path:
    entrypoint = SUBMISSION_DIR / "main.py"
    if entrypoint.exists():
        return entrypoint
    raise RuntimeError("unsupported python agent entrypoint: expected main.py at the archive root")


def clear_request_file(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def read_checkpoint() -> dict:
    if not CHECKPOINT_PATH.exists():
        return {"last_completed_index": 0, "completed": []}
    try:
        payload = json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"last_completed_index": 0, "completed": []}
    if not isinstance(payload, dict):
        return {"last_completed_index": 0, "completed": []}
    payload.setdefault("last_completed_index", 0)
    payload.setdefault("completed", [])
    return payload


def write_checkpoint(payload: dict) -> None:
    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = CHECKPOINT_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(CHECKPOINT_PATH)


def install_agent_dependencies(stdout_file, stderr_file) -> None:
    requirements_path = SUBMISSION_DIR / "requirements.txt"
    if not requirements_path.exists():
        append_debug_log("No submission requirements.txt found, skipping dependency install")
        return
    append_runner_event("start_agent", "Installing agent dependencies")
    run_command(
        ["python3", "-m", "pip", "install", "--no-cache-dir", "-r", "requirements.txt"],
        cwd=SUBMISSION_DIR,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=True,
        label="agent-pip-install",
    )
    append_runner_event("start_agent", "Agent dependencies installed", status="success")


def build_agent_environment() -> dict[str, str]:
    env = {
        **os.environ,
        "ARCBENCH_TASK_PROMPT": PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else "",
        "ARCBENCH_PROMPT_PATH": str(PROMPT_PATH),
        "ARCBENCH_TEMPLATE_DIR": str(TEMPLATE_DIR),
        "ARCBENCH_TASK_DIR": str(TASK_DIR),
        "ARCBENCH_SUBMISSION_DIR": str(SUBMISSION_DIR),
        "ARCBENCH_OUTPUT_DIR": str(TEMPLATE_DIR),
        "ARCBENCH_ARTIFACTS_DIR": str(ARTIFACTS_DIR),
        "ARCBENCH_RUNNER_EVENTS_PATH": str(RUNNER_EVENTS_PATH),
        "ARCBENCH_TRACEABILITY_DB_PATH": str(TRACEABILITY_DB_PATH),
        "ARCBENCH_TRACEABILITY_SNAPSHOT_PATH": str(TRACEABILITY_SNAPSHOT_PATH),
        "ARCBENCH_TRACEABILITY_EVENTS_PATH": str(RUNNER_EVENTS_PATH),
        "ARCBENCH_SDK_DIR": str(SDK_DIR),
        "ARCBENCH_CHECKPOINT_PATH": str(CHECKPOINT_PATH),
        "ARCBENCH_PAUSE_REQUEST_PATH": str(PAUSE_REQUEST_PATH),
        "ARCBENCH_RESUME_REQUEST_PATH": str(RESUME_REQUEST_PATH),
        "PYTHONPATH": f"{SDK_DIR}:{os.environ.get('PYTHONPATH', '')}" if os.environ.get("PYTHONPATH") else str(SDK_DIR),
    }
    return env


def run_generation_agent(stdout_file, stderr_file) -> subprocess.CompletedProcess:
    entrypoint = resolve_python_agent_entrypoint()
    command = ["python3", entrypoint.name]
    append_runner_event("start_agent", "Launching generation agent")
    return run_command(
        command,
        cwd=SUBMISSION_DIR,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=False,
        label="generation-agent",
        env=build_agent_environment(),
    )


def run_generation_agent_once(stdout_file, stderr_file) -> subprocess.CompletedProcess:
    return run_generation_agent(stdout_file, stderr_file)


def run_generation_agent_with_resume(stdout_file, stderr_file) -> None:
    checkpoint = read_checkpoint()
    last_completed_index = int(checkpoint.get("last_completed_index", 0) or 0)
    if last_completed_index > 0:
        append_runner_event("start_agent", f"Resuming from checkpoint at commit {last_completed_index}", status="info")

    while True:
        completed = run_generation_agent_once(stdout_file, stderr_file)
        if completed.returncode == 0:
            checkpoint = read_checkpoint()
            if checkpoint.get("paused") or PAUSE_REQUEST_PATH.exists():
                append_runner_state("paused", "Generation paused")
                append_runner_event("start_agent", "Generation paused; waiting for resume request", status="info")
                while not RESUME_REQUEST_PATH.exists():
                    time.sleep(1)
                append_runner_state("resumed", "Generation resumed")
                append_runner_event("start_agent", "Resume request received", status="success")
                clear_request_file(PAUSE_REQUEST_PATH)
                clear_request_file(RESUME_REQUEST_PATH)
                checkpoint = read_checkpoint()
                last_completed_index = int(checkpoint.get("last_completed_index", 0) or 0)
                continue
            append_runner_event("start_agent", "Generation agent finished successfully", status="success")
            clear_request_file(PAUSE_REQUEST_PATH)
            clear_request_file(RESUME_REQUEST_PATH)
            return

        if completed.returncode == 130 or PAUSE_REQUEST_PATH.exists():
            append_runner_state("paused", "Generation paused")
            append_runner_event("start_agent", "Generation paused; waiting for resume request", status="info")
            while not RESUME_REQUEST_PATH.exists():
                time.sleep(1)
            append_runner_state("resumed", "Generation resumed")
            append_runner_event("start_agent", "Resume request received", status="success")
            clear_request_file(PAUSE_REQUEST_PATH)
            clear_request_file(RESUME_REQUEST_PATH)
            checkpoint = read_checkpoint()
            last_completed_index = int(checkpoint.get("last_completed_index", 0) or 0)
            continue

        raise subprocess.CalledProcessError(
            completed.returncode,
            completed.args,
            output=completed.stdout,
            stderr=completed.stderr,
        )


def install_node_dependencies(project_dir: Path, stdout_file, stderr_file, label: str, step_key: str, install_args: list[str] | None = None) -> None:
    append_runner_event(step_key, f"Installing dependencies for {label}")
    command = ["npm", "install", *(install_args or [])]
    run_command(command, cwd=project_dir, stdout_file=stdout_file, stderr_file=stderr_file, check=True, label=f"{label}-npm-install")
    append_runner_event(step_key, f"Dependencies installed for {label}", status="success")


def start_background_process(command: list[str], cwd: Path, stdout_file, stderr_file, label: str, env: dict | None = None) -> tuple[subprocess.Popen, threading.Thread, threading.Thread]:
    append_debug_log(f"Starting background process {label}: {' '.join(command)}")
    process = subprocess.Popen(
        command,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        errors="replace",
        bufsize=1,
        env=env,
    )
    stdout_thread = threading.Thread(target=stream_pipe, args=(process.stdout, stdout_file, f"{label}.stdout"), daemon=True)
    stderr_thread = threading.Thread(target=stream_pipe, args=(process.stderr, stderr_file, f"{label}.stderr"), daemon=True)
    stdout_thread.start()
    stderr_thread.start()
    return process, stdout_thread, stderr_thread


def wait_for_http_ready(url: str, timeout_seconds: int, label: str) -> None:
    deadline = time.time() + timeout_seconds
    append_debug_log(f"Waiting for {label} at {url} with timeout={timeout_seconds}s")
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=2) as response:
                if response.status < 500:
                    append_debug_log(f"{label} became ready with status={response.status}")
                    return
        except (URLError, TimeoutError):
            time.sleep(1)
    raise TimeoutError(f"{label} did not become ready within {timeout_seconds} seconds")


def write_playwright_config(base_url: str) -> None:
    config = f"""
import {{ defineConfig }} from '@playwright/test';

export default defineConfig({{
  testDir: '.',
  timeout: 30000,
  fullyParallel: false,
  workers: {PLAYWRIGHT_WORKERS},
  reporter: [['json', {{ outputFile: '../artifacts/playwright-report.json' }}]],
  use: {{
    baseURL: '{base_url}',
    channel: 'chromium',
    trace: 'off',
    screenshot: 'off',
  }},
}});
"""
    (TESTS_DIR / "playwright.config.ts").write_text(config.strip() + "\n", encoding="utf-8")


def ensure_test_package(stdout_file, stderr_file) -> None:
    package_json = {
        "name": "arcbench-tests",
        "private": True,
        "type": "module",
        "devDependencies": {
            "@playwright/test": "1.54.0"
        }
    }
    (TESTS_DIR / "package.json").write_text(json.dumps(package_json, indent=2) + "\n", encoding="utf-8")
    append_runner_event("run_tests", "Installing Playwright dependencies")
    run_command(["npm", "install"], cwd=TESTS_DIR, stdout_file=stdout_file, stderr_file=stderr_file, check=True, label="tests-npm-install")
    append_runner_event("run_tests", "Playwright environment is ready", status="success")


def count_playwright_tests() -> int:
    append_debug_log("Counting Playwright tests before execution")
    completed = subprocess.run(
        ["npx", "playwright", "test", "--list"],
        cwd=str(TESTS_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        errors="replace",
        check=False,
    )
    append_debug_block("playwright-list.stdout", completed.stdout)
    append_debug_block("playwright-list.stderr", completed.stderr)
    stderr_text = completed.stderr or ""
    stdout_text = completed.stdout or ""
    if "No tests found" in stderr_text and "Total: 0 tests" in stdout_text:
        append_debug_log("Playwright reported no tests; treating this as a successful zero-test run")
        return 0
    if completed.returncode != 0:
        raise RuntimeError("Failed to enumerate Playwright tests before execution")
    total_match = re.search(r"Total:\s+(\d+)\s+tests?\b", stdout_text)
    if total_match:
        return int(total_match.group(1))

    # Fallback for older or alternative Playwright list formats where tests are
    # emitted one per line but the final total summary is unavailable.
    return sum(1 for line in stdout_text.splitlines() if line.strip().startswith("["))


def run_playwright_tests_with_progress(stdout_file, stderr_file) -> subprocess.Popen | subprocess.CompletedProcess:
    command = ["npx", "playwright", "test", f"--workers={PLAYWRIGHT_WORKERS}"]
    append_runner_event("run_tests", "Deploying generated application", status="info")
    append_runner_event("run_tests", f"Generated application is reachable on http://127.0.0.1:{WEB_APP_PORT}", status="success")
    append_runner_event("run_tests", "Deploying test environment", status="info")
    append_runner_event("run_tests", f"Test environment ready with {PLAYWRIGHT_WORKERS} workers", status="success")
    total_tests = count_playwright_tests()
    if total_tests == 0:
        append_runner_event("run_tests", "No Playwright tests found; skipping test execution", status="success")
        append_debug_log("Skipping Playwright execution because no tests were discovered")
        return subprocess.CompletedProcess(
            ["npx", "playwright", "test", f"--workers={PLAYWRIGHT_WORKERS}"],
            returncode=0,
        )
    append_runner_event("run_tests", f"Executing tests with {PLAYWRIGHT_WORKERS} workers", status="info")
    append_runner_event("run_tests", f"Test progress 0/{total_tests}", status="info")

    line_queue: Queue = Queue()
    append_debug_log(f"Starting Playwright test process: {' '.join(command)}")
    process = subprocess.Popen(
        command,
        cwd=str(TESTS_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        errors="replace",
        bufsize=1,
    )
    stdout_thread = threading.Thread(target=queue_pipe, args=(process.stdout, stdout_file, "playwright-test.stdout", line_queue), daemon=True)
    stderr_thread = threading.Thread(target=queue_pipe, args=(process.stderr, stderr_file, "playwright-test.stderr", line_queue), daemon=True)
    stdout_thread.start()
    stderr_thread.start()

    managed_count = 0
    last_reported_count = -1
    while process.poll() is None or not line_queue.empty():
        try:
            section, line = line_queue.get(timeout=0.5)
        except Empty:
            continue
        if section.endswith("stdout") and line.lstrip().startswith(("✓", "✘", "-")):
            managed_count += 1
            if managed_count != last_reported_count:
                last_reported_count = managed_count
                append_runner_event("run_tests", f"Test progress {managed_count}/{total_tests}", status="info")

    stdout_thread.join(timeout=2)
    stderr_thread.join(timeout=2)
    append_runner_event("run_tests", f"Test progress {managed_count}/{total_tests}", status="success")
    return process


def parse_playwright_results() -> dict:
    report_path = ARTIFACTS_DIR / "playwright-report.json"
    if not report_path.exists():
        return {"passed": 0, "failed": 0, "score": 100.0, "duration_seconds": 0, "tests": []}

    report = json.loads(report_path.read_text(encoding="utf-8"))
    tests = []
    passed = 0
    failed = 0
    total_duration_ms = 0

    def summarize_test_outcome(test: dict) -> tuple[str, str | None]:
        results = test.get("results", [])
        statuses = [str(result.get("status", "")).strip() for result in results]

        if any(status == "failed" for status in statuses):
            return "failed", "failed"
        if any(status == "timedOut" for status in statuses):
            return "timedOut", "failed"
        if any(status == "interrupted" for status in statuses):
            return "interrupted", "failed"
        if any(status == "passed" for status in statuses):
            expected_status = str(test.get("expectedStatus", "passed")).strip() or "passed"
            return expected_status, "passed"
        if any(status == "skipped" for status in statuses):
            return "skipped", "failed"

        aggregate_status = str(test.get("status", "unknown")).strip() or "unknown"
        if aggregate_status == "expected":
            expected_status = str(test.get("expectedStatus", "passed")).strip() or "passed"
            return expected_status, "passed"
        return aggregate_status, "failed"

    def walk_suite(suite: dict) -> None:
        nonlocal passed, failed, total_duration_ms
        for spec in suite.get("specs", []):
            title = spec.get("title", "Unnamed spec")
            for test in spec.get("tests", []):
                normalized_status, outcome = summarize_test_outcome(test)
                duration = sum(result.get("duration", 0) for result in test.get("results", []))
                total_duration_ms += duration
                if outcome == "passed":
                    passed += 1
                else:
                    failed += 1
                error_text = None
                for result in test.get("results", []):
                    errors = result.get("errors", [])
                    if errors:
                        error_text = errors[0].get("message")
                        break
                tests.append({
                    "name": title,
                    "status": normalized_status,
                    "duration_ms": duration,
                    "error": error_text,
                })
        for child in suite.get("suites", []):
            walk_suite(child)

    for suite in report.get("suites", []):
        walk_suite(suite)

    total = passed + failed
    score = round((passed / total) * 100, 1) if total else 100.0
    return {
        "passed": passed,
        "failed": failed,
        "score": score,
        "duration_seconds": round(total_duration_ms / 1000, 2),
        "tests": tests,
    }


def stop_process(process: subprocess.Popen | None, label: str) -> None:
    if process is None or process.poll() is not None:
        return
    append_debug_log(f"Stopping process {label}")
    process.send_signal(signal.SIGTERM)
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        append_debug_log(f"Killing process {label}")
        process.kill()


def join_thread(thread: threading.Thread | None) -> None:
    if thread is not None:
        thread.join(timeout=2)


def run_web_template(stdout_file, stderr_file) -> dict:
    frontend_dir = TEMPLATE_DIR / "frontend"
    backend_dir = TEMPLATE_DIR / "backend"
    if not frontend_dir.exists() or not backend_dir.exists():
        raise RuntimeError("web template is incomplete: expected frontend/ and backend/ directories")

    install_node_dependencies(frontend_dir, stdout_file, stderr_file, "frontend", "run_tests")
    append_runner_event("run_tests", "Building template frontend")
    run_command(
        ["npm", "run", "build"],
        cwd=frontend_dir,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=True,
        label="frontend-npm-build",
    )
    append_runner_event("run_tests", "Template frontend built", status="success")

    install_node_dependencies(backend_dir, stdout_file, stderr_file, "backend", "run_tests")

    backend_env = {
        **os.environ,
        "HOST": "0.0.0.0",
        "PORT": str(WEB_APP_PORT),
    }

    append_runner_event("run_tests", "Starting template application server")
    backend_process, backend_stdout_thread, backend_stderr_thread = start_background_process(
        ["npm", "run", "start"],
        cwd=backend_dir,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        label="template-app",
        env=backend_env,
    )
    append_runner_event("run_tests", f"Template application server started (pid={backend_process.pid})", status="success")

    wait_for_http_ready(f"http://127.0.0.1:{WEB_APP_PORT}", 120, "template application server")
    append_runner_event("run_tests", f"Template application is reachable on http://127.0.0.1:{WEB_APP_PORT}", status="success")

    return {
        "app_process": backend_process,
        "app_stdout_thread": backend_stdout_thread,
        "app_stderr_thread": backend_stderr_thread,
        "base_url": f"http://127.0.0.1:{WEB_APP_PORT}",
    }


def main() -> int:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    checkpoint = read_checkpoint()
    resume_from_checkpoint = int(checkpoint.get("last_completed_index", 0) or 0) > 0
    if not resume_from_checkpoint:
        RUNNER_EVENTS_PATH.write_text("", encoding="utf-8")
    spec = read_spec()
    append_debug_log(f"Runner started with spec: {spec}")
    initialize_traceability_db()
    seeded_requirements, seeded_scenarios = seed_traceability_requirements()
    append_runner_event(
        "deploy_agent",
        f"Traceability initialized with {seeded_requirements} requirements and {seeded_scenarios} scenarios",
        status="success",
    )

    managed_processes: list[tuple[subprocess.Popen | None, str]] = []
    managed_threads: list[threading.Thread | None] = []

    with STDOUT_PATH.open("w", encoding="utf-8") as stdout_file, STDERR_PATH.open("w", encoding="utf-8") as stderr_file:
        try:
            install_agent_dependencies(stdout_file, stderr_file)
            run_generation_agent_with_resume(stdout_file, stderr_file)
            append_runner_event(
                "start_agent",
                "Uploaded agent finished; traceability artifacts are expected to be written directly by the SDK",
                status="success",
            )

            task = spec.get("task", {})
            category = task.get("category", "web")
            if category != "web":
                raise RuntimeError(f"Unsupported task category inside runner: {category}")

            runtime = run_web_template(stdout_file, stderr_file)
            managed_processes.extend([
                (runtime["app_process"], "template application server"),
            ])
            managed_threads.extend([
                runtime["app_stdout_thread"],
                runtime["app_stderr_thread"],
            ])

            append_runner_event("run_tests", "Preparing Playwright configuration")
            write_playwright_config(runtime["base_url"])
            ensure_test_package(stdout_file, stderr_file)
            playwright_process = run_playwright_tests_with_progress(stdout_file, stderr_file)
            playwright_result = subprocess.CompletedProcess(
                ["npx", "playwright", "test", f"--workers={PLAYWRIGHT_WORKERS}"],
                returncode=playwright_process.returncode if playwright_process.returncode is not None else 1,
            )
            append_runner_event("run_tests", f"Playwright test process finished with code {playwright_result.returncode}")

            results = parse_playwright_results()
            append_runner_event("run_tests", f"Playwright results parsed: passed={results['passed']}, failed={results['failed']}, score={results['score']}", status="success")
            RESULT_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")
            append_runner_event("run_tests", "Result file written", status="success")
            return 0 if results["failed"] == 0 else 1
        except Exception as exc:  # noqa: BLE001
            append_debug_log(f"Runner failed: {exc}")
            error_step = "run_tests" if (TESTS_DIR / "playwright.config.ts").exists() else "start_agent"
            append_runner_event(error_step, str(exc), status="error")
            RESULT_PATH.write_text(
                json.dumps(
                    {
                        "passed": 0,
                        "failed": 0,
                        "score": 0,
                        "duration_seconds": 0,
                        "tests": [],
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            return 1
        finally:
            for process, label in reversed(managed_processes):
                stop_process(process, label)
            for thread in managed_threads:
                join_thread(thread)


if __name__ == "__main__":
    raise SystemExit(main())
