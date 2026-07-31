import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from app.api.routes import submissions


class SubmissionPreviewRouteTests(unittest.TestCase):
    def test_preview_status_resolves_workspace_path_without_name_error(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace = Path(temp_dir)
            submission = SimpleNamespace(id="submission-a", workspace_path=str(workspace))
            service = SimpleNamespace(get_submission=lambda submission_id, user_id: submission)
            payload = {
                "available": False,
                "stale": False,
                "preview_url": None,
                "workspace_head_oid": None,
                "preview_head_oid": None,
                "error": "Preview workspace is not available",
            }
            with patch.object(submissions, "SubmissionService", return_value=service), \
                 patch.object(submissions.runtime_paths, "resolve_existing_path", return_value=workspace), \
                 patch.object(submissions.HostDemoPreviewService, "get_status", return_value=payload):
                result = submissions.get_submission_preview_status(
                    "submission-a",
                    db=object(),
                    current_user=SimpleNamespace(id="user-a"),
                )

            self.assertEqual(result.error, "Preview workspace is not available")


if __name__ == "__main__":
    unittest.main()
