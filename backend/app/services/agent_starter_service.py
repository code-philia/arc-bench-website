from __future__ import annotations

from io import BytesIO
from pathlib import Path
import textwrap
import zipfile

from app.core.config import get_settings


class AgentStarterService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.package_root = self.settings.agent_runtime_package_root

    def build_bundle(self) -> tuple[bytes, str]:
        if not self.package_root.is_dir():
            raise FileNotFoundError(f"Agent runtime package root not found: {self.package_root}")

        memory_file = BytesIO()
        with zipfile.ZipFile(memory_file, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            self._write_main_py(archive)
            self._write_examples(archive)
            self._write_requirements_txt(archive)
            self._write_readme(archive)
            self._add_package_sources(archive)
        return memory_file.getvalue(), "arcbench-agent-starter.zip"

    def _write_main_py(self, archive: zipfile.ZipFile) -> None:
        content = textwrap.dedent(
            """
            from __future__ import annotations

            import os
            from pathlib import Path

            from arcbench_agent_runtime import AgentRuntime


            def resolve_requirements_dir() -> Path:
                task_dir = Path(os.environ.get("ARCBENCH_TASK_DIR", "/workspace/task"))
                return task_dir


            def resolve_output_dir() -> Path:
                return Path(os.environ.get("ARCBENCH_OUTPUT_DIR", "/workspace/template"))


            def run_agent(runtime: AgentRuntime, requirements_dir: Path, output_dir: Path) -> None:
                \"\"\"
                Fill your agent logic here.

                Recommended flow:
                1. Read requirements_dir / "requirements.yaml" and prerequisites.md
                2. Modify files under output_dir
                3. Use runtime.events / runtime.traceability / runtime.git as needed
                \"\"\"
                runtime.traceability.init_db()
                runtime.git.ensure_repo(create_initial_commit=True)

                runtime.events.mark_design_done("ROOT", "Agent entrypoint is wired")

                # Example placeholder artifact registration.
                runtime.traceability.upsert_requirement(
                    req_id="ROOT",
                    name="ROOT",
                    description="Top-level starter execution placeholder",
                )

                # TODO: replace this placeholder with your real agent workflow.
                runtime.events.mark_implementation_done("ROOT", "Starter main.py executed")
                runtime.events.mark_test_passed("ROOT", "Starter placeholder finished successfully")


            def main() -> int:
                runtime = AgentRuntime.from_env()
                requirements_dir = resolve_requirements_dir()
                output_dir = resolve_output_dir()
                run_agent(runtime, requirements_dir, output_dir)
                return 0


            if __name__ == "__main__":
                raise SystemExit(main())
            """
        ).strip() + "\n"
        archive.writestr("main.py", content)

    def _write_examples(self, archive: zipfile.ZipFile) -> None:
        example_content = textwrap.dedent(
            """
            from __future__ import annotations

            from arcbench_agent_runtime import AgentRuntime


            def example_usage() -> None:
                runtime = AgentRuntime.from_env()

                runtime.traceability.init_db()

                runtime.events.mark_design_done("REQ-1", "Design completed")

                runtime.traceability.upsert_requirement(
                    req_id="REQ-1",
                    name="Login",
                    description="User can log in",
                    scenarios=[
                        {
                            "id": "REQ-1-SCN-1",
                            "name": "Happy path",
                            "steps": [
                                {"keyword": "GIVEN", "content": "user opens the login page"},
                                {"keyword": "WHEN", "content": "user submits valid credentials"},
                                {"keyword": "THEN", "content": "user enters the home page"},
                            ],
                        }
                    ],
                )

                runtime.traceability.upsert_interface(
                    interface_id="IF-LOGIN-API",
                    req_ids=["REQ-1"],
                    type="API",
                    content="POST /api/auth/login",
                    file_path="backend/src/routes/auth.py",
                    first_line="18",
                    implemented=False,
                )

                runtime.traceability.upsert_test(
                    test_id="TEST-LOGIN-E2E",
                    req_id="REQ-1",
                    type="E2E",
                    file_path="tests/login.spec.ts",
                    first_line="7",
                    interface_ids=["IF-LOGIN-API"],
                )

                runtime.traceability.set_interface_implemented(
                    "IF-LOGIN-API",
                    True,
                    "Login endpoint is implemented",
                )
                runtime.traceability.set_test_pass_status("TEST-LOGIN-E2E", True)
                runtime.traceability.upsert_node_state("REQ-1", "PASSED")

                runtime.git.ensure_repo(create_initial_commit=True)
                runtime.git.commit("REQ-1 (design): Login")
            """
        ).strip() + "\n"
        archive.writestr("examples/python_usage.py", example_content)

    def _write_requirements_txt(self, archive: zipfile.ZipFile) -> None:
        content = "arcbench-agent-runtime\n"
        archive.writestr("requirements.txt", content)

    def _write_readme(self, archive: zipfile.ZipFile) -> None:
        content = textwrap.dedent(
            """
            # ARC-Bench Agent Starter

            This starter zip is the recommended input scaffold for uploaded Python agents.

            Included files:

            - `main.py`: fixed ARC-Bench entrypoint
            - `arcbench_agent_runtime/`: SDK source package
            - `examples/python_usage.py`: usage examples
            - `requirements.txt`: starter dependencies

            Runtime assumptions:

            - requirements live under `/workspace/task`
            - output project should be written into `/workspace/template`
            - runner events should be written to `/workspace/artifacts/runner-events.jsonl`
            """
        ).strip() + "\n"
        archive.writestr("README.md", content)

    def _add_package_sources(self, archive: zipfile.ZipFile) -> None:
        src_root = self.package_root / "src"
        if not src_root.is_dir():
            raise FileNotFoundError(f"Package source root not found: {src_root}")
        for path in sorted(src_root.rglob("*")):
            if path.is_dir():
                continue
            relative_path = path.relative_to(src_root)
            archive.write(path, arcname=relative_path.as_posix())
