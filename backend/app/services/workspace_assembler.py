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
        template_dir = workspace_root / "template"
        task_dir = workspace_root / "task"
        tests_dir = workspace_root / "tests"
        artifacts_dir = workspace_root / "artifacts"
        prompt_dir = workspace_root / "prompt"

        submission_dir.mkdir(parents=True, exist_ok=True)
        template_dir.mkdir(parents=True, exist_ok=True)
        task_dir.mkdir(parents=True, exist_ok=True)
        tests_dir.mkdir(parents=True, exist_ok=True)
        artifacts_dir.mkdir(parents=True, exist_ok=True)
        prompt_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(submission.archive_path, "r") as archive:
            archive.extractall(submission_dir)

        self._flatten_single_root(submission_dir)
        shutil.copytree(self.settings.templates_root, template_dir, dirs_exist_ok=True)
        shutil.copytree(Path(requirement.assets_path), task_dir / "assets", dirs_exist_ok=True)
        shutil.copytree(Path(requirement.references_path), task_dir / "reference", dirs_exist_ok=True)
        shutil.copy2(Path(requirement.requirements_path), task_dir / "requirements.md")
        shutil.copy2(Path(requirement.prerequisites_path), task_dir / "prerequisites.md")
        shutil.copytree(Path(requirement.tests_path), tests_dir, dirs_exist_ok=True)

        prompt_text = self._build_prompt(requirement)
        (prompt_dir / "task_prompt.txt").write_text(prompt_text, encoding="utf-8")
        (workspace_root / "runner-spec.json").write_text(
            json.dumps(
                {
                    "submission_dir": "/workspace/submission",
                    "template_dir": "/workspace/template",
                    "task_dir": "/workspace/task",
                    "tests_dir": "/workspace/tests",
                    "artifacts_dir": "/workspace/artifacts",
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
                "- Requirement document: /workspace/task/requirements.md",
                "- Prerequisites document: /workspace/task/prerequisites.md",
                "- Task assets: /workspace/task/assets",
                "- Reference images: /workspace/task/reference",
                "",
                "Instructions:",
                "1. Read prerequisites.md and requirements.md completely.",
                "2. Use the files in assets/ and reference/ when implementing the product.",
                "3. Apply your changes directly inside /workspace/template.",
                "4. Keep the project runnable with the template's frontend and backend structure.",
                "5. When implementation is complete, exit the program successfully.",
                "",
                f"Requirement ID: {requirement.id}",
                f"Requirement title: {requirement.title}",
                f"Category: {requirement.category}",
            ]
        ) + "\n"

    @staticmethod
    def _flatten_single_root(agent_dir: Path) -> None:
        children = [child for child in agent_dir.iterdir()]
        if len(children) != 1 or not children[0].is_dir():
            return
        root_dir = children[0]
        for child in list(root_dir.iterdir()):
            shutil.move(str(child), agent_dir / child.name)
        root_dir.rmdir()
