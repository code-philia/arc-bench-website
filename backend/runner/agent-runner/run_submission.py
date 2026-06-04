import json
import os
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
CONFIG_PATH = AGENT_DIR / "arcbench.config.json"
RESULT_PATH = ARTIFACTS_DIR / "result.json"
STDOUT_PATH = ARTIFACTS_DIR / "stdout.log"
STDERR_PATH = ARTIFACTS_DIR / "stderr.log"


def read_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return {}


def resolve_python_entrypoint() -> Path:
    for candidate in ("main.py", "app.py"):
        entrypoint = AGENT_DIR / candidate
        if entrypoint.exists():
            return entrypoint
    raise RuntimeError("unsupported python entrypoint: expected main.py or app.py at the archive root")


def install_python_dependencies(stdout_file, stderr_file) -> None:
    requirements_path = AGENT_DIR / "requirements.txt"
    if not requirements_path.exists():
        return
    subprocess.run(
        [
            "python3",
            "-m",
            "pip",
            "install",
            "--no-cache-dir",
            "-r",
            "requirements.txt",
        ],
        cwd=str(AGENT_DIR),
        stdout=stdout_file,
        stderr=stderr_file,
        check=True,
    )


def wait_for_healthcheck(url: str, timeout_seconds: int) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=2) as response:
                if response.status < 500:
                    return
        except (URLError, TimeoutError):
            time.sleep(1)
    raise TimeoutError(f"Agent health check did not pass within {timeout_seconds} seconds")


def build_playwright_config() -> None:
    config = """
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  fullyParallel: false,
  reporter: [['json', { outputFile: '../artifacts/playwright-report.json' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'off',
    screenshot: 'off',
  },
});
"""
    (TESTS_DIR / "playwright.config.ts").write_text(config.strip() + "\n", encoding="utf-8")


def ensure_test_package(stdout_file, stderr_file) -> None:
    package_json = {
        "name": "arcbench-tests",
        "private": True,
        "type": "module",
        "devDependencies": {
            "@playwright/test": "^1.54.1"
        }
    }
    (TESTS_DIR / "package.json").write_text(json.dumps(package_json, indent=2) + "\n", encoding="utf-8")
    subprocess.run(["npm", "install"], cwd=str(TESTS_DIR), stdout=stdout_file, stderr=stderr_file, check=True)


def parse_playwright_results() -> dict:
    report_path = ARTIFACTS_DIR / "playwright-report.json"
    if not report_path.exists():
        return {"passed": 0, "failed": 0, "score": 0, "duration_seconds": 0, "tests": []}
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
    return {
        "passed": passed,
        "failed": failed,
        "score": score,
        "duration_seconds": round(total_duration_ms / 1000, 2),
        "tests": tests,
    }


def main() -> int:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    config = read_config()
    health_url = config.get("healthcheck_url", "http://127.0.0.1:3000")
    timeout_seconds = int(os.environ.get("AGENT_HEALTH_TIMEOUT_SECONDS", "90"))
    entrypoint = resolve_python_entrypoint()

    with STDOUT_PATH.open("w", encoding="utf-8") as stdout_file, STDERR_PATH.open("w", encoding="utf-8") as stderr_file:
        agent_process = None
        try:
            install_python_dependencies(stdout_file, stderr_file)

            agent_process = subprocess.Popen(
                ["python3", entrypoint.name],
                cwd=str(AGENT_DIR),
                stdout=stdout_file,
                stderr=stderr_file,
                env={
                    **os.environ,
                    "HOST": "0.0.0.0",
                    "PORT": "3000",
                },
            )
            wait_for_healthcheck(health_url, timeout_seconds)

            build_playwright_config()
            ensure_test_package(stdout_file, stderr_file)
            subprocess.run(
                ["npx", "playwright", "test"],
                cwd=str(TESTS_DIR),
                stdout=stdout_file,
                stderr=stderr_file,
                env={**os.environ, "BASE_URL": "http://127.0.0.1:3000"},
                check=False,
            )

            results = parse_playwright_results()
            RESULT_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")
            return 0 if results["failed"] == 0 else 1
        except Exception as exc:  # noqa: BLE001
            stderr_file.write(f"{exc}\n")
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
            if agent_process and agent_process.poll() is None:
                agent_process.send_signal(signal.SIGTERM)
                try:
                    agent_process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    agent_process.kill()


if __name__ == "__main__":
    raise SystemExit(main())
