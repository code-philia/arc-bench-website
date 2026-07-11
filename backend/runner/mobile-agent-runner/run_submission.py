import json
import math
import os
import re
import signal
import shutil
import sqlite3
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import uiautomator2 as u2


WORKSPACE_ROOT = Path("/workspace")
SUBMISSION_DIR = WORKSPACE_ROOT / "submission"
TEMPLATE_DIR = WORKSPACE_ROOT / "template"
TASK_DIR = WORKSPACE_ROOT / "task"
TASK_INFO_PATH = TASK_DIR / "task_info.json"
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
TRACEABILITY_DB_PATH = ARTIFACTS_DIR / "traceability.db"
TRACEABILITY_SEED_PATH = ARTIFACTS_DIR / "traceability-seed.json"
PAUSE_REQUEST_PATH = ARTIFACTS_DIR / "pause.request.json"
RESUME_REQUEST_PATH = ARTIFACTS_DIR / "resume.request.json"
CHECKPOINT_PATH = ARTIFACTS_DIR / "checkpoint.json"

BUILD_DIR = ARTIFACTS_DIR / "build"
BUILD_OUTPUTS_DIR = BUILD_DIR / "outputs"
BUILD_LOG_PATH = BUILD_DIR / "build.log"
BUILD_METADATA_PATH = BUILD_DIR / "metadata.json"
DEVICE_DIR = ARTIFACTS_DIR / "device"
SCREENSHOTS_DIR = DEVICE_DIR / "screenshots"
UI_DUMPS_DIR = DEVICE_DIR / "ui_dumps"
LOGCAT_PATH = DEVICE_DIR / "logcat.txt"
EVALUATION_DIR = ARTIFACTS_DIR / "evaluation"
FUNCTIONAL_RESULTS_PATH = EVALUATION_DIR / "functional-results.json"
WIDGET_RESULTS_PATH = EVALUATION_DIR / "widget-results.json"
TEST_RESULTS_PATH = EVALUATION_DIR / "test-results.json"

AGENT_SOURCE_UPLOAD = "upload"
AGENT_SOURCE_BUILTIN = "builtin_arc_agent"
MOBILE_TEST_RETRY_DELAYS = [0.0, 0.5, 0.5]


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


