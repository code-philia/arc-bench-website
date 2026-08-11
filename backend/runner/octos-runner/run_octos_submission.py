import json
import os
import re
import shutil
import shlex
import subprocess
import threading
import time
import uuid
from pathlib import Path
from queue import Empty, Queue
from urllib.error import URLError
from urllib.request import urlopen


WORKSPACE_ROOT = Path("/workspace")
PROJECT_DIR = WORKSPACE_ROOT / "template"
REQUIREMENTS_DIR = PROJECT_DIR / "requirements"
TESTS_DIR = WORKSPACE_ROOT / "tests"
SPEC_PATH = WORKSPACE_ROOT / "runner-spec.json"
ARC_DIR = PROJECT_DIR / ".arc"
STDOUT_PATH = ARC_DIR / "stdout.log"
DEBUG_LOG_PATH = WORKSPACE_ROOT / "execution.debug.log"
OCTOS_IMAGE_HOME = Path("/opt/arcbench/.octos")
OCTOS_WORKSPACE_HOME = WORKSPACE_ROOT / ".octos"
RUNNER_EVENTS_PATH = ARC_DIR / "runner-events.jsonl"
TRACEABILITY_DIR = ARC_DIR / "traceability"
TRACEABILITY_SEED_PATH = ARC_DIR / "traceability-seed.json"
PLAYWRIGHT_REPORT_PATH = ARC_DIR / "playwright-report.json"
WEB_APP_PORT = 3000
PLAYWRIGHT_WORKERS = 4
CONSOLE_WRITE_LOCK = threading.Lock()
HEARTBEAT_LOCK = threading.Lock()
HEARTBEAT_STEP = "deploy_agent"
HEARTBEAT_SUMMARY = "Preparing environment"

TRACEABILITY_TABLES = (
    "requirements",
    "scenarios",
    "interfaces",
    "tests",
    "call_edges",
    "node_states",
    "node_contracts",
)


def append_debug_log(message: str) -> None:
    WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
    with DEBUG_LOG_PATH.open("a", encoding="utf-8") as output:
        output.write(f"[{timestamp}] [octos-runner] {message}\n")


def append_debug_block(section: str, content: str) -> None:
    for line in str(content or "").splitlines():
        append_debug_log(f"{section} | {line}")


def stage_for_step(step_key: str) -> str:
    return {
        "deploy_agent": "Preparing environment",
        "start_agent": "Running agent",
        "run_tests": "Evaluating result",
    }.get(step_key, "Running agent")


def append_runner_event(
    step_key: str,
    message: str,
    status: str = "info",
    *,
    heartbeat: bool = False,
    artifact_reference: str | None = None,
) -> None:
    if not heartbeat:
        global HEARTBEAT_STEP, HEARTBEAT_SUMMARY
        with HEARTBEAT_LOCK:
            HEARTBEAT_STEP = step_key
            HEARTBEAT_SUMMARY = message
    payload = {
        "event_id": uuid.uuid4().hex,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
        "step_key": step_key,
        "stage": stage_for_step(step_key),
        "status": status,
        "message": message,
        "summary": message,
        "heartbeat": heartbeat,
        "artifact_reference": artifact_reference,
    }
    RUNNER_EVENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with RUNNER_EVENTS_PATH.open("a", encoding="utf-8") as output:
        output.write(json.dumps(payload, ensure_ascii=True) + "\n")


def start_heartbeat() -> tuple[threading.Event, threading.Thread]:
    stop_event = threading.Event()

    def emit_heartbeats() -> None:
        while not stop_event.wait(30):
            with HEARTBEAT_LOCK:
                step_key = HEARTBEAT_STEP
                summary = HEARTBEAT_SUMMARY
            append_runner_event(step_key, f"Still working: {summary}", heartbeat=True)

    thread = threading.Thread(target=emit_heartbeats, name="runner-heartbeat", daemon=True)
    thread.start()
    return stop_event, thread


