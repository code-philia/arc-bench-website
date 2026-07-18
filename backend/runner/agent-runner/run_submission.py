import json
import os
import re
import signal
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
REQUIREMENTS_DIR = TEMPLATE_DIR / "requirements"
TESTS_DIR = WORKSPACE_ROOT / "tests"
SDK_DIR = WORKSPACE_ROOT / "sdk"
SPEC_PATH = WORKSPACE_ROOT / "runner-spec.json"
ARC_DIR = TEMPLATE_DIR / ".arc"
STDOUT_PATH = ARC_DIR / "stdout.log"
DEBUG_LOG_PATH = ARC_DIR / "execution.debug.log"
RUNNER_EVENTS_PATH = ARC_DIR / "runner-events.jsonl"
TRACEABILITY_DIR = ARC_DIR / "traceability"
TRACEABILITY_SEED_PATH = ARC_DIR / "traceability-seed.json"
PAUSE_REQUEST_PATH = ARC_DIR / "pause.request.json"
RESUME_REQUEST_PATH = ARC_DIR / "resume.request.json"
CHECKPOINT_PATH = ARC_DIR / "checkpoint.json"
PLAYWRIGHT_REPORT_PATH = ARC_DIR / "playwright-report.json"
PIP_CACHE_DIR = Path("/tmp/arcbench/pip-cache")
PIP_INSTALL_ATTEMPTS = 3
PIP_DEFAULT_TIMEOUT_SECONDS = 120
PIP_RESUME_RETRIES = 8

WEB_APP_PORT = 3000
PLAYWRIGHT_WORKERS = 4


TRACEABILITY_TABLES = (
    "requirements",
    "scenarios",
    "interfaces",
    "tests",
    "call_edges",
    "node_states",
    "node_contracts",
)


def resolve_template_path(path_value: str | None, default_path: Path) -> Path:
    value = str(path_value or "").strip()
    if not value:
        return default_path
    path = Path(value)
    return path if path.is_absolute() else TEMPLATE_DIR / path


def resolve_traceability_dir() -> Path:
    spec_path = SPEC_PATH
    if spec_path.is_file():
        try:
            payload = json.loads(spec_path.read_text(encoding="utf-8"))
            configured = str(payload.get("traceability_dir") or "").strip()
            if configured:
                return resolve_template_path(configured, TRACEABILITY_DIR)
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            pass
    return TRACEABILITY_DIR


TRACEABILITY_DIR = resolve_traceability_dir()


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


def reset_traceability_storage() -> None:
    if not TRACEABILITY_DIR.exists():
        return
    for path in TRACEABILITY_DIR.glob("*.json"):
        path.unlink()
        append_debug_log(f"Removed stale traceability table: {path}")


def restore_traceability_storage_from_workspace() -> bool:
    if not TRACEABILITY_DIR.is_dir() or not any(TRACEABILITY_DIR.glob("*.json")):
        return False
    append_debug_log(f"Traceability store is already in workspace checkpoint location: {TRACEABILITY_DIR}")
    return True


def initialize_traceability_store() -> None:
    TRACEABILITY_DIR.mkdir(parents=True, exist_ok=True)
    reset_traceability_storage()
    append_debug_log(f"Initializing traceability store at {TRACEABILITY_DIR}")
    for table_name in TRACEABILITY_TABLES:
        _write_json_atomic(TRACEABILITY_DIR / f"{table_name}.json", {})


def seed_traceability_requirements() -> tuple[int, int]:
    if not TRACEABILITY_SEED_PATH.exists():
        append_debug_log("No traceability seed file found, skipping requirement/scenario registration")
        return 0, 0

    payload = json.loads(TRACEABILITY_SEED_PATH.read_text(encoding="utf-8"))
    requirements = payload.get("requirements", [])
    scenarios = payload.get("scenarios", [])
    if not isinstance(requirements, list) or not isinstance(scenarios, list):
        raise RuntimeError("traceability-seed.json must contain requirements and scenarios arrays")

    requirements_by_id = {
        str(item.get("req_id", "")).strip(): item
        for item in requirements
        if isinstance(item, dict) and str(item.get("req_id", "")).strip()
    }
    scenarios_by_id = {
        str(item.get("scenario_id", "")).strip(): item
        for item in scenarios
        if isinstance(item, dict) and str(item.get("scenario_id", "")).strip() and str(item.get("req_id", "")).strip()
    }
    _write_json_atomic(TRACEABILITY_DIR / "requirements.json", requirements_by_id)
    _write_json_atomic(TRACEABILITY_DIR / "scenarios.json", scenarios_by_id)

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