def mask_secret(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if len(text) <= 8:
        return "*" * len(text)
    return f"{text[:4]}...{text[-4:]}"


def append_environment_snapshot(section: str, env: dict[str, str], keys: list[str]) -> None:
    lines: list[str] = []
    for key in keys:
        raw_value = str(env.get(key, "") or "")
        rendered = mask_secret(raw_value) if key.endswith("_KEY") else raw_value
        lines.append(f"{key}={rendered}")
    append_debug_block(section, "\n".join(lines))


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


def prepare_artifact_directories() -> None:
    for path in [
        ARTIFACTS_DIR,
        BUILD_DIR,
        BUILD_OUTPUTS_DIR,
        DEVICE_DIR,
        SCREENSHOTS_DIR,
        UI_DUMPS_DIR,
        EVALUATION_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def reset_traceability_storage() -> None:
    for path in (
        TRACEABILITY_DB_PATH,
        TRACEABILITY_DB_PATH.with_suffix(".db-wal"),
        TRACEABILITY_DB_PATH.with_suffix(".db-shm"),
        ARTIFACTS_DIR / "traceability.db-wal",
        ARTIFACTS_DIR / "traceability.db-shm",
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
        connection.commit()
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
        connection.commit()
    finally:
        connection.close()

    return len(requirements), len(scenarios)


def sync_requirement_statuses_from_visual_events() -> None:
    return


def apply_traceability_events() -> tuple[int, int, int]:
    if not RUNNER_EVENTS_PATH.exists():
        append_debug_log("No traceability events found, skipping interface/test import")
        return 0, 0, 0

    interface_upserts = 0
    interface_status_updates = 0
    test_upserts = 0
    connection = sqlite3.connect(TRACEABILITY_DB_PATH)
    try:
        cursor = connection.cursor()
        for raw_line in RUNNER_EVENTS_PATH.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                append_debug_log(f"Invalid traceability event ignored: {line}")
                continue

            event_type = str(payload.get("type", "")).strip()
            if event_type == "interface_upsert":
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO interfaces (
                        interface_id, req_ids, type, content, file_path, first_line, implemented, callers, callees
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(payload.get("interface_id", "")).strip(),
                        json.dumps(payload.get("req_ids", []), ensure_ascii=False),
                        str(payload.get("interface_type", "")).strip(),
                        str(payload.get("content", "")).strip(),
                        payload.get("file_path"),
                        payload.get("first_line"),
                        1 if payload.get("implemented") else 0,
                        json.dumps(payload.get("callers", []), ensure_ascii=False),
                        json.dumps(payload.get("callees", []), ensure_ascii=False),
                    ),
                )
                interface_upserts += 1
            elif event_type == "interface_status":
                cursor.execute(
                    "UPDATE interfaces SET implemented = ? WHERE interface_id = ?",
                    (
                        1 if payload.get("implemented") else 0,
                        str(payload.get("interface_id", "")).strip(),
                    ),
                )
                interface_status_updates += cursor.rowcount
            elif event_type == "test_upsert":
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO tests (
                        test_id, req_id, interface_ids, type, file_path, passed, first_line
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(payload.get("test_id", "")).strip(),
                        str(payload.get("req_id", "")).strip(),
                        json.dumps(payload.get("interface_ids", []), ensure_ascii=False),
                        str(payload.get("test_type", "")).strip(),
                        payload.get("file_path"),
                        None,
                        payload.get("first_line"),
                    ),
                )
                test_upserts += 1
        connection.commit()
    finally:
        connection.close()

    sync_requirement_statuses_from_visual_events()
    return interface_upserts, interface_status_updates, test_upserts


def run_command(
    command: list[str],
    cwd: Path,
    stdout_file,
    stderr_file,
    check: bool = True,
    label: str = "command",
    env: dict | None = None,
    timeout: int | None = None,
) -> subprocess.CompletedProcess:
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
        timeout=timeout,
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


def read_task_info() -> dict:
    if not TASK_INFO_PATH.exists():
        raise RuntimeError("task_info.json is missing from the workspace task directory")
    try:
        payload = json.loads(TASK_INFO_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError("task_info.json must be valid JSON") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("task_info.json must contain a JSON object")
    package_name = str(payload.get("package_name", "")).strip()
    if not package_name:
        raise RuntimeError("task_info.json is missing package_name")
    permissions = payload.get("permissions", [])
    if not isinstance(permissions, list):
        raise RuntimeError("task_info.json permissions must be an array")
    functional_test_num = payload.get("functional_test_num")
    widget_test_num = payload.get("widget_test_num")
    if not isinstance(functional_test_num, int) or functional_test_num < 0:
        raise RuntimeError("task_info.json functional_test_num must be a non-negative integer")
    if not isinstance(widget_test_num, int) or widget_test_num < 0:
        raise RuntimeError("task_info.json widget_test_num must be a non-negative integer")
    return {
        "package_name": package_name,
        "permissions": [str(item) for item in permissions],
        "functional_test_num": functional_test_num,
        "widget_test_num": widget_test_num,
    }


def resolve_agent_source(spec: dict) -> str:
    value = str(spec.get("agent_source", AGENT_SOURCE_UPLOAD)).strip()
    if value in {AGENT_SOURCE_UPLOAD, AGENT_SOURCE_BUILTIN}:
        return value
    return AGENT_SOURCE_UPLOAD


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
        ["python3", "-m", "pip", "install", "--break-system-packages", "--no-cache-dir", "-r", "requirements.txt"],
        cwd=SUBMISSION_DIR,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=True,
        label="agent-pip-install",
    )
    append_runner_event("start_agent", "Agent dependencies installed", status="success")


def build_agent_environment(*, builtin_env: dict[str, str] | None = None) -> dict[str, str]:
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
        "ARCBENCH_TRACEABILITY_EVENTS_PATH": str(RUNNER_EVENTS_PATH),
        "ARCBENCH_SDK_DIR": str(SDK_DIR),
        "ARCBENCH_CHECKPOINT_PATH": str(CHECKPOINT_PATH),
        "ARCBENCH_PAUSE_REQUEST_PATH": str(PAUSE_REQUEST_PATH),
        "ARCBENCH_RESUME_REQUEST_PATH": str(RESUME_REQUEST_PATH),
        "PYTHONPATH": f"{SDK_DIR}:{os.environ.get('PYTHONPATH', '')}" if os.environ.get("PYTHONPATH") else str(SDK_DIR),
    }
    if builtin_env:
        env.update({key: str(value) for key, value in builtin_env.items() if value is not None})
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


