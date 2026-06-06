import shutil
import zipfile
from pathlib import Path

from app.core.config import get_settings
from app.models.requirement import Requirement
from app.models.submission import Submission


class WorkspaceAssembler:
    def __init__(self) -> None:
        self.settings = get_settings()

    def assemble(self, submission: Submission, requirement: Requirement) -> Path:
        workspace_root = self.settings.workspaces_root / submission.id
        if workspace_root.exists():
            shutil.rmtree(workspace_root)
        agent_dir = workspace_root / "agent"
        requirement_dir = workspace_root / "requirement"
        tests_dir = workspace_root / "tests"
        artifacts_dir = workspace_root / "artifacts"

        agent_dir.mkdir(parents=True, exist_ok=True)
        requirement_dir.mkdir(parents=True, exist_ok=True)
        tests_dir.mkdir(parents=True, exist_ok=True)
        artifacts_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(submission.archive_path, "r") as archive:
            archive.extractall(agent_dir)

        self._flatten_single_root(agent_dir)
        shutil.copytree(Path(requirement.assets_path), requirement_dir / "assets", dirs_exist_ok=True)
        shutil.copytree(Path(requirement.references_path), requirement_dir / "reference", dirs_exist_ok=True)
        shutil.copy2(Path(requirement.requirements_path), requirement_dir / "requirements.md")
        shutil.copy2(Path(requirement.prerequisites_path), requirement_dir / "prerequisites.md")
        shutil.copytree(Path(requirement.tests_path), tests_dir, dirs_exist_ok=True)

        debug_log_path = workspace_root / "execution.debug.log"
        debug_log_path.write_text(
            "Workspace assembled successfully.\n",
            encoding="utf-8",
        )
        return workspace_root

    @staticmethod
    def _flatten_single_root(agent_dir: Path) -> None:
        children = [child for child in agent_dir.iterdir()]
        if len(children) != 1 or not children[0].is_dir():
            return
        root_dir = children[0]
        for child in list(root_dir.iterdir()):
            shutil.move(str(child), agent_dir / child.name)
        root_dir.rmdir()