def build_npm_environment() -> dict[str, str]:
    npm_env = dict(os.environ)
    # Use the registry configured inside the runner image. Only force npm's
    # safe default for lockfile host replacement to avoid double-prefixing
    # mirror tarball URLs from existing package-lock files.
    npm_env.pop("NPM_CONFIG_REGISTRY", None)
    npm_env["NPM_CONFIG_REPLACE_REGISTRY_HOST"] = "npmjs"
    return npm_env


def log_source_mirror_configuration() -> None:
    pip_index_url = os.environ.get("ARCBENCH_PIP_INDEX_URL", "").strip() or os.environ.get("PIP_INDEX_URL", "").strip()
    pip_trusted_host = os.environ.get("ARCBENCH_PIP_TRUSTED_HOST", "").strip() or os.environ.get("PIP_TRUSTED_HOST", "").strip()
    pip_extra_index_url = os.environ.get("ARCBENCH_PIP_EXTRA_INDEX_URL", "").strip() or os.environ.get("PIP_EXTRA_INDEX_URL", "").strip()
    npm_env = build_npm_environment()
    append_debug_log(
        "Source mirror configuration: "
        "apt_mirror=https://mirrors.aliyun.com/ubuntu (baked into runner image), "
        "npm_config=container npm config, "
        f"pip_index_url={pip_index_url or '<default>'}, "
        f"pip_trusted_host={pip_trusted_host or '<default>'}, "
        f"pip_extra_index_url={pip_extra_index_url or '<none>'}"
    )


def log_pip_mirror_configuration(pip_env: dict[str, str]) -> None:
    append_debug_log(
        "Applying pip mirror configuration: "
        f"PIP_INDEX_URL={str(pip_env.get('PIP_INDEX_URL', '')).strip() or '<default>'}, "
        f"PIP_TRUSTED_HOST={str(pip_env.get('PIP_TRUSTED_HOST', '')).strip() or '<default>'}, "
        f"PIP_EXTRA_INDEX_URL={str(pip_env.get('PIP_EXTRA_INDEX_URL', '')).strip() or '<none>'}, "
        f"PIP_CACHE_DIR={str(pip_env.get('PIP_CACHE_DIR', '')).strip() or '<none>'}"
    )


def log_npm_mirror_configuration(label: str, env: dict[str, str]) -> None:
    append_debug_log(
        f"Using container npm configuration for {label}: "
        f"NPM_CONFIG_REGISTRY={str(env.get('NPM_CONFIG_REGISTRY', '')).strip() or '<unset>'}, "
        f"NPM_CONFIG_REPLACE_REGISTRY_HOST={str(env.get('NPM_CONFIG_REPLACE_REGISTRY_HOST', '')).strip() or '<unset>'}"
    )


def read_spec() -> dict:
    if not SPEC_PATH.exists():
        raise RuntimeError("runner-spec.json is missing from the workspace")
    return json.loads(SPEC_PATH.read_text(encoding="utf-8"))


def resolve_python_agent_entrypoint() -> Path:
    entrypoint = SUBMISSION_DIR / "main.py"
    if entrypoint.exists():
        return entrypoint
    raise RuntimeError("unsupported python agent entrypoint: expected main.py at the archive root")

def map_task_category_to_app_type(category: str) -> str:
    normalized = str(category or "").strip().lower()
    if normalized == "cli":
        return "cli"
    if normalized in {"android", "mobile", "mobileapp", "mobile_app"}:
        return "android"
    return "web"