def run_environment_preflight() -> None:
    append_runner_event("deploy_agent", "Running environment preflight")
    checks: dict[str, object] = {"timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())}
    try:
        checks["free_disk_bytes"] = shutil.disk_usage(WORKSPACE_ROOT).free
        checks["node_version"] = subprocess.check_output(["node", "--version"], text=True, stderr=subprocess.STDOUT).strip()
        browser_check = subprocess.run(
            [
                "python3",
                "-c",
                "from playwright.sync_api import sync_playwright; "
                "p=sync_playwright().start(); b=p.chromium.launch(); b.close(); p.stop(); print('chromium-ready')",
            ],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        checks["browser_check"] = (browser_check.stdout or browser_check.stderr).strip()
        checks["passed"] = browser_check.returncode == 0
        if browser_check.returncode != 0:
            raise RuntimeError(checks["browser_check"] or "Chromium could not be launched")
    except Exception as exc:
        checks["passed"] = False
        checks["error"] = str(exc)
        write_json_atomic(ARC_DIR / "preflight.json", checks)
        append_runner_event("deploy_agent", f"Environment preflight failed: {exc}", status="error", artifact_reference=".arc/preflight.json")
        raise RuntimeError(f"Environment preflight failed: {exc}") from exc
    write_json_atomic(ARC_DIR / "preflight.json", checks)
    append_runner_event("deploy_agent", "Environment preflight passed", status="success", artifact_reference=".arc/preflight.json")


def append_signal(reason: str, **refresh: bool) -> None:
    payload = {
        "event_id": uuid.uuid4().hex,
        "type": "signal",
        "reason": reason,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
        "stage": "Running agent",
        "status": "info",
        "summary": reason,
        "heartbeat": False,
        "artifact_reference": None,
        "refresh": {
            "submission": bool(refresh.get("submission")),
            "logs": bool(refresh.get("logs")),
            "commit_history": bool(refresh.get("commit_history")),
            "traceability_selected": bool(refresh.get("traceability_selected")),
            "traceability_all": bool(refresh.get("traceability_all")),
            "preview": bool(refresh.get("preview")),
        },
    }
    with RUNNER_EVENTS_PATH.open("a", encoding="utf-8") as output:
        output.write(json.dumps(payload, ensure_ascii=True) + "\n")


def write_json_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(f"{path.suffix}.tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp_path.replace(path)


def read_spec() -> dict:
    if not SPEC_PATH.exists():
        raise RuntimeError("runner-spec.json is missing from the workspace")
    return json.loads(SPEC_PATH.read_text(encoding="utf-8"))


def initialize_traceability_store() -> None:
    TRACEABILITY_DIR.mkdir(parents=True, exist_ok=True)
    for path in TRACEABILITY_DIR.glob("*.json"):
        path.unlink()
    for table_name in TRACEABILITY_TABLES:
        write_json_atomic(TRACEABILITY_DIR / f"{table_name}.json", {})
    if not TRACEABILITY_SEED_PATH.exists():
        append_runner_event("deploy_agent", "Traceability initialized without seed", status="success")
        return
    payload = json.loads(TRACEABILITY_SEED_PATH.read_text(encoding="utf-8"))
    requirements = {
        str(item.get("req_id", "")).strip(): item
        for item in payload.get("requirements", [])
        if isinstance(item, dict) and str(item.get("req_id", "")).strip()
    }
    scenarios = {
        str(item.get("scenario_id", "")).strip(): item
        for item in payload.get("scenarios", [])
        if isinstance(item, dict) and str(item.get("scenario_id", "")).strip()
    }
    write_json_atomic(TRACEABILITY_DIR / "requirements.json", requirements)
    write_json_atomic(TRACEABILITY_DIR / "scenarios.json", scenarios)
    append_runner_event(
        "deploy_agent",
        f"Traceability initialized with {len(requirements)} requirements and {len(scenarios)} scenarios",
        status="success",
    )


def write_console_line(sink_file, source: str, line: str) -> None:
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
    with CONSOLE_WRITE_LOCK:
        sink_file.write(f"[{timestamp}] [{source}] {line.rstrip(chr(10))}\n")
        sink_file.flush()


def stream_pipe(pipe, sink_file, section: str, line_queue: Queue | None = None, collected_lines: list[str] | None = None) -> None:
    try:
        for line in iter(pipe.readline, ""):
            if not line:
                break
            write_console_line(sink_file, section, line)
            if collected_lines is not None:
                collected_lines.append(line)
            append_debug_log(f"{section} | {line.rstrip()}")
            if line_queue is not None:
                line_queue.put((section, line.rstrip("\n")))
    finally:
        pipe.close()


def format_command(command: list[str]) -> str:
    return shlex.join(command)


def run_command(
    command: list[str],
    cwd: Path,
    stdout_file,
    stderr_file,
    *,
    check: bool = True,
    label: str = "command",
    env: dict | None = None,
) -> subprocess.CompletedProcess:
    append_debug_log(f"Executing {label}: {format_command(command)}")
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
    stdout_lines: list[str] = []
    stderr_lines: list[str] = []
    stdout_thread = threading.Thread(target=stream_pipe, args=(process.stdout, stdout_file, f"{label}.stdout", None, stdout_lines), daemon=True)
    stderr_thread = threading.Thread(target=stream_pipe, args=(process.stderr, stderr_file, f"{label}.stderr", None, stderr_lines), daemon=True)
    stdout_thread.start()
    stderr_thread.start()
    return_code = process.wait()
    stdout_thread.join(timeout=2)
    stderr_thread.join(timeout=2)
    completed = subprocess.CompletedProcess(command, return_code, "".join(stdout_lines), "".join(stderr_lines))
    append_debug_log(f"{label} exit code: {completed.returncode}")
    if check and completed.returncode != 0:
        raise subprocess.CalledProcessError(completed.returncode, command, output=completed.stdout, stderr=completed.stderr)
    return completed


def run_streaming_command(
    command: list[str],
    cwd: Path,
    stdout_file,
    stderr_file,
    *,
    label: str,
    env: dict | None = None,
) -> int:
    append_debug_log(f"Executing {label}: {format_command(command)}")
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
    stdout_thread = threading.Thread(
        target=stream_pipe,
        args=(process.stdout, stdout_file, f"{label}.stdout"),
        daemon=True,
    )
    stderr_thread = threading.Thread(
        target=stream_pipe,
        args=(process.stderr, stderr_file, f"{label}.stderr"),
        daemon=True,
    )
    stdout_thread.start()
    stderr_thread.start()
    return_code = process.wait()
    stdout_thread.join(timeout=2)
    stderr_thread.join(timeout=2)
    append_debug_log(f"{label} exit code: {return_code}")
    return int(return_code)


def build_npm_environment() -> dict[str, str]:
    npm_env = dict(os.environ)
    npm_env.pop("NPM_CONFIG_REGISTRY", None)
    npm_env["NPM_CONFIG_REPLACE_REGISTRY_HOST"] = "npmjs"
    return npm_env


def ensure_git_repo(stdout_file, stderr_file) -> None:
    run_command(["git", "init"], PROJECT_DIR, stdout_file, stderr_file, label="git-init")
    run_command(["git", "config", "user.email", os.environ.get("ARC_GIT_USER_EMAIL", "arcbench@example.local")], PROJECT_DIR, stdout_file, stderr_file, label="git-config-email")
    run_command(["git", "config", "user.name", os.environ.get("ARC_GIT_USER_NAME", "ARC-Bench Octos Runner")], PROJECT_DIR, stdout_file, stderr_file, label="git-config-name")
    run_command(["git", "add", "-A"], PROJECT_DIR, stdout_file, stderr_file, label="git-add-initial")
    run_command(["git", "commit", "-m", "ARC-Bench project baseline"], PROJECT_DIR, stdout_file, stderr_file, check=False, label="git-commit-initial")


def commit_octos_changes(stdout_file, stderr_file) -> None:
    run_command(["git", "add", "-A"], PROJECT_DIR, stdout_file, stderr_file, label="git-add-octos")
    diff = run_command(["git", "diff", "--cached", "--quiet"], PROJECT_DIR, stdout_file, stderr_file, check=False, label="git-diff-cached")
    if diff.returncode == 0:
        append_runner_event("start_agent", "Octos completed without staged source changes", status="warning")
        return
    run_command(["git", "commit", "-m", "Octos: implement ARC-Bench requirements"], PROJECT_DIR, stdout_file, stderr_file, label="git-commit-octos")
    append_signal("octos_commit", logs=True, commit_history=True, preview=True)


def build_octos_prompt(spec: dict) -> str:
    task = spec.get("task", {}) if isinstance(spec, dict) else {}
    requirement_id = str(task.get("requirement_id") or "").strip() or "current task"
    category = str(task.get("category") or "web").strip() or "web"
    if category == "cli":
        verification = (
            "The benchmark runner will later run python3 -m compileall app [tests] "
            "and, when tests/ exists, python3 -m unittest discover -s tests -v."
        )
    else:
        verification = (
            "You may run build and validation commands yourself, such as npm install, npm run build, "
            f"starting the backend on port {WEB_APP_PORT}."
        )
    return f"""
Goal:
Implement all requirements for {requirement_id} in the existing {category} starter project.

Workspace contract:
- The current project root is {PROJECT_DIR}.
- Modify only the project under {PROJECT_DIR}.
- Read the requirement tree directly from the relative path `requirements/requirements.yaml`.
- Inspect any referenced assets under `requirements/` when needed.
- {verification}
- Do not start a long-running server as your final action.
- Do not move the project root or replace it with a separate app outside this directory.
- Keep generated implementation compatible with the existing {category} template.

Evidence and progress:
- Commit meaningful changes if your tools expose git.
- If you can write machine-readable progress, use .arc/runner-events.jsonl and .arc/traceability/*.json, but implementation correctness is the priority.
- Consider using the preinstalled `arcbench-checkpoint` skill to record milestone progress after meaningful implementation steps.
- Consider using the preinstalled `arcbench-runtime-signals` skill when you run local builds, servers, previews, or tests and want to capture runtime status.
- Consider using the preinstalled `arcbench-traceability` skill to map implemented changes and evidence back to requirement-tree items.
""".strip()


def build_octos_command(prompt: str) -> list[str]:
    return [
        "octos",
        "chat",
        "--sandbox",
        "danger-full-access",
        "--cwd",
        str(PROJECT_DIR),
        "--message",
        prompt,
        "--json",
    ]


def run_octos_agent(stdout_file, stderr_file, spec: dict) -> None:
    prepare_octos_home()
    append_runner_event("start_agent", "Constructing Octos prompt")
    prompt = build_octos_prompt(spec)
    prompt_path = ARC_DIR / "octos-prompt.md"
    prompt_path.write_text(prompt + "\n", encoding="utf-8")
    append_runner_event("start_agent", "Launching Octos CLI")
    exit_code = run_streaming_command(
        build_octos_command(prompt),
        PROJECT_DIR,
        stdout_file,
        stderr_file,
        label="octos-chat",
        env={
            **os.environ,
            "OCTOS_HOME": str(OCTOS_WORKSPACE_HOME),
            "OCTOS_DISABLE_STREAMING": "1",
        },
    )
    if exit_code != 0:
        raise RuntimeError(f"Octos CLI exited with code {exit_code}")
    append_runner_event("start_agent", "Octos CLI finished", status="success")


def prepare_octos_home() -> None:
    OCTOS_WORKSPACE_HOME.mkdir(parents=True, exist_ok=True)
    source_skills_dir = OCTOS_IMAGE_HOME / "skills"
    target_skills_dir = OCTOS_WORKSPACE_HOME / "skills"
    if not source_skills_dir.is_dir():
        append_debug_log(f"No preinstalled Octos skills found at {source_skills_dir}")
        return
    shutil.copytree(source_skills_dir, target_skills_dir, dirs_exist_ok=True)
    installed = sorted(path.name for path in target_skills_dir.iterdir() if path.is_dir())
    append_debug_log(f"Prepared Octos skills in workspace: {', '.join(installed) or '<none>'}")
    write_octos_config()


def write_octos_config() -> None:
    model = os.environ.get("MODEL", "").strip()
    if not model:
        raise RuntimeError("MODEL is required for built-in Octos Agent submissions")
    base_url = (
        os.environ.get("OCTOS_BASE_URL", "").strip()
        or os.environ.get("OPENAI_BASE_URL", "").strip()
        or "https://2api.aiwanwu.cc/v1"
    )
    config = {
        "provider": "custom",
        "model": model,
        "api_key_env": "OPENAI_API_KEY",
        "base_url": base_url,
        "api_type": "openai",
    }
    write_json_atomic(OCTOS_WORKSPACE_HOME / "config.json", config)
    append_debug_log(
        "Wrote Octos config: "
        f"provider=custom model={model} base_url={base_url} api_key_env=OPENAI_API_KEY api_type=openai"
    )


def install_node_dependencies(path: Path, stdout_file, stderr_file, label: str) -> None:
    append_runner_event("run_tests", f"Installing dependencies for {label}")
    run_command(
        ["npm", "install", "--no-audit", "--no-fund"],
        cwd=path,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        label=f"{label}-npm-install",
        env=build_npm_environment(),
    )
    append_runner_event("run_tests", f"Dependencies installed for {label}", status="success")


def start_background_process(command: list[str], cwd: Path, stdout_file, stderr_file, label: str, env: dict | None = None):
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
    last_error = ""
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=3) as response:
                if 200 <= response.status < 500:
                    return
        except URLError as exc:
            last_error = str(exc)
        time.sleep(1)
    raise RuntimeError(f"Timed out waiting for {label}: {last_error}")


def write_playwright_config(base_url: str) -> None:
    config = f"""
import {{ defineConfig }} from '@playwright/test';

export default defineConfig({{
  testDir: '.',
  timeout: 30000,
  expect: {{ timeout: 5000 }},
  reporter: [['json', {{ outputFile: '{PLAYWRIGHT_REPORT_PATH.as_posix()}' }}]],
  use: {{
    baseURL: '{base_url}',
    trace: 'retain-on-failure',
  }},
}});
"""
    (TESTS_DIR / "playwright.config.ts").write_text(config.strip() + "\n", encoding="utf-8")


def ensure_test_package(stdout_file, stderr_file) -> None:
    package_json = {
        "name": "arcbench-tests",
        "private": True,
        "type": "module",
        "devDependencies": {"@playwright/test": "1.54.0"},
    }
    (TESTS_DIR / "package.json").write_text(json.dumps(package_json, indent=2) + "\n", encoding="utf-8")
    bundled_modules = Path("/opt/arcbench/node_modules")
    target_modules = TESTS_DIR / "node_modules"
    if not bundled_modules.is_dir():
        raise RuntimeError("Runner image is missing its preinstalled Playwright test package")
    if target_modules.exists() or target_modules.is_symlink():
        if target_modules.resolve() != bundled_modules.resolve():
            raise RuntimeError("Test workspace contains unexpected node_modules; use the immutable runner package instead")
    else:
        target_modules.symlink_to(bundled_modules, target_is_directory=True)
    append_runner_event("run_tests", "Using preinstalled Playwright package from runner image", status="success")


def count_playwright_tests() -> int:
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
    if "No tests found" in (completed.stderr or "") and "Total: 0 tests" in (completed.stdout or ""):
        return 0
    if completed.returncode != 0:
        raise RuntimeError("Failed to enumerate Playwright tests before execution")
    total_match = re.search(r"Total:\s+(\d+)\s+tests?\b", completed.stdout or "")
    if total_match:
        return int(total_match.group(1))
    return sum(1 for line in (completed.stdout or "").splitlines() if line.strip().startswith("["))


def run_playwright_tests(stdout_file, stderr_file) -> subprocess.CompletedProcess:
    total_tests = count_playwright_tests()
    if total_tests == 0:
        append_runner_event("run_tests", "No Playwright tests found; skipping test execution", status="success")
        return subprocess.CompletedProcess(["npx", "playwright", "test"], returncode=0)
    append_runner_event("run_tests", f"Executing tests with {PLAYWRIGHT_WORKERS} workers")
    append_runner_event("run_tests", f"Test progress 0/{total_tests}")
    process = subprocess.Popen(
        ["npx", "playwright", "test", f"--workers={PLAYWRIGHT_WORKERS}"],
        cwd=str(TESTS_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        errors="replace",
        bufsize=1,
    )
    line_queue: Queue = Queue()
    stdout_thread = threading.Thread(target=stream_pipe, args=(process.stdout, stdout_file, "playwright.stdout", line_queue), daemon=True)
    stderr_thread = threading.Thread(target=stream_pipe, args=(process.stderr, stderr_file, "playwright.stderr", line_queue), daemon=True)
    stdout_thread.start()
    stderr_thread.start()
    managed_count = 0
    while process.poll() is None or not line_queue.empty():
        try:
            section, line = line_queue.get(timeout=0.5)
        except Empty:
            continue
        if section.endswith("stdout") and line.lstrip().startswith(("-", "x", "X")):
            managed_count += 1
            append_runner_event("run_tests", f"Test progress {managed_count}/{total_tests}")
    stdout_thread.join(timeout=2)
    stderr_thread.join(timeout=2)
    append_runner_event("run_tests", f"Test progress {managed_count}/{total_tests}", status="success")
    return subprocess.CompletedProcess(["npx", "playwright", "test"], returncode=process.returncode or 0)


def run_web_template(stdout_file, stderr_file):
    frontend_dir = PROJECT_DIR / "frontend"
    backend_dir = PROJECT_DIR / "backend"
    if not frontend_dir.exists() or not backend_dir.exists():
        raise RuntimeError("web template is incomplete: expected frontend/ and backend/ directories")
    install_node_dependencies(frontend_dir, stdout_file, stderr_file, "frontend")
    append_runner_event("run_tests", "Building template frontend")
    run_command(["npm", "run", "build"], frontend_dir, stdout_file, stderr_file, label="frontend-npm-build")
    append_runner_event("run_tests", "Template frontend built", status="success")
    install_node_dependencies(backend_dir, stdout_file, stderr_file, "backend")
    append_runner_event("run_tests", "Starting template application server")
    backend_process, backend_stdout_thread, backend_stderr_thread = start_background_process(
        ["npm", "run", "start"],
        backend_dir,
        stdout_file,
        stderr_file,
        "template-app",
        env={**os.environ, "HOST": "0.0.0.0", "PORT": str(WEB_APP_PORT)},
    )
    wait_for_http_ready(f"http://127.0.0.1:{WEB_APP_PORT}", 120, "template application server")
    append_runner_event("run_tests", f"Template application is reachable on http://127.0.0.1:{WEB_APP_PORT}", status="success")
    return backend_process, backend_stdout_thread, backend_stderr_thread


def write_synthetic_playwright_report(tests: list[dict]) -> None:
    specs = []
    for item in tests:
        status = "passed" if item.get("status") == "passed" else "failed"
        error = item.get("error")
        result = {
            "status": status,
            "duration": int(item.get("duration_ms") or 0),
            "errors": [{"message": str(error)}] if error else [],
        }
        specs.append(
            {
                "title": str(item.get("name") or "CLI verification"),
                "tests": [
                    {
                        "expectedStatus": "passed",
                        "status": "expected" if status == "passed" else "unexpected",
                        "results": [result],
                    }
                ],
            }
        )
    write_json_atomic(PLAYWRIGHT_REPORT_PATH, {"suites": [{"title": "CLI verification", "specs": specs, "suites": []}]})


def run_cli_template(stdout_file, stderr_file) -> dict:
    app_dir = PROJECT_DIR / "app"
    tests_dir = PROJECT_DIR / "tests"
    if not app_dir.exists():
        raise RuntimeError("CLI template is incomplete: expected app/ directory")

    cli_env = {
        **os.environ,
        "PYTHONIOENCODING": "utf-8",
        "PYTHONPATH": str(PROJECT_DIR),
    }
    compile_targets = ["app"]
    if tests_dir.exists():
        compile_targets.append("tests")

    append_runner_event("run_tests", "Running CLI compile check")
    compile_result = run_command(
        ["python3", "-m", "compileall", *compile_targets],
        PROJECT_DIR,
        stdout_file,
        stderr_file,
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

    if tests_dir.exists():
        append_runner_event("run_tests", "Running CLI unittest suite")
        unittest_result = run_command(
            ["python3", "-m", "unittest", "discover", "-s", "tests", "-v"],
            PROJECT_DIR,
            stdout_file,
            stderr_file,
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

    write_synthetic_playwright_report(tests)
    failed = sum(1 for test in tests if test["status"] != "passed")
    passed = len(tests) - failed
    score = round((passed / len(tests)) * 100, 1) if tests else 0.0
    return {"passed": passed, "failed": failed, "score": score, "tests": tests}


def stop_process(process, label: str) -> None:
    if process is None or process.poll() is not None:
        return
    append_debug_log(f"Stopping process {label}")
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


def main() -> int:
    ARC_DIR.mkdir(parents=True, exist_ok=True)
    RUNNER_EVENTS_PATH.write_text("", encoding="utf-8")
    spec = read_spec()
    heartbeat_stop, heartbeat_thread = start_heartbeat()
    append_debug_log(f"Octos runner started with spec: {spec}")
    initialize_traceability_store()
    managed_processes = []
    managed_threads = []
    with STDOUT_PATH.open("a", encoding="utf-8") as stdout_file:
        stderr_file = stdout_file
        try:
            run_environment_preflight()
            ensure_git_repo(stdout_file, stderr_file)
            run_octos_agent(stdout_file, stderr_file, spec)
            commit_octos_changes(stdout_file, stderr_file)
            task = spec.get("task", {})
            category = str(task.get("category", "web")).strip().lower() or "web"
            if category not in {"web", "cli"}:
                raise RuntimeError(f"Unsupported task category inside Octos runner: {category}")
            if category == "cli":
                append_runner_event("run_tests", "Preparing CLI verification")
                results = run_cli_template(stdout_file, stderr_file)
                append_runner_event(
                    "run_tests",
                    f"CLI verification parsed: passed={results['passed']}, failed={results['failed']}, score={results['score']}",
                    status="success",
                )
                return 0 if results["failed"] == 0 else 1
            process, out_thread, err_thread = run_web_template(stdout_file, stderr_file)
            managed_processes.append((process, "template application server"))
            managed_threads.extend([out_thread, err_thread])
            append_runner_event("run_tests", "Preparing Playwright configuration")
            write_playwright_config(f"http://127.0.0.1:{WEB_APP_PORT}")
            ensure_test_package(stdout_file, stderr_file)
            result = run_playwright_tests(stdout_file, stderr_file)
            append_runner_event("run_tests", f"Playwright test process finished with code {result.returncode}")
            return 0 if result.returncode == 0 else 1
        except Exception as exc:
            append_debug_log(f"Octos runner failed: {exc}")
            append_runner_event("start_agent", str(exc), status="error")
            return 1
        finally:
            heartbeat_stop.set()
            heartbeat_thread.join(timeout=1)
            for process, label in reversed(managed_processes):
                stop_process(process, label)
            for thread in managed_threads:
                if thread is not None:
                    thread.join(timeout=2)


if __name__ == "__main__":
    raise SystemExit(main())
