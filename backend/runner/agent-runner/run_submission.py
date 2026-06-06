import json
import os
import threading
import signal
import subprocess
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen


WORKSPACE_ROOT = Path("/workspace")
AGENT_DIR = WORKSPACE_ROOT / "agent"
TESTS_DIR = WORKSPACE_ROOT / "tests"
ARTIFACTS_DIR = WORKSPACE_ROOT / "artifacts"
REQUIREMENT_MARKDOWN_PATH = WORKSPACE_ROOT / "requirement" / "requirements.md"
CONFIG_PATH = AGENT_DIR / "arcbench.config.json"
RESULT_PATH = ARTIFACTS_DIR / "result.json"
STDOUT_PATH = ARTIFACTS_DIR / "stdout.log"
STDERR_PATH = ARTIFACTS_DIR / "stderr.log"
DEBUG_LOG_PATH = WORKSPACE_ROOT / "execution.debug.log"
RUNNER_EVENTS_PATH = ARTIFACTS_DIR / "runner-events.jsonl"


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
            append_debug_log(f"{section} | {line.rstrip()}" )
    finally:
        pipe.close()


def run_command(command: list[str], cwd: Path, stdout_file, stderr_file, check: bool = True, label: str = "command") -> subprocess.CompletedProcess:
    append_debug_log(f"Executing {label}: {' '.join(command)}")
    completed = subprocess.run(
        command,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        errors="replace",
        check=False,
    )
    append_debug_log(f"{label} exit code: {completed.returncode}")
    if completed.stdout:
        append_debug_block(f"{label}.stdout", completed.stdout)
    if completed.stderr:
        append_debug_block(f"{label}.stderr", completed.stderr)
    if check and completed.returncode != 0:
        raise subprocess.CalledProcessError(completed.returncode, command, output=completed.stdout, stderr=completed.stderr)
    return completed


def read_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return {}


def resolve_python_entrypoint() -> Path:
    entrypoint = AGENT_DIR / "main.py"
    if entrypoint.exists():
        return entrypoint
    raise RuntimeError("unsupported python entrypoint: expected main.py at the archive root")


def install_python_dependencies(stdout_file, stderr_file) -> None:
    requirements_path = AGENT_DIR / "requirements.txt"
    if not requirements_path.exists():
        append_debug_log("No requirements.txt found, skipping dependency install")
        return
    append_debug_log("Running pip install -r requirements.txt")
    append_runner_event("start_agent", "Installing Python dependencies")
    run_command(
        [
            "python3",
            "-m",
            "pip",
            "install",
            "--no-cache-dir",
            "-r",
            "requirements.txt",
        ],
        cwd=AGENT_DIR,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=True,
        label="pip-install",
    )
    append_debug_log("Dependency installation completed")
    append_runner_event("start_agent", "Python dependencies installed", status="success")


def wait_for_healthcheck(url: str, timeout_seconds: int) -> None:
    deadline = time.time() + timeout_seconds
    append_debug_log(f"Waiting for healthcheck at {url} with timeout={timeout_seconds}s")
    append_runner_event("start_agent", f"Waiting for agent healthcheck on {url}")
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=2) as response:
                if response.status < 500:
                    append_debug_log(f"Healthcheck passed with status={response.status}")
                    append_runner_event("start_agent", f"Agent healthcheck passed with status {response.status}", status="success")
                    return
        except (URLError, TimeoutError):
            time.sleep(1)
    raise TimeoutError(f"Agent health check did not pass within {timeout_seconds} seconds")


def build_playwright_config() -> None:
    append_debug_log("Writing Playwright config")
    append_runner_event("run_tests", "Writing Playwright config")
    config = """
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [['json', { outputFile: '../artifacts/playwright-report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'off',
    screenshot: 'off',
  },
});
"""
    (TESTS_DIR / "playwright.config.ts").write_text(config.strip() + "\n", encoding="utf-8")


def ensure_test_package(stdout_file, stderr_file) -> None:
    append_debug_log("Writing Playwright package.json")
    append_runner_event("run_tests", "Preparing Playwright test package")
    package_json = {
        "name": "arcbench-tests",
        "private": True,
        "type": "module",
        "devDependencies": {
            "@playwright/test": "1.54.0"
        }
    }
    (TESTS_DIR / "package.json").write_text(json.dumps(package_json, indent=2) + "\n", encoding="utf-8")
    append_debug_log("Running npm install in tests directory")
    append_runner_event("run_tests", "Installing Playwright dependencies")
    run_command(["npm", "install"], cwd=TESTS_DIR, stdout_file=stdout_file, stderr_file=stderr_file, check=True, label="npm-install")
    append_debug_log("Installing Playwright browser dependencies")
    append_runner_event("run_tests", "Installing Chromium browser")
    run_command(
        ["npx", "playwright", "install", "--with-deps", "chromium"],
        cwd=TESTS_DIR,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=True,
        label="playwright-install",
    )
    append_debug_log("Playwright environment is ready")
    append_runner_event("run_tests", "Playwright environment is ready", status="success")