def build_generation_agent_command(entrypoint: Path) -> list[str]:
    command = ["python3", str(entrypoint)]
    spec = read_spec()
    task_payload = spec.get("task") if isinstance(spec, dict) else {}
    category = ""
    if isinstance(task_payload, dict):
        category = str(task_payload.get("category") or "").strip()
    app_type = map_task_category_to_app_type(category)
    command.extend(
        [
            str(spec.get("requirement_dir") or "requirements"),
            "--output-dir",
            str(spec.get("output_dir") or "."),
            "--app-type",
            app_type,
        ]
    )
    if app_type == "web":
        command.extend(["--web-port", str(WEB_APP_PORT)])
    append_debug_log(f"Launching generation agent with standardized args: {' '.join(command)}")
    return command


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
    PIP_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    pip_env = {
        **os.environ,
        "PIP_DISABLE_PIP_VERSION_CHECK": "1",
        "PIP_NO_INPUT": "1",
        "PIP_ROOT_USER_ACTION": "ignore",
        "PIP_DEFAULT_TIMEOUT": str(PIP_DEFAULT_TIMEOUT_SECONDS),
        "PIP_RESUME_RETRIES": str(PIP_RESUME_RETRIES),
        "PIP_CACHE_DIR": str(PIP_CACHE_DIR),
    }
    pip_index_url = os.environ.get("ARCBENCH_PIP_INDEX_URL", "").strip()
    pip_trusted_host = os.environ.get("ARCBENCH_PIP_TRUSTED_HOST", "").strip()
    pip_extra_index_url = os.environ.get("ARCBENCH_PIP_EXTRA_INDEX_URL", "").strip()
    if pip_index_url:
        pip_env["PIP_INDEX_URL"] = pip_index_url
    if pip_trusted_host:
        pip_env["PIP_TRUSTED_HOST"] = pip_trusted_host
    if pip_extra_index_url:
        pip_env["PIP_EXTRA_INDEX_URL"] = pip_extra_index_url
    log_pip_mirror_configuration(pip_env)

    last_error: subprocess.CalledProcessError | None = None
    for attempt in range(1, PIP_INSTALL_ATTEMPTS + 1):
        append_debug_log(
            f"Starting pip install attempt {attempt}/{PIP_INSTALL_ATTEMPTS} with cache_dir={PIP_CACHE_DIR}"
        )
        try:
            run_command(
                [
                    "python3",
                    "-m",
                    "pip",
                    "install",
                    "--retries",
                    "10",
                    "--timeout",
                    str(PIP_DEFAULT_TIMEOUT_SECONDS),
                    "--resume-retries",
                    str(PIP_RESUME_RETRIES),
                    "--prefer-binary",
                    "-r",
                    "requirements.txt",
                ],
                cwd=SUBMISSION_DIR,
                stdout_file=stdout_file,
                stderr_file=stderr_file,
                check=True,
                label="agent-pip-install",
                env=pip_env,
            )
            last_error = None
            break
        except subprocess.CalledProcessError as error:
            last_error = error
            if attempt >= PIP_INSTALL_ATTEMPTS:
                break
            append_runner_event(
                "start_agent",
                f"Agent dependency install failed on attempt {attempt}, retrying",
                status="warning",
            )
            append_debug_log(
                f"pip install attempt {attempt} failed with code={error.returncode}; retrying after backoff"
            )
            time.sleep(min(5 * attempt, 15))

    if last_error is not None:
        raise last_error
    append_runner_event("start_agent", "Agent dependencies installed", status="success")


def build_agent_environment() -> dict[str, str]:
    env = {
        **os.environ,
        "ARCBENCH_TEMPLATE_DIR": str(TEMPLATE_DIR),
        "ARCBENCH_PROJECT_DIR": ".",
        "ARCBENCH_REQUIREMENT_DIR": "requirements",
        "ARCBENCH_TASK_DIR": "requirements",
        "ARCBENCH_SUBMISSION_DIR": str(SUBMISSION_DIR),
        "ARCBENCH_OUTPUT_DIR": ".",
        "ARCBENCH_ARC_DIR": ".arc",
        "ARCBENCH_RUNNER_EVENTS_PATH": ".arc/runner-events.jsonl",
        "ARCBENCH_TRACEABILITY_DIR": ".arc/traceability",
        "ARCBENCH_SDK_DIR": str(SDK_DIR),
        "ARCBENCH_CHECKPOINT_PATH": ".arc/checkpoint.json",
        "ARCBENCH_PAUSE_REQUEST_PATH": ".arc/pause.request.json",
        "ARCBENCH_RESUME_REQUEST_PATH": ".arc/resume.request.json",
        "PYTHONPATH": f"{SDK_DIR}:{os.environ.get('PYTHONPATH', '')}" if os.environ.get("PYTHONPATH") else str(SDK_DIR),
    }
    return env