def require_built_in_agent_config(spec: dict) -> tuple[list[str], dict[str, str]]:
    builtin_agent = spec.get("builtin_agent")
    if not isinstance(builtin_agent, dict):
        raise RuntimeError("runner-spec.json is missing builtin_agent configuration")

    command = builtin_agent.get("command")
    if not isinstance(command, list) or not command:
        raise RuntimeError("runner-spec.json is missing built-in arc-agent command")

    project_dir = str(spec.get("project_dir", "")).strip()
    requirement_dir = str(spec.get("requirement_dir", "")).strip()
    output_dir = str(spec.get("output_dir", "")).strip()
    if not project_dir:
        raise RuntimeError("runner-spec.json is missing project_dir for built-in arc-agent")
    if not requirement_dir:
        raise RuntimeError("runner-spec.json is missing requirement_dir for built-in arc-agent")
    if not output_dir:
        raise RuntimeError("runner-spec.json is missing output_dir for built-in arc-agent")
    if not Path(project_dir).exists():
        raise RuntimeError(f"Built-in arc-agent project directory is missing: {project_dir}")
    if not Path(requirement_dir).exists():
        raise RuntimeError(f"Built-in arc-agent requirement directory is missing: {requirement_dir}")
    if not Path(requirement_dir, "requirements.yaml").exists():
        raise RuntimeError(
            f"Built-in arc-agent requirement directory does not contain requirements.yaml: {requirement_dir}"
        )
    if Path(output_dir) != Path(project_dir):
        raise RuntimeError(
            "runner-spec.json output_dir must match project_dir for built-in arc-agent "
            "so downstream runtime paths stay consistent"
        )

    raw_submission_env = builtin_agent.get("env")
    if raw_submission_env is not None and not isinstance(raw_submission_env, dict):
        raise RuntimeError("runner-spec.json builtin_agent.env must be an object")

    builtin_openai_api_key = os.environ.get("OPENAI_API_KEY", "").strip() or os.environ.get("ARCBENCH_BUILTIN_OPENAI_API_KEY", "").strip()
    builtin_openai_base_url = (
        os.environ.get("OPENAI_BASE_URL", "").strip()
        or os.environ.get("OPENAI_API_BASE_URL", "").strip()
        or os.environ.get("ARCBENCH_BUILTIN_OPENAI_BASE_URL", "").strip()
        or os.environ.get("ARCBENCH_BUILTIN_OPENAI_API_BASE_URL", "").strip()
    )
    builtin_debug_mode = os.environ.get("ARC_DEBUG", "").strip() or os.environ.get("ARCBENCH_BUILTIN_DEBUG_MODE", "").strip() or "0"
    if not builtin_openai_api_key:
        raise RuntimeError("Built-in arc-agent is not configured: missing OPENAI_API_KEY")

    builtin_env = {str(key): str(value) for key, value in (raw_submission_env or {}).items() if value is not None}
    model_name = builtin_env.get("MODEL", "").strip() or os.environ.get("MODEL", "").strip()
    if not model_name:
        raise RuntimeError("Built-in arc-agent is not configured: missing MODEL")
    visual_api_key = os.environ.get("VISUAL_API_KEY", "").strip() or builtin_openai_api_key
    visual_base_url = os.environ.get("VISUAL_BASE_URL", "").strip() or builtin_openai_base_url
    visual_model = os.environ.get("VISUAL_MODEL", "").strip() or model_name
    builtin_env.update(
        {
            "MODEL": model_name,
            "OPENAI_API_KEY": builtin_openai_api_key,
            "OPENAI_BASE_URL": builtin_openai_base_url,
            "OPENAI_API_BASE_URL": builtin_openai_base_url,
            "VISUAL_API_KEY": visual_api_key,
            "VISUAL_BASE_URL": visual_base_url,
            "VISUAL_MODEL": visual_model,
            "ARC_DEBUG": builtin_debug_mode,
        }
    )
    return [str(part) for part in command], builtin_env


def run_builtin_arc_agent(stdout_file, stderr_file, spec: dict) -> subprocess.CompletedProcess:
    command, builtin_env = require_built_in_agent_config(spec)
    final_env = build_agent_environment(builtin_env=builtin_env)
    append_environment_snapshot(
        "builtin-arc-agent.env",
        final_env,
        [
            "MODEL",
            "OPENAI_BASE_URL",
            "OPENAI_API_BASE_URL",
            "OPENAI_API_KEY",
            "VISUAL_BASE_URL",
            "VISUAL_MODEL",
            "VISUAL_API_KEY",
            "ARC_DEBUG",
            "ARCBENCH_PROMPT_PATH",
            "ARCBENCH_TEMPLATE_DIR",
            "ARCBENCH_TASK_DIR",
            "ARCBENCH_OUTPUT_DIR",
            "ARCBENCH_ARTIFACTS_DIR",
            "ARCBENCH_RUNNER_EVENTS_PATH",
            "ARCBENCH_TRACEABILITY_DB_PATH",
            "PYTHONPATH",
        ],
    )
    append_runner_event("start_agent", "Launching built-in arc-agent")
    return run_command(
        command,
        cwd=WORKSPACE_ROOT,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=False,
        label="builtin-arc-agent",
        env=final_env,
    )


def run_generation_agent_once(stdout_file, stderr_file, spec: dict) -> subprocess.CompletedProcess:
    if resolve_agent_source(spec) == AGENT_SOURCE_BUILTIN:
        return run_builtin_arc_agent(stdout_file, stderr_file, spec)
    return run_generation_agent(stdout_file, stderr_file)


def run_generation_agent_with_resume(stdout_file, stderr_file, spec: dict) -> None:
    checkpoint = read_checkpoint()
    last_completed_index = int(checkpoint.get("last_completed_index", 0) or 0)
    if last_completed_index > 0:
        append_runner_event("start_agent", f"Resuming from checkpoint at commit {last_completed_index}", status="info")

    while True:
        completed = run_generation_agent_once(stdout_file, stderr_file, spec)
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


def resolve_android_spec(spec: dict) -> dict:
    android = spec.get("android")
    if not isinstance(android, dict):
        raise RuntimeError("runner-spec.json is missing android configuration")
    return android


def validate_android_project() -> None:
    required_paths = [
        TEMPLATE_DIR / "settings.gradle",
        TEMPLATE_DIR / "build.gradle",
        TEMPLATE_DIR / "app" / "build.gradle",
        TEMPLATE_DIR / "app" / "src" / "main" / "AndroidManifest.xml",
    ]
    missing = [str(path.relative_to(TEMPLATE_DIR)) for path in required_paths if not path.exists()]
    if missing:
        raise RuntimeError(f"Android project is incomplete: missing {', '.join(missing)}")


def resolve_package_name_from_output_metadata(metadata_path: Path, default_package_name: str) -> str:
    if not metadata_path.exists():
        return default_package_name
    data = json.loads(metadata_path.read_text(encoding="utf-8"))
    application_id = str(data.get("applicationId", "")).strip()
    if application_id:
        return application_id
    elements = data.get("elements")
    if isinstance(elements, list):
        for item in elements:
            if not isinstance(item, dict):
                continue
            application_id = str(item.get("applicationId", "")).strip()
            if application_id:
                return application_id
    return default_package_name


