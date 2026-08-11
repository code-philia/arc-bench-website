import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


RUNNER_PATH = Path(__file__).resolve().parents[1] / "runner" / "agent-runner" / "run_submission.py"


def load_runner_module():
    spec = importlib.util.spec_from_file_location("arcbench_runner_command_test", RUNNER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the ARC runner module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AgentRunnerCommandTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.runner = load_runner_module()
        self.runner.WORKSPACE_ROOT = self.root
        self.runner.SUBMISSION_DIR = self.root / "submission"
        self.runner.PROJECT_DIR = self.root / "template"
        self.runner.REQUIREMENTS_DIR = self.runner.PROJECT_DIR / "requirements"
        self.runner.REQUIREMENT_SOURCE_DIR = self.root / "requirements-source"
        self.runner.SPEC_PATH = self.root / "runner-spec.json"
        self.runner.DEBUG_LOG_PATH = self.root / "execution.debug.log"

        self.runner.SUBMISSION_DIR.mkdir(parents=True)
        self.runner.REQUIREMENTS_DIR.mkdir(parents=True)
        (self.runner.SUBMISSION_DIR / "main.py").write_text("# entrypoint\n", encoding="utf-8")
        (self.runner.REQUIREMENTS_DIR / "requirements.yaml").write_text("id: task\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _write_spec(self, agent_source: str) -> None:
        self.runner.SPEC_PATH.write_text(
            json.dumps(
                {
                    "agent_source": agent_source,
                    "runtime": "python",
                    "output_dir": str(self.runner.PROJECT_DIR),
                    "task": {"category": "web"},
                }
            ),
            encoding="utf-8",
        )

    def test_builtin_arc_uses_the_common_agent_contract(self) -> None:
        self._write_spec("builtin_arc_agent")

        command = self.runner.build_generation_agent_command(
            self.runner.resolve_agent_entrypoint("python"),
            "python",
        )

        self.assertEqual(
            command,
            [
                "python3",
                str(self.runner.SUBMISSION_DIR / "main.py"),
                str(self.runner.REQUIREMENT_SOURCE_DIR),
                "--output-dir",
                str(self.runner.PROJECT_DIR),
                "--type",
                "web",
            ],
        )
        self.assertTrue((self.runner.REQUIREMENT_SOURCE_DIR / "requirements.yaml").is_file())

    def test_uploaded_python_agent_uses_the_same_type_aware_contract(self) -> None:
        self._write_spec("upload")

        command = self.runner.build_generation_agent_command(
            self.runner.resolve_agent_entrypoint("python"),
            "python",
        )

        self.assertEqual(
            command,
            [
                "python3",
                str(self.runner.SUBMISSION_DIR / "main.py"),
                str(self.runner.REQUIREMENT_SOURCE_DIR),
                "--output-dir",
                str(self.runner.PROJECT_DIR),
                "--type",
                "web",
            ],
        )


if __name__ == "__main__":
    unittest.main()