def log_agent_environment_summary(env: dict[str, str]) -> None:
    redacted_api_key = "set" if str(env.get("OPENAI_API_KEY", "")).strip() else "missing"
    append_debug_log(
        "Agent environment summary: "
        f"OPENAI_API_KEY={redacted_api_key}, "
        f"OPENAI_BASE_URL={str(env.get('OPENAI_BASE_URL', '')).strip() or '<missing>'}, "
        f"OPENAI_API_BASE_URL={str(env.get('OPENAI_API_BASE_URL', '')).strip() or '<missing>'}, "
        f"MODEL={str(env.get('MODEL', '')).strip() or '<missing>'}, "
        f"ARC_DEBUG={str(env.get('ARC_DEBUG', '')).strip() or '<missing>'}, "
        f"DEBUG_MODE={str(env.get('DEBUG_MODE', '')).strip() or '<missing>'}, "
        f"VISUAL_BASE_URL={str(env.get('VISUAL_BASE_URL', '')).strip() or '<missing>'}, "
        f"VISUAL_MODEL={str(env.get('VISUAL_MODEL', '')).strip() or '<missing>'}, "
        f"ARCBENCH_RUNNER_EVENTS_PATH={str(env.get('ARCBENCH_RUNNER_EVENTS_PATH', '')).strip() or '<missing>'}, "
        f"ARCBENCH_TRACEABILITY_DIR={str(env.get('ARCBENCH_TRACEABILITY_DIR', '')).strip() or '<missing>'}"
    )


