import json
import os
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

WEB_APP_PORT = 3000
PLAYWRIGHT_WORKERS = 4


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


def run_generation_agent(stdout_file, stderr_file) -> None:
    entrypoint = resolve_python_agent_entrypoint()
    prompt = PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else ""
    command = ["python3", entrypoint.name]
    append_runner_event("start_agent", "Launching generation agent")
    env = {
        **os.environ,
        "ARCBENCH_TASK_PROMPT": prompt,
        "ARCBENCH_PROMPT_PATH": str(PROMPT_PATH),
        "ARCBENCH_TEMPLATE_DIR": str(TEMPLATE_DIR),
        "ARCBENCH_TASK_DIR": str(TASK_DIR),
        "ARCBENCH_SUBMISSION_DIR": str(SUBMISSION_DIR),
        "ARCBENCH_OUTPUT_DIR": str(TEMPLATE_DIR),
        "ARCBENCH_ARTIFACTS_DIR": str(ARTIFACTS_DIR),
        "ARCBENCH_RUNNER_EVENTS_PATH": str(RUNNER_EVENTS_PATH),
        "ARCBENCH_SDK_DIR": str(SDK_DIR),
        "PYTHONPATH": f"{SDK_DIR}:{os.environ.get('PYTHONPATH', '')}" if os.environ.get("PYTHONPATH") else str(SDK_DIR),
    }
    completed = run_command(
        command,
        cwd=SUBMISSION_DIR,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=True,
        label="generation-agent",
        env=env,
    )
    append_runner_event("start_agent", f"Generation agent finished with code {completed.returncode}", status="success")


def install_node_dependencies(project_dir: Path, stdout_file, stderr_file, label: str, step_key: str) -> None:
    append_runner_event(step_key, f"Installing dependencies for {label}")
    run_command(["npm", "install"], cwd=project_dir, stdout_file=stdout_file, stderr_file=stderr_file, check=True, label=f"{label}-npm-install")
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
    append_runner_event("run_tests", "Installing Chromium browser")
    run_command(["npx", "playwright", "install", "--with-deps", "chromium"], cwd=TESTS_DIR, stdout_file=stdout_file, stderr_file=stderr_file, check=True, label="playwright-install")
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
    if completed.returncode != 0:
        raise RuntimeError("Failed to enumerate Playwright tests before execution")
    return sum(1 for line in completed.stdout.splitlines() if line.strip().startswith("["))


def run_playwright_tests_with_progress(stdout_file, stderr_file) -> subprocess.Popen:
    command = ["npx", "playwright", "test", f"--workers={PLAYWRIGHT_WORKERS}"]
    append_runner_event("run_tests", "Deploying generated application", status="info")
    append_runner_event("run_tests", f"Generated application is reachable on http://127.0.0.1:{WEB_APP_PORT}", status="success")
    append_runner_event("run_tests", "Deploying test environment", status="info")
    append_runner_event("run_tests", f"Test environment ready with {PLAYWRIGHT_WORKERS} workers", status="success")
    total_tests = count_playwright_tests()
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
        return {"passed": 0, "failed": 0, "score": 0, "duration_seconds": 0, "tests": []}

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
    score = round((passed / total) * 100, 1) if total else 0.0
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
        ["npm", "run", "dev"],
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
    RUNNER_EVENTS_PATH.write_text("", encoding="utf-8")
    spec = read_spec()
    append_debug_log(f"Runner started with spec: {spec}")

    managed_processes: list[tuple[subprocess.Popen | None, str]] = []
    managed_threads: list[threading.Thread | None] = []

    with STDOUT_PATH.open("w", encoding="utf-8") as stdout_file, STDERR_PATH.open("w", encoding="utf-8") as stderr_file:
        try:
            install_agent_dependencies(stdout_file, stderr_file)
            run_generation_agent(stdout_file, stderr_file)

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