def parse_playwright_results() -> dict:
    report_path = ARTIFACTS_DIR / "playwright-report.json"
    if not report_path.exists():
        append_debug_log("Playwright report not found, returning empty result")
        return {"passed": 0, "failed": 0, "score": 0, "duration_seconds": 0, "tests": []}
    append_debug_log(f"Parsing Playwright report from {report_path}")
    append_runner_event("run_tests", "Parsing Playwright report")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    tests = []
    passed = 0
    failed = 0
    total_duration_ms = 0

    def walk_suite(suite: dict) -> None:
        nonlocal passed, failed, total_duration_ms
        for spec in suite.get("specs", []):
            title = spec.get("title", "Unnamed spec")
            for test in spec.get("tests", []):
                status = test.get("status", "unknown")
                duration = sum(result.get("duration", 0) for result in test.get("results", []))
                total_duration_ms += duration
                if status == "passed":
                    passed += 1
                else:
                    failed += 1
                error_text = None
                for result in test.get("results", []):
                    errors = result.get("errors", [])
                    if errors:
                        error_text = errors[0].get("message")
                        break
                tests.append(
                    {
                        "name": title,
                        "status": status,
                        "duration_ms": duration,
                        "error": error_text,
                    }
                )
        for child in suite.get("suites", []):
            walk_suite(child)

    for suite in report.get("suites", []):
        walk_suite(suite)

    total = passed + failed
    score = round((passed / total) * 100, 1) if total else 0.0
    append_debug_log(f"Playwright results parsed: passed={passed}, failed={failed}, score={score}")
    append_runner_event("run_tests", f"Playwright results parsed: passed={passed}, failed={failed}, score={score}", status="success")
    return {
        "passed": passed,
        "failed": failed,
        "score": score,
        "duration_seconds": round(total_duration_ms / 1000, 2),
        "tests": tests,
    }


def main() -> int:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    RUNNER_EVENTS_PATH.write_text("", encoding="utf-8")
    append_debug_log("Runner started")
    config = read_config()
    health_url = config.get("healthcheck_url", "http://127.0.0.1:3000")
    timeout_seconds = int(os.environ.get("AGENT_HEALTH_TIMEOUT_SECONDS", "90"))
    entrypoint = resolve_python_entrypoint()
    append_debug_log(f"Resolved entrypoint: {entrypoint}")
    append_debug_log(f"Requirements markdown path: {REQUIREMENT_MARKDOWN_PATH}")

    with STDOUT_PATH.open("w", encoding="utf-8") as stdout_file, STDERR_PATH.open("w", encoding="utf-8") as stderr_file:
        agent_process = None
        stdout_thread = None
        stderr_thread = None
        try:
            install_python_dependencies(stdout_file, stderr_file)

            command = ["python3", entrypoint.name, "-r", str(REQUIREMENT_MARKDOWN_PATH)]
            append_debug_log(f"Launching agent command: {' '.join(command)}")
            append_runner_event("start_agent", "Launching uploaded agent")
            agent_process = subprocess.Popen(
                command,
                cwd=str(AGENT_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                errors="replace",
                bufsize=1,
                env={
                    **os.environ,
                    "HOST": "0.0.0.0",
                    "PORT": "3000",
                },
            )
            append_debug_log(f"Agent process started with pid={agent_process.pid}")
            append_runner_event("start_agent", f"Agent process started (pid={agent_process.pid})", status="success")
            stdout_thread = threading.Thread(
                target=stream_pipe,
                args=(agent_process.stdout, stdout_file, "agent.stdout"),
                daemon=True,
            )
            stderr_thread = threading.Thread(
                target=stream_pipe,
                args=(agent_process.stderr, stderr_file, "agent.stderr"),
                daemon=True,
            )
            stdout_thread.start()
            stderr_thread.start()
            wait_for_healthcheck(health_url, timeout_seconds)
            agent_poll_result = agent_process.poll()
            append_debug_log(f"Agent process state after healthcheck: {'running' if agent_poll_result is None else f'exited({agent_poll_result})'}")

            build_playwright_config()
            ensure_test_package(stdout_file, stderr_file)
            append_debug_log("Running Playwright tests via npx playwright test")
            append_runner_event("run_tests", "Running Playwright tests")
            playwright_result = run_command(
                ["npx", "playwright", "test"],
                cwd=TESTS_DIR,
                stdout_file=stdout_file,
                stderr_file=stderr_file,
                check=False,
                label="playwright-test",
            )
            append_debug_log(f"Playwright test process finished with code={playwright_result.returncode}")
            append_runner_event("run_tests", f"Playwright test process finished with code {playwright_result.returncode}")

            results = parse_playwright_results()
            RESULT_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")
            append_debug_log(f"Result file written to {RESULT_PATH}")
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
            append_debug_log(f"Fallback result file written to {RESULT_PATH}")
            return 1
        finally:
            if agent_process and agent_process.poll() is None:
                append_debug_log("Stopping agent process with SIGTERM")
                agent_process.send_signal(signal.SIGTERM)
                try:
                    agent_process.wait(timeout=10)
                    append_debug_log("Agent process exited after SIGTERM")
                except subprocess.TimeoutExpired:
                    append_debug_log("Agent process did not exit after SIGTERM, killing process")
                    agent_process.kill()
                    append_debug_log("Agent process killed")
            if agent_process:
                try:
                    agent_process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    pass
            if stdout_thread is not None:
                stdout_thread.join(timeout=2)
            if stderr_thread is not None:
                stderr_thread.join(timeout=2)


if __name__ == "__main__":
    raise SystemExit(main())
