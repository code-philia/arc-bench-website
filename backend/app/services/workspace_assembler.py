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
        requirement_category = requirement.category
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
        self._prepare_artifact_directories(artifacts_dir)
        self._prepare_sdk_directories(sdk_dir, requirement_category)

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
        task_info_path = requirement_markdown_path.with_name("task_info.json")
        if requirement_category == "mobile" and task_info_path.exists():
            shutil.copy2(task_info_path, task_dir / "task_info.json")
        shutil.copytree(Path(requirement.tests_path), tests_dir, dirs_exist_ok=True)
        self.traceability_seed_builder.write_seed_file(
            artifacts_dir / "traceability-seed.json",
            requirement,
            requirement_yaml_path=task_dir / "requirements.yaml",
        )
        self._write_demo_test_status_seed(artifacts_dir / "demo-test-statuses.json")

        task_info = self._read_task_info(task_dir / "task_info.json")

        (workspace_root / "runner-spec.json").write_text(
            json.dumps(
                {
                    "agent_source": submission.agent_source,
                    "submission_dir": "/workspace/submission",
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
                            requirement_category,
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
                    "android": self._build_android_spec(requirement.id, task_info),
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

    def _write_demo_test_status_seed(self, output_path: Path) -> None:
        payload = {
            "tests": {},
            "requirements": {},
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    @staticmethod
    def _prepare_artifact_directories(artifacts_dir: Path) -> None:
        for relative_path in [
            "build",
            "build/outputs",
            "device",
            "device/screenshots",
            "device/ui_dumps",
            "device/recordings",
            "evaluation",
        ]:
            (artifacts_dir / relative_path).mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _prepare_sdk_directories(sdk_dir: Path, category: str) -> None:
        (sdk_dir / "traceability").mkdir(parents=True, exist_ok=True)
        if category == "mobile":
            (sdk_dir / "android_runner_sdk").mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _read_task_info(path: Path) -> dict:
        if not path.exists():
            return {}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}

    @staticmethod
    def _build_android_spec(requirement_id: str, task_info: dict) -> dict:
        return {
            "sdk_root": "/opt/android",
            "emulator_mode": "in_container",
            "avd_name": "arcbench_api31",
            "apk_output_path": "/workspace/artifacts/build/outputs/app-debug.apk",
            "results_path": "/workspace/artifacts/result.json",
            "template_name": "android-starter",
            "requirement_id": requirement_id,
            "package_name_hint": str(task_info.get("package_name", "com.arcbench.generated")),
            "permissions": list(task_info.get("permissions", [])),
        }

    @staticmethod
    def _flatten_single_root(agent_dir: Path) -> None:
        children = [child for child in agent_dir.iterdir()]
        if len(children) != 1 or not children[0].is_dir():
            return
        root_dir = children[0]
        for child in list(root_dir.iterdir()):
            shutil.move(str(child), agent_dir / child.name)
        root_dir.rmdir()
