import shutil
import json
import zipfile
from pathlib import Path

from app.core.config import get_settings
from app.models.requirement import Requirement
from app.models.submission import Submission
from app.models.user import User
from app.services.runtime_path_service import RuntimePathService


class WorkspaceAssembler:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.runtime_paths = RuntimePathService()

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
        shutil.copy2(Path(requirement.prerequisites_path), task_dir / "prerequisites.md")
        shutil.copytree(Path(requirement.tests_path), tests_dir, dirs_exist_ok=True)
        self._write_visual_sdk_files(sdk_dir)

        prompt_text = self._build_prompt(requirement)
        (prompt_dir / "task_prompt.txt").write_text(prompt_text, encoding="utf-8")
        (workspace_root / "runner-spec.json").write_text(
            json.dumps(
                {
                    "submission_dir": "/workspace/submission",
                    "sdk_dir": "/workspace/sdk",
                    "template_dir": "/workspace/template",
                    "task_dir": "/workspace/task",
                    "tests_dir": "/workspace/tests",
                    "artifacts_dir": "/workspace/artifacts",
                    "runner_events_path": "/workspace/artifacts/runner-events.jsonl",
                    "prompt_path": "/workspace/prompt/task_prompt.txt",
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
                "5. Use the built-in visualization SDK when you finish major requirement nodes.",
                "6. In Python you can import directly with: from arcbench_visual import mark_design_done, mark_implementation_done, mark_test_passed, mark_test_failed",
                "7. JavaScript SDK path: /workspace/sdk/arcbench_visual.js",
                "8. TypeScript SDK path: /workspace/sdk/arcbench_visual.ts",
                "9. Reference nodes by requirement tree node id, for example ROOT or REQ-1.",
                "10. When implementation is complete, exit the program successfully.",
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
                    "import time",
                    "",
                    "_RUNNER_EVENTS_PATH = os.environ.get('ARCBENCH_RUNNER_EVENTS_PATH', '/workspace/artifacts/runner-events.jsonl')",
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
            ]
        )
        (sdk_dir / "arcbench_visual.js").write_text(visual_js, encoding="utf-8")
        (sdk_dir / "arcbench_visual.ts").write_text(
            "\n".join(
                [
                    "export type RequirementPhase = 'design' | 'implement' | 'test';",
                    "export type RequirementStatus = 'completed' | 'passed' | 'failed';",
                    "",
                    *visual_js.splitlines(),
                    "",
                ]
            ),
            encoding="utf-8",
        )

    @staticmethod
    def _flatten_single_root(agent_dir: Path) -> None:
        children = [child for child in agent_dir.iterdir()]
        if len(children) != 1 or not children[0].is_dir():
            return
        root_dir = children[0]
        for child in list(root_dir.iterdir()):
            shutil.move(str(child), agent_dir / child.name)
        root_dir.rmdir()
