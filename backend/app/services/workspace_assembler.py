import shutil
import json
import zipfile
from pathlib import Path

from app.models.requirement import Requirement
from app.models.run import Run
from app.models.submission import Submission
from app.models.user import User
from app.services.runtime_path_service import RuntimePathService
from app.services.traceability_seed_builder import TraceabilitySeedBuilder


class WorkspaceAssembler:
    def __init__(self) -> None:
        self.runtime_paths = RuntimePathService()
        self.traceability_seed_builder = TraceabilitySeedBuilder()

    def assemble(self, run: Run, submission: Submission, requirement: Requirement, user: User) -> Path:
        workspace_root = self.runtime_paths.get_workspace_root(run, username=user.username)
        if workspace_root.exists():
            shutil.rmtree(workspace_root)
        submission_dir = workspace_root / "submission"
        template_dir = workspace_root / "template"
        tests_dir = workspace_root / "tests"
        requirements_dir = template_dir / "requirements"
        arc_dir = template_dir / ".arc"

        submission_dir.mkdir(parents=True, exist_ok=True)
        template_dir.mkdir(parents=True, exist_ok=True)
        tests_dir.mkdir(parents=True, exist_ok=True)
        arc_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(run.agent_archive_path, "r") as archive:
            archive.extractall(submission_dir)
        self._flatten_single_root(submission_dir)
        requirement_root = Path(requirement.requirements_path).resolve().parent
        # The output workspace intentionally starts empty. An uploaded agent owns
        # any starter-template selection and initialization before it writes to
        # this directory; ARC-Bench only prepares the execution environment.
        self._copy_requirement_workspace(requirement, requirement_root, requirements_dir)
        self._copy_optional_tree(Path(requirement.tests_path), tests_dir)
        self.traceability_seed_builder.write_seed_file(
            arc_dir / "traceability-seed.json",
            requirement,
            requirement_yaml_path=requirements_dir / "requirements.yaml",
        )

        (workspace_root / "runner-spec.json").write_text(
            json.dumps(
                {
                    "agent_source": submission.agent_source,
                    "runtime": submission.runtime,
                    "submission_dir": "/workspace/submission",
                    "template_dir": "/workspace/template",
                    "project_dir": "/workspace/template",
                    "tests_dir": "/workspace/tests",
                    "arc_dir": ".arc",
                    "requirement_dir": "requirements",
                    "output_dir": "/workspace/template",
                    "runner_events_path": ".arc/runner-events.jsonl",
                    "traceability_dir": ".arc/traceability",
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
    def _copy_optional_tree(source: Path, destination: Path) -> None:
        if not source.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
            return
        shutil.copytree(source, destination, dirs_exist_ok=True)

    def _copy_requirement_workspace(
        self,
        requirement: Requirement,
        requirement_root: Path,
        requirements_dir: Path,
    ) -> None:
        if requirements_dir.exists():
            shutil.rmtree(requirements_dir)
        requirements_dir.mkdir(parents=True, exist_ok=True)

        excluded_names = {"template", "tests"}
        for source_path in requirement_root.iterdir():
            if source_path.name in excluded_names:
                continue
            destination_path = requirements_dir / source_path.name
            if source_path.is_dir():
                shutil.copytree(source_path, destination_path, dirs_exist_ok=True)
            elif source_path.is_file():
                destination_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source_path, destination_path)

        requirement_markdown_path = Path(requirement.requirements_path)
        requirement_yaml_path = requirement_markdown_path.with_name("requirements.yaml")
        prerequisites_path = Path(requirement.prerequisites_path)
        if requirement_markdown_path.is_file():
            shutil.copy2(requirement_markdown_path, requirements_dir / "requirements.md")
        if requirement_yaml_path.is_file():
            shutil.copy2(requirement_yaml_path, requirements_dir / "requirements.yaml")
        if prerequisites_path.is_file():
            shutil.copy2(prerequisites_path, requirements_dir / "prerequisites.md")
        elif not (requirements_dir / "prerequisites.md").exists():
            (requirements_dir / "prerequisites.md").write_text("", encoding="utf-8")

        self._copy_optional_tree(Path(requirement.assets_path), requirements_dir / "assets")
        self._copy_optional_tree(Path(requirement.references_path), requirements_dir / "reference")

        if not (requirements_dir / "requirements.yaml").is_file():
            raise FileNotFoundError(
                f"Requirement source is missing requirements.yaml: {requirement_yaml_path}"
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
