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

    def build_bundle(self, *, task_type: str) -> tuple[bytes, str]:
        if not self.package_root.is_dir():
            raise FileNotFoundError(f"Agent runtime package root not found: {self.package_root}")

        template_root = self._resolve_template_root(task_type)
        memory_file = BytesIO()
        with zipfile.ZipFile(memory_file, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            self._write_main_py(archive)
            self._write_examples(archive)
            self._write_requirements_txt(archive)
            self._write_readme(archive, task_type=task_type)
            self._add_package_sources(archive)
            self._add_task_template(archive, template_root)
        return memory_file.getvalue(), f"arcbench-agent-starter-{task_type}.zip"

    def _write_main_py(self, archive: zipfile.ZipFile) -> None:
        content = textwrap.dedent(
            """
            from __future__ import annotations

            import argparse
            import os
            from pathlib import Path

            from arcbench_agent_runtime import AgentRuntime


            def parse_args() -> argparse.Namespace:
                parser = argparse.ArgumentParser(description="Run the ARC-Bench starter agent.")
                parser.add_argument(
                    "requirement_path",
                    nargs="?",
                    default=os.environ.get("ARCBENCH_TASK_DIR", "/workspace/task"),
                    help="Requirement directory containing requirements.yaml.",
                )
                parser.add_argument(
                    "--output-dir",
                    default=os.environ.get("ARCBENCH_OUTPUT_DIR", "/workspace/template"),
                    help="Output workspace directory.",
                )
                parser.add_argument(
                    "--app-type",
                    choices=["web", "android"],
                    default="web",
                    help="Application type for runtime context.",
                )
                parser.add_argument(
                    "--web-port",
                    type=int,
                    default=int(os.environ.get("ARCBENCH_WEB_PORT", "3000")),
                    help="Backend port for generated web applications.",
                )
                return parser.parse_args()


            def resolve_requirements_dir(path: str) -> Path:
                return Path(path).resolve()


            def resolve_output_dir(path: str) -> Path:
                return Path(path).resolve()


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
                args = parse_args()
                runtime = AgentRuntime.from_env()
                requirements_dir = resolve_requirements_dir(args.requirement_path)
                output_dir = resolve_output_dir(args.output_dir)
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

    def _write_readme(self, archive: zipfile.ZipFile, *, task_type: str) -> None:
        content = textwrap.dedent(
            f"""
            # ARC-Bench Agent Starter

            This starter zip is the recommended input scaffold for uploaded Python agents.

            Task type: `{task_type}`

            Included files:

            - `main.py`: fixed ARC-Bench entrypoint
            - `arcbench_agent_runtime/`: SDK source package
            - `examples/python_usage.py`: usage examples
            - `requirements.txt`: starter dependencies
            - `template/`: reference project template matching the task type

            Runtime assumptions:

            - requirements live under `/workspace/task`
            - output project should be written into `/workspace/template`
            - runner events should be written to `/workspace/artifacts/runner-events.jsonl`
            - the runner launches `python3 main.py /workspace/task --output-dir /workspace/template --app-type {task_type if task_type in {"web", "android"} else "web"}`
            - for web tasks, the runner also appends `--web-port 3000`
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

    def _add_task_template(self, archive: zipfile.ZipFile, template_root: Path) -> None:
        if not template_root.is_dir():
            raise FileNotFoundError(f"Task template directory not found: {template_root}")
        for path in sorted(template_root.rglob("*")):
            if path.is_dir():
                continue
            relative_path = path.relative_to(template_root)
            archive.write(path, arcname=f"template/{relative_path.as_posix()}")

    def _resolve_template_root(self, task_type: str) -> Path:
        normalized = str(task_type or "").strip().lower()
        arc_bench_root = self.settings.requirements_root.parent.parent
        if normalized == "mobile":
            return arc_bench_root / "mobileapp" / "template"
        return arc_bench_root / "webapp" / "template"