def run_generation_agent(stdout_file, stderr_file) -> subprocess.CompletedProcess:
    entrypoint = resolve_python_agent_entrypoint()
    command = build_generation_agent_command(entrypoint)
    agent_env = build_agent_environment()
    log_agent_environment_summary(agent_env)
    append_runner_event("start_agent", "Launching generation agent")
    return run_command(
        command,
        cwd=TEMPLATE_DIR,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=False,
        label="generation-agent",
        env=agent_env,
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
    command = ["npm", "install", "--no-audit", "--no-fund", *(install_args or [])]
    npm_env = build_npm_environment()
    log_npm_mirror_configuration(label, npm_env)
    run_command(
        command,
        cwd=project_dir,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=True,
        label=f"{label}-npm-install",
        env=npm_env,
    )
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
  reporter: [['json', {{ outputFile: '{PLAYWRIGHT_REPORT_PATH.as_posix()}' }}]],
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
    npm_env = build_npm_environment()
    log_npm_mirror_configuration("playwright tests", npm_env)
    run_command(
        ["npm", "install", "--no-audit", "--no-fund"],
        cwd=TESTS_DIR,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=True,
        label="tests-npm-install",
        env=npm_env,
    )
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
    report_path = PLAYWRIGHT_REPORT_PATH
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


def run_cli_template(stdout_file, stderr_file) -> dict:
    app_dir = TEMPLATE_DIR / "app"
    tests_dir = TEMPLATE_DIR / "tests"
    if not app_dir.exists():
        raise RuntimeError("CLI template is incomplete: expected app/ directory")

    cli_env = {
        **os.environ,
        "PYTHONIOENCODING": "utf-8",
        "PYTHONPATH": str(TEMPLATE_DIR),
    }
    compile_targets = ["app"]
    if tests_dir.exists():
        compile_targets.append("tests")

    append_runner_event("run_tests", "Running CLI compile check")
    compile_result = run_command(
        ["python3", "-m", "compileall", *compile_targets],
        cwd=TEMPLATE_DIR,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=False,
        label="cli-compileall",
        env=cli_env,
    )
    tests = [
        {
            "name": "CLI compile check",
            "status": "passed" if compile_result.returncode == 0 else "failed",
            "duration_ms": 0,
            "error": None if compile_result.returncode == 0 else (compile_result.stderr or "compileall failed"),
        }
    ]

    unittest_result = None
    if tests_dir.exists():
        append_runner_event("run_tests", "Running CLI unittest suite")
        unittest_result = run_command(
            ["python3", "-m", "unittest", "discover", "-s", "tests", "-v"],
            cwd=TEMPLATE_DIR,
            stdout_file=stdout_file,
            stderr_file=stderr_file,
            check=False,
            label="cli-unittest",
            env=cli_env,
        )
        tests.append(
            {
                "name": "CLI unittest suite",
                "status": "passed" if unittest_result.returncode == 0 else "failed",
                "duration_ms": 0,
                "error": None if unittest_result.returncode == 0 else (unittest_result.stderr or "unittest failed"),
            }
        )
    else:
        append_runner_event("run_tests", "No CLI tests directory found; compile check is the only runner verification")

    failed = sum(1 for test in tests if test["status"] != "passed")
    passed = len(tests) - failed
    score = round((passed / len(tests)) * 100, 1) if tests else 0.0
    return {
        "passed": passed,
        "failed": failed,
        "score": score,
        "duration_seconds": 0,
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
    ARC_DIR.mkdir(parents=True, exist_ok=True)
    checkpoint = read_checkpoint()
    resume_from_checkpoint = int(checkpoint.get("last_completed_index", 0) or 0) > 0
    runtime_state_restored = bool(checkpoint.get("runtime_state_restored"))
    if not resume_from_checkpoint:
        RUNNER_EVENTS_PATH.write_text("", encoding="utf-8")
    spec = read_spec()
    append_debug_log(f"Runner started with spec: {spec}")
    log_source_mirror_configuration()
    if resume_from_checkpoint and runtime_state_restored and restore_traceability_storage_from_workspace():
        append_runner_event(
            "deploy_agent",
            f"Traceability restored from checkpoint at step {int(checkpoint.get('last_completed_index', 0) or 0)}",
            status="success",
        )
    else:
        initialize_traceability_store()
        seeded_requirements, seeded_scenarios = seed_traceability_requirements()
        append_runner_event(
            "deploy_agent",
            f"Traceability initialized with {seeded_requirements} requirements and {seeded_scenarios} scenarios",
            status="success",
        )

    managed_processes: list[tuple[subprocess.Popen | None, str]] = []
    managed_threads: list[threading.Thread | None] = []

    with STDOUT_PATH.open("w", encoding="utf-8") as stdout_file:
        stderr_file = stdout_file
        try:
            install_agent_dependencies(stdout_file, stderr_file)
            run_generation_agent_with_resume(stdout_file, stderr_file)
            append_runner_event(
                "start_agent",
                "Uploaded agent finished; traceability artifacts are expected to be written directly by the SDK",
                status="success",
            )

            task = spec.get("task", {})
            category = str(task.get("category", "web")).strip().lower() or "web"
            if category not in {"web", "cli"}:
                raise RuntimeError(f"Unsupported task category inside runner: {category}")

            if category == "cli":
                append_runner_event("run_tests", "Preparing CLI verification")
                results = run_cli_template(stdout_file, stderr_file)
                append_runner_event(
                    "run_tests",
                    f"CLI verification parsed: passed={results['passed']}, failed={results['failed']}, score={results['score']}",
                    status="success",
                )
                return 0 if results["failed"] == 0 else 1

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
            return 0 if results["failed"] == 0 else 1
        except Exception as exc:  # noqa: BLE001
            append_debug_log(f"Runner failed: {exc}")
            error_step = "run_tests" if (TESTS_DIR / "playwright.config.ts").exists() else "start_agent"
            append_runner_event(error_step, str(exc), status="error")
            return 1
        finally:
            for process, label in reversed(managed_processes):
                stop_process(process, label)
            for thread in managed_threads:
                join_thread(thread)


if __name__ == "__main__":
    raise SystemExit(main())
