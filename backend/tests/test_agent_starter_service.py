import unittest
import zipfile
from io import BytesIO

from app.services.agent_starter_service import AgentStarterService


class AgentStarterServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = AgentStarterService()

    def test_every_reference_agent_download_includes_the_web_template(self) -> None:
        for template_kind in ("blank", "arc", "codex", "claude_code"):
            with self.subTest(template_kind=template_kind):
                content, filename = self.service.build_bundle(
                    task_type="web",
                    language="python",
                    template_kind=template_kind,
                )

                self.assertIn(template_kind, filename)
                with zipfile.ZipFile(BytesIO(content)) as archive:
                    names = set(archive.namelist())
                self.assertIn("main.py", names)
                self.assertIn("template/backend/app/main.py", names)
                self.assertIn("template/frontend/package.json", names)

    def test_task_type_uses_current_arc_template_directories(self) -> None:
        expected_files = {
            "web": "template/backend/app/main.py",
            "mobile": "template/app/build.gradle",
            "cli": "template/app/__main__.py",
        }
        for task_type, expected_file in expected_files.items():
            with self.subTest(task_type=task_type):
                content, _ = self.service.build_bundle(
                    task_type=task_type,
                    language="python",
                    template_kind="blank",
                )
                with zipfile.ZipFile(BytesIO(content)) as archive:
                    self.assertIn(expected_file, archive.namelist())


if __name__ == "__main__":
    unittest.main()