def build_android_app(stdout_file, stderr_file, spec: dict) -> dict:
    step_key = "build_app"
    android = resolve_android_spec(spec)
    append_runner_event(step_key, "Validating generated Android project")
    validate_android_project()

    gradlew = TEMPLATE_DIR / "gradlew"
    if gradlew.exists():
        gradlew.chmod(0o755)
    command = ["./gradlew", "--no-daemon", "assembleDebug"] if gradlew.exists() else ["gradle", "assembleDebug"]
    env = {
        **os.environ,
        "ANDROID_HOME": str(android["sdk_root"]),
        "ANDROID_SDK_ROOT": str(android["sdk_root"]),
    }

    append_runner_event(step_key, "Building Android debug APK with Gradle")
    run_command(
        command,
        cwd=TEMPLATE_DIR,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
        check=True,
        label="android-gradle-build",
        env=env,
        timeout=1200,
    )

    apk_candidates = sorted((TEMPLATE_DIR / "app" / "build" / "outputs" / "apk" / "debug").glob("*.apk"))
    if not apk_candidates:
        raise RuntimeError("Gradle build finished but no debug APK was produced")

    apk_source_path = apk_candidates[0]
    apk_output_path = BUILD_OUTPUTS_DIR / apk_source_path.name
    shutil.copy2(apk_source_path, apk_output_path)

    output_metadata_path = TEMPLATE_DIR / "app" / "build" / "outputs" / "apk" / "debug" / "output-metadata.json"
    if output_metadata_path.exists():
        shutil.copy2(output_metadata_path, BUILD_OUTPUTS_DIR / "output-metadata.json")

    package_name = resolve_package_name_from_output_metadata(
        output_metadata_path,
        str(android["package_name_hint"]).strip(),
    )
    metadata = {
        "success": True,
        "apk_path": str(apk_output_path),
        "package_name": package_name,
        "project_dir": str(TEMPLATE_DIR),
    }
    BUILD_METADATA_PATH.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    append_runner_event(step_key, f"Android debug APK built successfully: {apk_output_path}", status="success")
    return metadata


