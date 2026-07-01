import shutil
import json
import zipfile
from pathlib import Path

from app.core.config import get_settings
from app.core.enums import AgentSourceType
from app.models.requirement import Requirement
from app.models.submission import Submission
from app.models.user import User
from app.services.runtime_path_service import RuntimePathService
from app.services.traceability_seed_builder import TraceabilitySeedBuilder


class WorkspaceAssembler:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.runtime_paths = RuntimePathService()
        self.traceability_seed_builder = TraceabilitySeedBuilder()

    def assemble(self, submission: Submission, requirement: Requirement, user: User) -> Path:
        workspace_root = self.runtime_paths.get_workspace_root(submission, username=user.username)
        if workspace_root.exists():
            shutil.rmtree(workspace_root)
        submission_dir = workspace_root / "submission"
        sdk_dir = workspace_root / "sdk"
        template_dir = workspace_root / "template"
        task_dir = workspace_root / "task"
        tests_dir = workspace_root / "tests"
        artifacts_dir = workspace_root / "artifacts"
        prompt_dir = workspace_root / "prompt"

        submission_dir.mkdir(parents=True, exist_ok=True)
        sdk_dir.mkdir(parents=True, exist_ok=True)
        template_dir.mkdir(parents=True, exist_ok=True)
        task_dir.mkdir(parents=True, exist_ok=True)
        tests_dir.mkdir(parents=True, exist_ok=True)
        artifacts_dir.mkdir(parents=True, exist_ok=True)
        prompt_dir.mkdir(parents=True, exist_ok=True)

        agent_source = AgentSourceType(submission.agent_source)
        if agent_source == AgentSourceType.UPLOAD:
            with zipfile.ZipFile(submission.archive_path, "r") as archive:
                archive.extractall(submission_dir)
            self._flatten_single_root(submission_dir)
        template_source_root = Path(requirement.requirements_path).resolve().parents[2] / "template"
        shutil.copytree(template_source_root, template_dir, dirs_exist_ok=True)
        shutil.copytree(Path(requirement.assets_path), task_dir / "assets", dirs_exist_ok=True)
        shutil.copytree(Path(requirement.references_path), task_dir / "reference", dirs_exist_ok=True)
        requirement_markdown_path = Path(requirement.requirements_path)
        requirement_yaml_path = requirement_markdown_path.with_name("requirements.yaml")
        shutil.copy2(requirement_markdown_path, task_dir / "requirements.md")
        if requirement_yaml_path.exists():
            shutil.copy2(requirement_yaml_path, task_dir / "requirements.yaml")
        prerequisites_path = Path(requirement.prerequisites_path)
        if prerequisites_path.exists():
            shutil.copy2(prerequisites_path, task_dir / "prerequisites.md")
        else:
            (task_dir / "prerequisites.md").write_text("", encoding="utf-8")
        shutil.copytree(Path(requirement.tests_path), tests_dir, dirs_exist_ok=True)
        self._write_visual_sdk_files(sdk_dir)
        self.traceability_seed_builder.write_seed_file(
            artifacts_dir / "traceability-seed.json",
            requirement,
            requirement_yaml_path=task_dir / "requirements.yaml",
        )
        self._write_demo_test_status_seed(artifacts_dir / "demo-test-statuses.json")

        prompt_text = self._build_prompt(requirement)
        (prompt_dir / "task_prompt.txt").write_text(prompt_text, encoding="utf-8")
        (workspace_root / "runner-spec.json").write_text(
            json.dumps(
                {
                    "agent_source": submission.agent_source,
                    "submission_dir": "/workspace/submission",
                    "sdk_dir": "/workspace/sdk",
                    "template_dir": "/workspace/template",
                    "task_dir": "/workspace/task",
                    "tests_dir": "/workspace/tests",
                    "artifacts_dir": "/workspace/artifacts",
                    "project_dir": "/workspace/template",
                    "requirement_dir": "/workspace/task",
                    "output_dir": "/workspace/template",
                    "runner_events_path": "/workspace/artifacts/runner-events.jsonl",
                    "traceability_db_path": "/workspace/artifacts/traceability.db",
                    "traceability_events_path": "/workspace/artifacts/traceability-events.jsonl",
                    "prompt_path": "/workspace/prompt/task_prompt.txt",
                    "builtin_agent": {
                        "command": [
                            "arc-agent",
                            "/workspace/task",
                            "--output-dir",
                            "/workspace/template",
                            "--app-type",
                            "web",
                        ],
                        "env": {
                            "MODEL": submission.model_name or "",
                        },
                    },
                    "task": {
                        "category": requirement.category,
                        "requirement_id": requirement.id,
                        "test_runner": requirement.test_runner,
                    },
                },
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )

        debug_log_path = workspace_root / "execution.debug.log"
        debug_log_path.write_text(
            "Workspace assembled successfully.\n",
            encoding="utf-8",
        )
        return workspace_root

    @staticmethod
    def _build_prompt(requirement: Requirement) -> str:
        return "\n".join(
            [
                "You are given a starter application template and a task package.",
                "Modify the template implementation to satisfy all requirements.",
                "",
                "Materials:",
                "- Base template project: /workspace/template",
                "- Requirement tree YAML: /workspace/task/requirements.yaml (preferred when present)",
                "- Requirement document: /workspace/task/requirements.md",
                "- Prerequisites document: /workspace/task/prerequisites.md",
                "- Task assets: /workspace/task/assets",
                "- Reference images: /workspace/task/reference",
                "",
                "Instructions:",
                "1. Read prerequisites.md completely, then read requirements.yaml first if it exists, and use requirements.md as the narrative companion document.",
                "2. Use the files in assets/ and reference/ when implementing the product.",
                "3. Apply your changes directly inside /workspace/template.",
                "4. Keep the project runnable with the template's frontend and backend structure.",
                "5. Requirements and scenarios are pre-registered automatically from requirements.yaml before your agent starts.",
                "6. Use the built-in runtime SDK when you finish major requirement nodes or when you create interfaces/tests.",
                "7. In Python you can import directly with: from arcbench_visual import mark_design_done, mark_implementation_done, mark_test_passed, mark_test_failed, register_interface, register_test, set_interface_implemented",
                "8. JavaScript SDK path: /workspace/sdk/arcbench_visual.js",
                "9. TypeScript SDK path: /workspace/sdk/arcbench_visual.ts",
                "10. Reference requirement nodes by exact requirement tree node id, for example ROOT or REQ-1.",
                "11. Register interfaces and tests when you create them so traceability artifacts remain complete.",
                "12. When implementation is complete, exit the program successfully.",
                "",
                f"Requirement ID: {requirement.id}",
                f"Requirement title: {requirement.title}",
                f"Category: {requirement.category}",
            ]
        ) + "\n"

    @staticmethod
    def _write_visual_sdk_files(sdk_dir: Path) -> None:
        (sdk_dir / "arcbench_visual.py").write_text(
            "\n".join(
                [
                    "import json",
                    "import os",
                    "import sqlite3",
                    "import time",
                    "",
                    "_RUNNER_EVENTS_PATH = os.environ.get('ARCBENCH_RUNNER_EVENTS_PATH', '/workspace/artifacts/runner-events.jsonl')",
                    "_TRACEABILITY_EVENTS_PATH = os.environ.get('ARCBENCH_TRACEABILITY_EVENTS_PATH', '/workspace/artifacts/traceability-events.jsonl')",
                    "_TRACEABILITY_DB_PATH = os.environ.get('ARCBENCH_TRACEABILITY_DB_PATH', '/workspace/artifacts/traceability.db')",
                    "_DEMO_TEST_STATUS_PATH = os.environ.get('ARCBENCH_DEMO_TEST_STATUS_PATH', '/workspace/artifacts/demo-test-statuses.json')",
                    "",
                    "",
                    "def emit_requirement_state(node_id: str, phase: str, status: str, message: str | None = None) -> None:",
                    "    if not node_id or not str(node_id).strip():",
                    "        return",
                    "    payload = {",
                    "        'type': 'requirement_state',",
                    "        'node_id': str(node_id).strip(),",
                    "        'phase': phase,",
                    "        'status': status,",
                    "        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime()),",
                    "        'message': message,",
                    "    }",
                    "    os.makedirs(os.path.dirname(_RUNNER_EVENTS_PATH), exist_ok=True)",
                    "    with open(_RUNNER_EVENTS_PATH, 'a', encoding='utf-8') as output:",
                    "        output.write(json.dumps(payload, ensure_ascii=True) + '\\n')",
                    "",
                    "",
                    "def emit_traceability_event(payload: dict) -> None:",
                    "    os.makedirs(os.path.dirname(_TRACEABILITY_EVENTS_PATH), exist_ok=True)",
                    "    with open(_TRACEABILITY_EVENTS_PATH, 'a', encoding='utf-8') as output:",
                    "        output.write(json.dumps(payload, ensure_ascii=True) + '\\n')",
                    "",
                    "",
                    "def mark_design_done(node_id: str, message: str | None = None) -> None:",
                    "    emit_requirement_state(node_id, 'design', 'completed', message)",
                    "",
                    "",
                    "def mark_implementation_done(node_id: str, message: str | None = None) -> None:",
                    "    emit_requirement_state(node_id, 'implement', 'completed', message)",
                    "",
                    "",
                    "def mark_test_passed(node_id: str, message: str | None = None) -> None:",
                    "    emit_requirement_state(node_id, 'test', 'passed', message)",
                    "",
                    "",
                    "def mark_test_failed(node_id: str, message: str | None = None) -> None:",
                    "    emit_requirement_state(node_id, 'test', 'failed', message)",
                    "",
                    "",
                    "def _read_demo_test_status_payload() -> dict:",
                    "    if not os.path.exists(_DEMO_TEST_STATUS_PATH):",
                    "        return {'tests': {}, 'requirements': {}}",
                    "    try:",
                    "        with open(_DEMO_TEST_STATUS_PATH, 'r', encoding='utf-8') as source:",
                    "            payload = json.load(source)",
                    "    except (OSError, json.JSONDecodeError):",
                    "        return {'tests': {}, 'requirements': {}}",
                    "    if not isinstance(payload, dict):",
                    "        return {'tests': {}, 'requirements': {}}",
                    "    tests = payload.get('tests') if isinstance(payload.get('tests'), dict) else {}",
                    "    requirements = payload.get('requirements') if isinstance(payload.get('requirements'), dict) else {}",
                    "    return {'tests': tests, 'requirements': requirements}",
                    "",
                    "",
                    "def _write_demo_test_status_payload(payload: dict) -> None:",
                    "    os.makedirs(os.path.dirname(_DEMO_TEST_STATUS_PATH), exist_ok=True)",
                    "    tmp_path = _DEMO_TEST_STATUS_PATH + '.tmp'",
                    "    with open(tmp_path, 'w', encoding='utf-8') as output:",
                    "        json.dump(payload, output, ensure_ascii=False, indent=2)",
                    "        output.write('\\n')",
                    "    os.replace(tmp_path, _DEMO_TEST_STATUS_PATH)",
                    "",
                    "",
                    "def list_tests_for_requirement(req_id: str) -> list[str]:",
                    "    if not req_id or not str(req_id).strip():",
                    "        return []",
                    "    if not os.path.exists(_TRACEABILITY_DB_PATH):",
                    "        return []",
                    "    connection = sqlite3.connect(_TRACEABILITY_DB_PATH)",
                    "    try:",
                    "        cursor = connection.cursor()",
                    "        cursor.execute('SELECT test_id FROM tests WHERE req_id = ? ORDER BY test_id', (str(req_id).strip(),))",
                    "        return [str(row[0]).strip() for row in cursor.fetchall() if row and str(row[0]).strip()]",
                    "    finally:",
                    "        connection.close()",
                    "",
                    "",
                    "def set_demo_test_status(test_id: str, status: str) -> None:",
                    "    normalized_test_id = str(test_id or '').strip()",
                    "    normalized_status = str(status or '').strip().lower()",
                    "    if not normalized_test_id or normalized_status not in {'passed', 'failed'}:",
                    "        return",
                    "    payload = _read_demo_test_status_payload()",
                    "    payload.setdefault('tests', {})[normalized_test_id] = normalized_status",
                    "    _write_demo_test_status_payload(payload)",
                    "",
                    "",
                    "def set_demo_requirement_status(node_id: str, status: str) -> None:",
                    "    normalized_node_id = str(node_id or '').strip()",
                    "    normalized_status = str(status or '').strip().lower()",
                    "    if not normalized_node_id or normalized_status not in {'passed', 'failed'}:",
                    "        return",
                    "    payload = _read_demo_test_status_payload()",
                    "    payload.setdefault('requirements', {})[normalized_node_id] = normalized_status",
                    "    _write_demo_test_status_payload(payload)",
                    "",
                    "",
                    "def set_requirement_tests_status(node_id: str, status: str) -> list[str]:",
                    "    test_ids = list_tests_for_requirement(node_id)",
                    "    for test_id in test_ids:",
                    "        set_demo_test_status(test_id, status)",
                    "    set_demo_requirement_status(node_id, status)",
                    "    return test_ids",
                    "",
                    "",
                    "def register_interface(",
                    "    interface_id: str,",
                    "    req_ids: list[str],",
                    "    type: str,",
                    "    content: str,",
                    "    file_path: str | None = None,",
                    "    first_line: str | None = None,",
                    "    implemented: bool = False,",
                    "    callers: list[str] | None = None,",
                    "    callees: list[str] | None = None,",
                    ") -> None:",
                    "    if not interface_id or not str(interface_id).strip():",
                    "        return",
                    "    emit_traceability_event({",
                    "        'type': 'interface_upsert',",
                    "        'interface_id': str(interface_id).strip(),",
                    "        'req_ids': [str(item).strip() for item in (req_ids or []) if str(item).strip()],",
                    "        'interface_type': str(type or '').strip(),",
                    "        'content': str(content or '').strip(),",
                    "        'file_path': str(file_path or '').strip() or None,",
                    "        'first_line': str(first_line or '').strip() or None,",
                    "        'implemented': bool(implemented),",
                    "        'callers': [str(item).strip() for item in (callers or []) if str(item).strip()],",
                    "        'callees': [str(item).strip() for item in (callees or []) if str(item).strip()],",
                    "        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime()),",
                    "    })",
                    "",
                    "",
                    "def set_interface_implemented(interface_id: str, implemented: bool, message: str | None = None) -> None:",
                    "    if not interface_id or not str(interface_id).strip():",
                    "        return",
                    "    emit_traceability_event({",
                    "        'type': 'interface_status',",
                    "        'interface_id': str(interface_id).strip(),",
                    "        'implemented': bool(implemented),",
                    "        'message': message,",
                    "        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime()),",
                    "    })",
                    "",
                    "",
                    "def mark_interface_implemented(interface_id: str, message: str | None = None) -> None:",
                    "    set_interface_implemented(interface_id, True, message)",
                    "",
                    "",
                    "def mark_interface_unimplemented(interface_id: str, message: str | None = None) -> None:",
                    "    set_interface_implemented(interface_id, False, message)",
                    "",
                    "",
                    "def register_test(",
                    "    test_id: str,",
                    "    req_id: str,",
                    "    type: str,",
                    "    file_path: str | None = None,",
                    "    first_line: str | None = None,",
                    "    scenario_id: str | None = None,",
                    ") -> None:",
                    "    if not test_id or not str(test_id).strip() or not req_id or not str(req_id).strip():",
                    "        return",
                    "    emit_traceability_event({",
                    "        'type': 'test_upsert',",
                    "        'test_id': str(test_id).strip(),",
                    "        'req_id': str(req_id).strip(),",
                    "        'scenario_id': str(scenario_id).strip() if scenario_id else None,",
                    "        'test_type': str(type or '').strip(),",
                    "        'file_path': str(file_path or '').strip() or None,",
                    "        'first_line': str(first_line or '').strip() or None,",
                    "        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime()),",
                    "    })",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        visual_js = "\n".join(
            [
                "import fs from 'node:fs';",
                "import path from 'node:path';",
                "",
                "const runnerEventsPath = process.env.ARCBENCH_RUNNER_EVENTS_PATH || '/workspace/artifacts/runner-events.jsonl';",
                "const traceabilityEventsPath = process.env.ARCBENCH_TRACEABILITY_EVENTS_PATH || '/workspace/artifacts/traceability-events.jsonl';",
                "",
                "export function emitRequirementState(nodeId, phase, status, message) {",
                "  if (!nodeId || !String(nodeId).trim()) return;",
                "  const payload = {",
                "    type: 'requirement_state',",
                "    node_id: String(nodeId).trim(),",
                "    phase,",
                "    status,",
                "    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),",
                "    message: message ?? null,",
                "  };",
                "  fs.mkdirSync(path.dirname(runnerEventsPath), { recursive: true });",
                "  fs.appendFileSync(runnerEventsPath, `${JSON.stringify(payload)}\\n`, 'utf-8');",
                "}",
                "",
                "export function emitTraceabilityEvent(payload) {",
                "  fs.mkdirSync(path.dirname(traceabilityEventsPath), { recursive: true });",
                "  fs.appendFileSync(traceabilityEventsPath, `${JSON.stringify(payload)}\\n`, 'utf-8');",
                "}",
                "",
                "export function markDesignDone(nodeId, message) {",
                "  emitRequirementState(nodeId, 'design', 'completed', message);",
                "}",
                "",
                "export function markImplementationDone(nodeId, message) {",
                "  emitRequirementState(nodeId, 'implement', 'completed', message);",
                "}",
                "",
                "export function markTestPassed(nodeId, message) {",
                "  emitRequirementState(nodeId, 'test', 'passed', message);",
                "}",
                "",
                "export function markTestFailed(nodeId, message) {",
                "  emitRequirementState(nodeId, 'test', 'failed', message);",
                "}",
                "",
                "export function registerInterface(",
                "  interfaceId,",
                "  reqIds,",
                "  type,",
                "  content,",
                "  filePath,",
                "  firstLine,",
                "  implemented = false,",
                "  callers = [],",
                "  callees = [],",
                ") {",
                "  if (!interfaceId || !String(interfaceId).trim()) return;",
                "  emitTraceabilityEvent({",
                "    type: 'interface_upsert',",
                "    interface_id: String(interfaceId).trim(),",
                "    req_ids: Array.isArray(reqIds) ? reqIds.map((item) => String(item).trim()).filter(Boolean) : [],",
                "    interface_type: String(type ?? '').trim(),",
                "    content: String(content ?? '').trim(),",
                "    file_path: filePath ? String(filePath).trim() : null,",
                "    first_line: firstLine ? String(firstLine).trim() : null,",
                "    implemented: Boolean(implemented),",
                "    callers: Array.isArray(callers) ? callers.map((item) => String(item).trim()).filter(Boolean) : [],",
                "    callees: Array.isArray(callees) ? callees.map((item) => String(item).trim()).filter(Boolean) : [],",
                "    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),",
                "  });",
                "}",
                "",
                "export function setInterfaceImplemented(interfaceId, implemented, message) {",
                "  if (!interfaceId || !String(interfaceId).trim()) return;",
                "  emitTraceabilityEvent({",
                "    type: 'interface_status',",
                "    interface_id: String(interfaceId).trim(),",
                "    implemented: Boolean(implemented),",
                "    message: message ?? null,",
                "    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),",
                "  });",
                "}",
                "",
                "export function markInterfaceImplemented(interfaceId, message) {",
                "  setInterfaceImplemented(interfaceId, true, message);",
                "}",
                "",
                "export function markInterfaceUnimplemented(interfaceId, message) {",
                "  setInterfaceImplemented(interfaceId, false, message);",
                "}",
                "",
                "export function registerTest(testId, reqId, type, filePath, firstLine, scenarioId = null) {",
                "  if (!testId || !String(testId).trim() || !reqId || !String(reqId).trim()) return;",
                "  emitTraceabilityEvent({",
                "    type: 'test_upsert',",
                "    test_id: String(testId).trim(),",
                "    req_id: String(reqId).trim(),",
                "    scenario_id: scenarioId ? String(scenarioId).trim() : null,",
                "    test_type: String(type ?? '').trim(),",
                "    file_path: filePath ? String(filePath).trim() : null,",
                "    first_line: firstLine ? String(firstLine).trim() : null,",
                "    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),",
                "  });",
                "}",
                "",
            ]
        )
        (sdk_dir / "arcbench_visual.js").write_text(visual_js, encoding="utf-8")
        (sdk_dir / "arcbench_visual.ts").write_text(
            "\n".join(
                [
                    "export type RequirementPhase = 'design' | 'implement' | 'test';",
                    "export type RequirementStatus = 'completed' | 'passed' | 'failed';",
                    "export type TraceabilityInterfaceType = 'UI' | 'API' | 'FUNC' | 'DB';",
                    "export type TraceabilityTestType = 'Unit' | 'Integration' | 'E2E';",
                    "",
                    *visual_js.splitlines(),
                    "",
                ]
            ),
            encoding="utf-8",
        )

    def _write_demo_test_status_seed(self, output_path: Path) -> None:
        payload = {
            "tests": {},
            "requirements": {},
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    @staticmethod
    def _flatten_single_root(agent_dir: Path) -> None:
        children = [child for child in agent_dir.iterdir()]
        if len(children) != 1 or not children[0].is_dir():
            return
        root_dir = children[0]
        for child in list(root_dir.iterdir()):
            shutil.move(str(child), agent_dir / child.name)
        root_dir.rmdir()
