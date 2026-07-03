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
        self._copy_agent_runtime_sdk_sources(sdk_dir)
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
                "7. Preferred Python import: from arcbench_agent_runtime import AgentRuntime",
                "8. Reference requirement nodes by exact requirement tree node id, for example ROOT or REQ-1.",
                "9. Register interfaces and tests when you create them so traceability artifacts remain complete.",
                "10. When implementation is complete, exit the program successfully.",
                "",
                f"Requirement ID: {requirement.id}",
                f"Requirement title: {requirement.title}",
                f"Category: {requirement.category}",
            ]
        ) + "\n"

    def _write_demo_test_status_seed(self, output_path: Path) -> None:
        payload = {
            "tests": {},
            "requirements": {},
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def _copy_agent_runtime_sdk_sources(self, sdk_dir: Path) -> None:
        src_root = self.settings.agent_runtime_package_root / "src" / "arcbench_agent_runtime"
        if not src_root.is_dir():
            raise FileNotFoundError(f"Agent runtime SDK source root not found: {src_root}")
        shutil.copytree(src_root, sdk_dir / "arcbench_agent_runtime", dirs_exist_ok=True)

    @staticmethod
    def _flatten_single_root(agent_dir: Path) -> None:
        children = [child for child in agent_dir.iterdir()]
        if len(children) != 1 or not children[0].is_dir():
            return
        root_dir = children[0]
        for child in list(root_dir.iterdir()):
            shutil.move(str(child), agent_dir / child.name)
        root_dir.rmdir()