def run_adb(command: list[str], *, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    append_debug_log(f"Executing adb command: adb {' '.join(command)}")
    completed = subprocess.run(
        ["adb", *command],
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )
    if completed.stdout:
        append_debug_block("adb.stdout", completed.stdout)
    if completed.stderr:
        append_debug_block("adb.stderr", completed.stderr)
    return completed


def detect_device_id() -> str | None:
    completed = run_adb(["devices"], timeout=30)
    if completed.returncode != 0:
        return None
    lines = completed.stdout.splitlines()[1:]
    for line in lines:
        parts = line.split()
        if len(parts) >= 2 and parts[1] == "device":
            return parts[0]
    return None


def wait_for_android_device() -> str:
    step_key = "boot_device"
    append_runner_event(step_key, "Waiting for Android device to become available")
    deadline = time.time() + 300
    device_id: str | None = None
    while time.time() < deadline:
        device_id = detect_device_id()
        if device_id:
            break
        time.sleep(3)
    if not device_id:
        raise RuntimeError("Android emulator/device did not become available within 300 seconds")

    append_runner_event(step_key, f"Android device connected: {device_id}")
    boot_deadline = time.time() + 300
    while time.time() < boot_deadline:
        boot_completed = run_adb(["-s", device_id, "shell", "getprop", "sys.boot_completed"], timeout=20)
        package_manager = run_adb(["-s", device_id, "shell", "pm", "path", "android"], timeout=20)
        if boot_completed.stdout.strip() == "1" and "package:" in package_manager.stdout:
            append_runner_event(step_key, f"Android device finished booting: {device_id}", status="success")
            return device_id
        time.sleep(3)
    raise RuntimeError(f"Android device did not report boot completion within 300 seconds: {device_id}")


def collect_logcat(device_id: str | None) -> None:
    if not device_id:
        return
    completed = run_adb(["-s", device_id, "logcat", "-d"], timeout=60)
    LOGCAT_PATH.write_text(
        completed.stdout + ("\n[stderr]\n" + completed.stderr if completed.stderr else ""),
        encoding="utf-8",
    )


def better_compare(left: str, right: str) -> bool:
    left_text = str(left)
    right_text = str(right)
    if left_text.strip() == right_text.strip():
        return True
    pattern = re.compile(r"[^a-zA-Z0-9]")
    normalized_left = pattern.sub("", left_text).lower()
    normalized_right = pattern.sub("", right_text).lower()
    if normalized_left and normalized_right and normalized_left == normalized_right:
        return True
    try:
        return math.fabs(float(left_text) - float(right_text)) < 0.00001
    except ValueError:
        return False


def target_key_aliases() -> dict[str, str]:
    return {
        "resourceId": "resource-id",
        "resource_id": "resource-id",
        "className": "class",
        "class_name": "class",
        "contentDescription": "content-desc",
        "content_description": "content-desc",
        "description": "content-desc",
    }


def normalize_target(target: dict) -> dict[str, str]:
    normalized: dict[str, str] = {}
    aliases = target_key_aliases()
    for raw_key, raw_value in target.items():
        key = aliases.get(str(raw_key), str(raw_key))
        normalized[key] = str(raw_value)
    return normalized


def find_element(root: ET.Element, target: dict) -> ET.Element | None:
    normalized_target = normalize_target(target)
    for node in root.iter("node"):
        matched = True
        for attribute, expected_value in normalized_target.items():
            if attribute == "index":
                if str(node.attrib.get("index", "")).strip() != str(expected_value).strip():
                    matched = False
                    break
                continue
            actual_value = str(node.attrib.get(attribute, ""))
            if attribute == "resource-id":
                expected_suffix = expected_value.split(":")[-1].lower()
                if expected_suffix not in actual_value.lower():
                    matched = False
                    break
                continue
            if not actual_value or not better_compare(actual_value, expected_value):
                matched = False
                break
        if matched:
            return node
    return None


def node_center(node: ET.Element) -> tuple[int, int]:
    bounds = str(node.attrib.get("bounds", ""))
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
    if match is None:
        raise RuntimeError(f"Invalid node bounds: {bounds}")
    x1, y1, x2, y2 = [int(part) for part in match.groups()]
    return (x1 + x2) // 2, (y1 + y2) // 2


class AndroidController:
    def __init__(self, device_id: str, package_name: str) -> None:
        self.device_id = device_id
        self.package_name = package_name
        self.device = u2.connect_usb(device_id)
        self.fast_ime = "com.github.uiautomator/.FastInputIME"

    def uninstall_app(self) -> None:
        self.device.app_uninstall(self.package_name)

    def install_app(self, apk_path: Path) -> None:
        self.device.app_install(apk_path)

    def grant_permissions(self, permissions: list[str]) -> None:
        for permission in permissions:
            self.device.shell(f"pm grant {self.package_name} {permission}")

    def start_app(self) -> None:
        self.device.app_start(self.package_name, use_monkey=True)
        time.sleep(0.5)

    def stop_app(self) -> None:
        self.device.app_stop(self.package_name)

    def app_current(self) -> dict:
        return dict(self.device.app_current())

    def click(self, x: int, y: int) -> None:
        self.device.shell(f"input tap {x} {y}")

    def double_click(self, x: int, y: int) -> None:
        self.device.double_click(x, y)

    def long_click(self, x: int, y: int, seconds: float = 2.0) -> None:
        self.device.shell(f"input swipe {x} {y} {x} {y} {int(seconds * 1000)}")

    def input_text(self, text: str, clear: bool = True) -> None:
        self.device.shell(f"ime set {self.fast_ime}")
        self.device.send_keys(text, clear=clear)

    def back(self) -> None:
        self.device.shell("input keyevent KEYCODE_BACK")

    def home(self) -> None:
        self.device.press("home")

    def enter(self) -> None:
        self.device.press("enter")

    def swipe(self, fx: int, fy: int, tx: int, ty: int, duration_ms: int = 100) -> None:
        self.device.shell(f"input swipe {fx} {fy} {tx} {ty} {duration_ms}")

    def shell(self, command: str):
        return self.device.shell(command)

    def dump_hierarchy(self) -> str:
        return self.device.dump_hierarchy()

    def screenshot(self, output_path: Path) -> None:
        self.device.screenshot(str(output_path))

    def push(self, source: str, destination: str) -> None:
        self.device.push(source, destination)

    def pull(self, source: str, destination: str) -> None:
        self.device.pull(source, destination)


def save_failure_artifacts(controller: AndroidController, test_id: str, raw_xml: str) -> dict[str, str]:
    screenshot_path = SCREENSHOTS_DIR / f"{test_id}.png"
    ui_dump_path = UI_DUMPS_DIR / f"{test_id}.xml"
    controller.screenshot(screenshot_path)
    ui_dump_path.write_text(raw_xml, encoding="utf-8")
    return {
        "screenshot": str(screenshot_path),
        "ui_dump": str(ui_dump_path),
    }


def _test_sort_key(path: Path) -> tuple[int, str]:
    match = re.fullmatch(r"test(\d+)", path.stem)
    if match:
        return (int(match.group(1)), path.name)
    return (10**9, path.name)


def _sorted_json_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted((path for path in root.glob("*.json") if path.is_file()), key=_test_sort_key)


def discover_test_paths(task_info: dict) -> tuple[list[Path], list[Path]]:
    widget_dir = TESTS_DIR / "widget_tests"
    functional_dir = TESTS_DIR / "functional_tests"
    if not functional_dir.is_dir():
        raise RuntimeError("Mobile tests must use AppForge layout: missing tests/functional_tests")
    functional_paths = _sorted_json_files(functional_dir)
    widget_paths = _sorted_json_files(widget_dir) if widget_dir.is_dir() else []
    if len(functional_paths) != int(task_info["functional_test_num"]):
        raise RuntimeError(
            "functional_tests count does not match task_info.json: "
            f"expected {task_info['functional_test_num']}, found {len(functional_paths)}"
        )
    if len(widget_paths) != int(task_info["widget_test_num"]):
        raise RuntimeError(
            "widget_tests count does not match task_info.json: "
            f"expected {task_info['widget_test_num']}, found {len(widget_paths)}"
        )
    return widget_paths, functional_paths


def load_widget_test(test_path: Path) -> dict:
    payload = json.loads(test_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError(f"Mobile widget test must be a JSON object: {test_path.name}")
    pre_condition = payload.get("pre_condition", [])
    action = payload.get("action", {})
    post_condition = payload.get("post_condition", [])
    if not isinstance(pre_condition, list):
        raise RuntimeError(f"Widget test pre_condition must be an array: {test_path.name}")
    if not isinstance(action, dict):
        raise RuntimeError(f"Widget test action must be an object: {test_path.name}")
    if not isinstance(post_condition, list):
        raise RuntimeError(f"Widget test post_condition must be an array: {test_path.name}")
    return {
        "pre_condition": pre_condition,
        "action": action,
        "post_condition": post_condition,
    }


def load_functional_test(test_path: Path) -> list[dict]:
    payload = json.loads(test_path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError(f"Mobile test file must be a JSON array: {test_path.name}")
    normalized_steps: list[dict] = []
    for index, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            raise RuntimeError(f"Invalid step #{index} in {test_path.name}: each step must be an object")
        normalized_steps.append(item)
    return normalized_steps


def parse_point(value) -> tuple[int, int] | None:
    if isinstance(value, (list, tuple)) and len(value) == 2:
        return int(value[0]), int(value[1])
    if isinstance(value, dict) and "x" in value and "y" in value:
        return int(value["x"]), int(value["y"])
    return None


def swipe_points_for_direction(node: ET.Element, direction: str) -> tuple[tuple[int, int], tuple[int, int]]:
    bounds = str(node.attrib.get("bounds", ""))
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
    if match is None:
        raise RuntimeError(f"Invalid node bounds for swipe target: {bounds}")
    x1, y1, x2, y2 = [int(part) for part in match.groups()]
    mid_x = (x1 + x2) // 2
    mid_y = (y1 + y2) // 2
    padding_x = max(10, (x2 - x1) // 4)
    padding_y = max(10, (y2 - y1) // 4)
    normalized_direction = direction.lower().strip() or "up"
    if normalized_direction == "up":
        return (mid_x, y2 - padding_y), (mid_x, y1 + padding_y)
    if normalized_direction == "down":
        return (mid_x, y1 + padding_y), (mid_x, y2 - padding_y)
    if normalized_direction == "left":
        return (x2 - padding_x, mid_y), (x1 + padding_x, mid_y)
    if normalized_direction == "right":
        return (x1 + padding_x, mid_y), (x2 - padding_x, mid_y)
    raise RuntimeError(f"Unsupported swipe direction: {direction}")


class MobileEvaluator:
    def __init__(self, device_id: str, apk_path: Path, package_name: str, permissions: list[str], task_info: dict) -> None:
        self.device_id = device_id
        self.apk_path = apk_path
        self.package_name = package_name
        self.permissions = permissions
        self.task_info = task_info
        self.controller = AndroidController(device_id, package_name)

    def init_env(self) -> None:
        if not self.apk_path.exists():
            raise FileNotFoundError(f"APK file does not exist: {self.apk_path}")
        for _ in range(5):
            self.controller.uninstall_app()
            self.controller.install_app(self.apk_path)
            self.controller.grant_permissions(self.permissions)
            self.controller.start_app()
            current_app = self.controller.app_current()
            time.sleep(0.5)
            if str(current_app.get("package", "")).strip() == self.package_name:
                return
        raise RuntimeError(f"Failed to initialize app environment for package {self.package_name}")

    def reset_env(self) -> None:
        self.controller.uninstall_app()

    def dump_hierarchy(self) -> tuple[str, ET.Element]:
        raw_xml = self.controller.dump_hierarchy()
        return raw_xml, ET.fromstring(raw_xml)

    def perform_action(self, step: dict) -> tuple[bool, str]:
        step_type = str(step.get("type", "")).strip().lower()
        if step_type == "none":
            return True, ""
        if step_type == "wait":
            time.sleep(1.0)
            return True, ""
        if step_type == "restart":
            self.controller.stop_app()
            self.controller.start_app()
            return True, ""
        if step_type == "back":
            self.controller.back()
            return True, ""
        if step_type == "home":
            self.controller.home()
            return True, ""
        if step_type == "enter":
            self.controller.enter()
            return True, ""
        if step_type == "stop":
            self.controller.stop_app()
            return True, ""
        if step_type == "adb_command":
            command_text = str(step.get("cmdline", "")).strip()
            if not command_text:
                return False, "adb_command step is missing cmdline"
            parts = command_text.split()
            if parts[0] == "push" and len(parts) == 3:
                self.controller.push(parts[1], parts[2])
                return True, ""
            if parts[0] == "pull" and len(parts) == 3:
                self.controller.pull(parts[1], parts[2])
                return True, ""
            response = self.controller.shell(command_text)
            exit_code = int(getattr(response, "exit_code", 0))
            if exit_code != 0:
                output = str(getattr(response, "output", "")).strip()
                return False, output or f"adb_command failed with exit_code={exit_code}"
            return True, ""
        if step_type == "swipe":
            coords = step.get("coords")
            coord_from = parse_point(step.get("coord_from"))
            coord_to = parse_point(step.get("coord_to"))
            if isinstance(coords, list) and len(coords) == 2:
                coord_from = parse_point(coords[0])
                coord_to = parse_point(coords[1])
            if coord_from is not None and coord_to is not None:
                self.controller.swipe(coord_from[0], coord_from[1], coord_to[0], coord_to[1])
                return True, ""

        target = step.get("target", step.get("element"))
        if not isinstance(target, dict):
            return False, f"Step target must be an object for action type {step_type}"
        raw_xml, root = self.dump_hierarchy()
        node = find_element(root, target)
        if node is None:
            return False, f"Target not found: {target}"
        x, y = node_center(node)
        if step_type == "click":
            self.controller.click(x, y)
            return True, ""
        if step_type == "doubleclick":
            self.controller.double_click(x, y)
            return True, ""
        if step_type == "longclick":
            self.controller.long_click(x, y)
            return True, ""
        if step_type in {"input", "text"}:
            message = str(step.get("message", "") or step.get("text", "")).strip()
            if not message:
                return False, "input step is missing message"
            self.controller.click(x, y)
            self.controller.input_text(message, clear=True)
            return True, ""
        if step_type == "swipe":
            direction = str(step.get("direction", "up")).strip() or "up"
            start, end = swipe_points_for_direction(node, direction)
            self.controller.swipe(start[0], start[1], end[0], end[1])
            return True, ""
        return False, f"Unsupported action type: {step_type}; last hierarchy snapshot length={len(raw_xml)}"

    def check_condition(self, step: dict) -> tuple[bool, str]:
        step_type = str(step.get("type", "")).strip().lower()
        target = step.get("target", step.get("element"))
        if not isinstance(target, dict):
            return False, f"Step target must be an object for assertion type {step_type}"
        _, root = self.dump_hierarchy()
        node = find_element(root, target)
        if step_type == "visible":
            return (node is not None, f"Expected visible target: {target}")
        if step_type == "invisible":
            return (node is None, f"Expected invisible target: {target}")
        return False, f"Unsupported assertion type: {step_type}"

    def execute_step(self, test_id: str, step: dict) -> tuple[bool, str | None, dict[str, str]]:
        step_package = str(step.get("package", "")).strip()
        if step_package and step_package != self.package_name:
            raw_xml, _ = self.dump_hierarchy()
            artifacts = save_failure_artifacts(self.controller, test_id, raw_xml)
            return False, f"Unexpected step package: {step_package}", artifacts

        step_type = str(step.get("type", "")).strip()
        last_error = "Unknown step failure"
        for delay in MOBILE_TEST_RETRY_DELAYS:
            if delay > 0:
                time.sleep(delay)
            if step_type in {"click", "doubleclick", "longclick", "input", "adb_command", "restart", "wait", "back", "home", "enter", "stop", "swipe"}:
                success, details = self.perform_action(step)
            elif step_type in {"visible", "invisible"}:
                success, details = self.check_condition(step)
            else:
                success, details = False, f"Unsupported step type: {step_type}"
            if success:
                return True, None, {}
            last_error = details

        raw_xml, _ = self.dump_hierarchy()
        artifacts = save_failure_artifacts(self.controller, test_id, raw_xml)
        return False, last_error, artifacts

    def _run_steps(self, test_id: str, steps: list[dict]) -> dict:
        started_at = time.time()
        try:
            self.init_env()
            for step in steps:
                time.sleep(0.5)
                success, error, artifacts = self.execute_step(test_id, step)
                if not success:
                    return {
                        "name": test_id,
                        "status": "failed",
                        "duration_ms": int((time.time() - started_at) * 1000),
                        "error": error,
                        "artifacts": artifacts,
                    }
            return {
                "name": test_id,
                "status": "passed",
                "duration_ms": int((time.time() - started_at) * 1000),
                "error": None,
                "artifacts": {},
            }
        finally:
            try:
                self.reset_env()
            except Exception as exc:  # noqa: BLE001
                append_debug_log(f"Failed to reset app environment after {test_id}: {exc}")

    def run_single_widget_test(self, test_path: Path) -> dict:
        test_id = test_path.stem
        payload = load_widget_test(test_path)
        append_runner_event("run_tests", f"Running widget test {test_id}")
        steps: list[dict] = []
        steps.extend(payload["pre_condition"])
        steps.append(payload["action"])
        steps.extend(payload["post_condition"])
        result = self._run_steps(test_id, steps)
        result["suite"] = "widget"
        return result

    def run_single_functional_test(self, test_path: Path) -> dict:
        test_id = test_path.stem
        steps = load_functional_test(test_path)
        append_runner_event("run_tests", f"Running functional test {test_id}")
        result = self._run_steps(test_id, steps)
        result["suite"] = "functional"
        return result

    def run_suite(self, suite_name: str, test_paths: list[Path]) -> list[dict]:
        if not test_paths:
            append_runner_event("run_tests", f"No mobile {suite_name} tests found", status="success")
            return []
        results: list[dict] = []
        for test_path in test_paths:
            if suite_name == "widget":
                result = self.run_single_widget_test(test_path)
            else:
                result = self.run_single_functional_test(test_path)
            result["id"] = test_path.stem
            results.append(result)
            status = "success" if result["status"] == "passed" else "error"
            append_runner_event("run_tests", f"{suite_name.title()} test {test_path.stem} finished with status={result['status']}", status=status)
        return results

    def run_all_tests(self) -> dict[str, list[dict]]:
        widget_test_paths, functional_test_paths = discover_test_paths(self.task_info)
        return {
            "widget": self.run_suite("widget", widget_test_paths),
            "functional": self.run_suite("functional", functional_test_paths),
        }


def summarize_results(results: list[dict]) -> dict:
    passed = sum(1 for item in results if item.get("status") == "passed")
    failed = sum(1 for item in results if item.get("status") != "passed")
    total_duration_ms = sum(int(item.get("duration_ms", 0) or 0) for item in results)
    score = round((passed / (passed + failed)) * 100, 1) if (passed + failed) else 0.0
    return {
        "passed": passed,
        "failed": failed,
        "score": score,
        "duration_seconds": round(total_duration_ms / 1000, 2),
        "tests": results,
    }


def write_result(payload: dict) -> None:
    RESULT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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


def main() -> int:
    prepare_artifact_directories()
    checkpoint = read_checkpoint()
    resume_from_checkpoint = int(checkpoint.get("last_completed_index", 0) or 0) > 0
    if not resume_from_checkpoint:
        RUNNER_EVENTS_PATH.write_text("", encoding="utf-8")
    spec = read_spec()
    agent_source = resolve_agent_source(spec)
    append_debug_log(f"Runner started with spec: {spec}")
    if agent_source == AGENT_SOURCE_UPLOAD:
        initialize_traceability_db()
        seeded_requirements, seeded_scenarios = seed_traceability_requirements()
        append_runner_event(
            "deploy_agent",
            f"Traceability initialized with {seeded_requirements} requirements and {seeded_scenarios} scenarios",
            status="success",
        )
    else:
        append_runner_event(
            "deploy_agent",
            "Built-in arc-agent will initialize and maintain traceability artifacts",
            status="success",
        )

    device_id: str | None = None
    with STDOUT_PATH.open("w", encoding="utf-8") as stdout_file, STDERR_PATH.open("w", encoding="utf-8") as stderr_file:
        try:
            if agent_source == AGENT_SOURCE_UPLOAD:
                install_agent_dependencies(stdout_file, stderr_file)
            else:
                append_runner_event("start_agent", "Built-in arc-agent selected; skipping submission dependency install", status="success")
            run_generation_agent_with_resume(stdout_file, stderr_file, spec)
            if agent_source == AGENT_SOURCE_UPLOAD:
                interface_upserts, interface_status_updates, test_upserts = apply_traceability_events()
                append_runner_event(
                    "start_agent",
                    (
                        "Traceability assets imported: "
                        f"interfaces={interface_upserts}, "
                        f"interface_status_updates={interface_status_updates}, "
                        f"tests={test_upserts}"
                    ),
                    status="success",
                )
            else:
                append_runner_event(
                    "start_agent",
                    "Built-in arc-agent finished updating traceability artifacts",
                    status="success",
                )

            task = spec.get("task", {})
            category = str(task.get("category", "")).strip()
            if category != "mobile":
                raise RuntimeError(f"Unsupported task category inside runner: {category}")

            build_metadata = build_android_app(stdout_file, stderr_file, spec)
            device_id = wait_for_android_device()
            android = resolve_android_spec(spec)
            task_info = read_task_info()
            evaluator = MobileEvaluator(
                device_id=device_id,
                apk_path=Path(build_metadata["apk_path"]),
                package_name=str(build_metadata["package_name"]),
                permissions=[str(item) for item in android.get("permissions", [])],
                task_info=task_info,
            )
            append_runner_event("run_tests", "Running AppForge-style mobile widget and functional tests")
            suite_results = evaluator.run_all_tests()
            widget_results = suite_results["widget"]
            functional_results = suite_results["functional"]
            test_results = [*widget_results, *functional_results]
            WIDGET_RESULTS_PATH.write_text(json.dumps(widget_results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            FUNCTIONAL_RESULTS_PATH.write_text(json.dumps(functional_results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            TEST_RESULTS_PATH.write_text(json.dumps(test_results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            collect_logcat(device_id)

            summary = summarize_results(test_results)
            result_payload = {
                **summary,
                "category": "mobile",
                "test_suites": {
                    "widget": {
                        "count": len(widget_results),
                    },
                    "functional": {
                        "count": len(functional_results),
                    },
                },
                "task_info": {
                    "package_name": task_info["package_name"],
                    "permissions": task_info["permissions"],
                    "functional_test_num": task_info["functional_test_num"],
                    "widget_test_num": task_info["widget_test_num"],
                },
                "build": build_metadata,
                "device": {
                    "device_id": device_id,
                },
            }
            write_result(result_payload)
            append_runner_event(
                "run_tests",
                f"Mobile test results parsed: passed={summary['passed']}, failed={summary['failed']}, score={summary['score']}",
                status="success",
            )
            return 0 if summary["failed"] == 0 else 1
        except Exception as exc:  # noqa: BLE001
            append_debug_log(f"Runner failed: {exc}")
            append_runner_event("run_tests", str(exc), status="error")
            collect_logcat(device_id)
            write_result(
                {
                    "passed": 0,
                    "failed": 0,
                    "score": 0,
                    "duration_seconds": 0,
                    "tests": [],
                    "category": "mobile",
                    "error": str(exc),
                }
            )
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
