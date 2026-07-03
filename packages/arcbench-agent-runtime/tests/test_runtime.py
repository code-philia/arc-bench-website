from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[1] / "src"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))

from arcbench_agent_runtime import AgentRuntime  # noqa: E402


class AgentRuntimeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.runtime = AgentRuntime.from_env(
            project_dir=str(self.root / "template"),
            runner_events_path=str(self.root / "artifacts" / "runner-events.jsonl"),
            traceability_db_path=str(self.root / "artifacts" / "traceability.db"),
            demo_test_status_path=str(self.root / "artifacts" / "demo-test-statuses.json"),
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_requirement_state_and_db_crud(self) -> None:
        self.runtime.traceability.init_db(reset=True)
        self.runtime.events.mark_design_done("REQ-1", "design ok")
        self.runtime.traceability.upsert_requirement(
            req_id="REQ-1",
            name="Login",
            description="user can log in",
            scenarios=[
                {
                    "id": "REQ-1-SCN-1",
                    "name": "happy path",
                    "steps": [{"keyword": "GIVEN", "content": "user opens page"}],
                }
            ],
        )
        self.runtime.traceability.upsert_interface(
            interface_id="IF-1",
            req_ids=["REQ-1"],
            type="UI",
            content="login form",
            implemented=False,
        )
        self.runtime.traceability.upsert_test(
            test_id="TEST-1",
            req_id="REQ-1",
            type="E2E",
            interface_ids=["IF-1"],
            passed=True,
        )
        self.runtime.traceability.upsert_node_state("REQ-1", "PASSED")

        requirement = self.runtime.traceability.get_requirement("REQ-1")
        interface = self.runtime.traceability.get_interface("IF-1")
        test = self.runtime.traceability.get_test("TEST-1")
        node_state = self.runtime.traceability.get_node_state("REQ-1")
        demo_status = json.loads(self.runtime.paths.demo_test_status_path.read_text(encoding="utf-8"))
        runner_lines = self.runtime.paths.runner_events_path.read_text(encoding="utf-8").splitlines()

        self.assertIsNotNone(requirement)
        self.assertEqual(requirement["name"], "Login")
        self.assertEqual(len(requirement["scenarios"]), 1)
        self.assertIsNotNone(interface)
        self.assertFalse(interface["implemented"])
        self.assertIsNotNone(test)
        self.assertEqual(test["passed"], True)
        self.assertEqual(node_state["state"], "PASSED")
        self.assertEqual(demo_status["tests"]["TEST-1"], "passed")
        self.assertEqual(demo_status["requirements"]["REQ-1"], "passed")
        self.assertTrue(any('"type": "requirement_state"' in line for line in runner_lines))
        self.assertTrue(any('"type": "interface_upsert"' in line for line in runner_lines))
        self.assertTrue(any('"type": "test_upsert"' in line for line in runner_lines))

    def test_git_init_commit_and_rollback(self) -> None:
        if subprocess.run(["git", "--version"], capture_output=True, check=False).returncode != 0:
            self.skipTest("git is not available")
        project_dir = self.runtime.paths.project_dir
        project_dir.mkdir(parents=True, exist_ok=True)
        (project_dir / "README.md").write_text("hello\n", encoding="utf-8")

        self.runtime.git.ensure_repo(create_initial_commit=True)
        initial_head = self.runtime.git.current_head()
        self.assertIsNotNone(initial_head)

        (project_dir / "README.md").write_text("hello world\n", encoding="utf-8")
        committed = self.runtime.git.commit("REQ-1 (design): Login")
        self.assertTrue(committed)

        second_head = self.runtime.git.current_head()
        self.assertIsNotNone(second_head)
        self.assertNotEqual(initial_head, second_head)

        self.runtime.git.rollback_last_commit(hard=True)
        rolled_back_head = self.runtime.git.current_head()
        self.assertEqual(initial_head, rolled_back_head)


if __name__ == "__main__":
    unittest.main()
