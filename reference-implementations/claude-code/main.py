from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import os
import shutil
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class RequirementModule:
    index: int
    total: int
    node_id: str
    name: str
    subtree: dict[str, Any]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Implement an ARC-Bench task with Claude Code.")
    parser.add_argument(
        "requirement_path",
        nargs="?",
        default=os.environ.get("ARCBENCH_TASK_DIR", "requirements"),
        help="Directory containing requirements.yaml.",
    )
    parser.add_argument(
        "--output-dir",
        default=os.environ.get("ARCBENCH_OUTPUT_DIR", "."),
        help="Target directory for the generated project.",
    )
    return parser.parse_args()


def copy_template_contents(template_dir: Path, output_dir: Path) -> None:
    """Copy the bundled template's children into the output directory."""
    if not template_dir.is_dir():
        raise FileNotFoundError(f"Starter template directory not found: {template_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)
    for source in sorted(template_dir.iterdir()):
        if source.name == "template.yaml":
            continue
        destination = output_dir / source.name
        if source.is_dir():
            shutil.copytree(source, destination, dirs_exist_ok=True)
        else:
            shutil.copy2(source, destination)


def copy_skills_to_output(skills_dir: Path, output_dir: Path) -> Path:
    if not skills_dir.is_dir():
        raise FileNotFoundError(f"Skills directory not found: {skills_dir}")
    destination = output_dir / ".claude" / "skills"
    shutil.copytree(skills_dir, destination, dirs_exist_ok=True)
    return destination


def load_root_modules(requirements_dir: Path) -> list[RequirementModule]:
    requirements_path = requirements_dir / "requirements.yaml"
    if not requirements_path.is_file():
        raise FileNotFoundError(f"requirements.yaml not found: {requirements_path}")

    payload = yaml.safe_load(requirements_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or str(payload.get("id") or "").strip() != "ROOT":
        raise ValueError("requirements.yaml must contain a ROOT mapping")

    children = [item for item in payload.get("children", []) if isinstance(item, dict)]
    if not children:
        raise ValueError("ROOT must contain at least one child module")

    modules: list[RequirementModule] = []
    for index, subtree in enumerate(children, start=1):
        node_id = str(subtree.get("id") or subtree.get("req_id") or "").strip()
        if not node_id:
            raise ValueError(f"ROOT child {index} has no id")
        modules.append(
            RequirementModule(
                index=index,
                total=len(children),
                node_id=node_id,
                name=str(subtree.get("name") or node_id).strip(),
                subtree=subtree,
            )
        )
    return modules


@contextlib.contextmanager
def claude_env_from_openai_env() -> Any:
    """Preserve the existing ARC-Bench OpenAI-compatible to Claude SDK mapping."""
    keys = ("ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN")
    previous = {key: os.environ.get(key) for key in keys}
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    openai_base_url = os.environ.get("OPENAI_BASE_URL", "").strip()

    os.environ["ANTHROPIC_API_KEY"] = ""
    if openai_base_url:
        os.environ["ANTHROPIC_BASE_URL"] = openai_base_url
    else:
        os.environ.pop("ANTHROPIC_BASE_URL", None)
    if openai_key:
        os.environ["ANTHROPIC_AUTH_TOKEN"] = openai_key
    else:
        os.environ.pop("ANTHROPIC_AUTH_TOKEN", None)

    try:
        yield
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def _require_claude_sdk() -> tuple[Any, Any]:
    try:
        from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, ResultMessage
    except ImportError as exc:
        raise RuntimeError("Install the agent dependencies before running this Claude Code agent.") from exc
    return ClaudeAgentOptions, ClaudeSDKClient, ResultMessage


def _system_prompt(skills_dir: Path) -> dict[str, str]:
    append = textwrap.dedent(
        f"""
        You implement an ARC-Bench application in the current working directory.
        The directory already contains an initialized starter application. Preserve existing work.

        Each request supplies exactly one direct child subtree of ROOT. Implement that subtree,
        including all of its descendants, in the current project. Do not ask for or read the
        complete requirements.yaml. Make practical code changes and leave the application runnable.

        ARC-Bench skills are available in {skills_dir}:
        - Read arcbench-runtime-signals/SKILL.md to report module progress when useful.
        - Read arcbench-traceability/SKILL.md when recording generated interfaces or tests.
        - Read arcbench-checkpoint/SKILL.md when creating a coherent git checkpoint.
        Run their scripts from the current project with --project-dir .; do not hand-write
        runner events or traceability JSON when a bundled script covers the action.
        """
    ).strip()
    return {"type": "preset", "preset": "claude_code", "append": append}


def _module_prompt(module: RequirementModule, requirements_dir: Path, completed_ids: list[str], skills_dir: Path) -> str:
    completed = ", ".join(completed_ids) if completed_ids else "none"
    return textwrap.dedent(
        f"""
        Implement ROOT module {module.index}/{module.total}: {module.node_id} - {module.name}

        Requirement source directory: {requirements_dir}
        Previously completed ROOT modules: {completed}
        Skills directory: {skills_dir}

        Implement this complete subtree in the current target directory:
        ```json
        {json.dumps(module.subtree, ensure_ascii=False, indent=2)}
        ```

        Finish by summarizing the files changed. Do not start a long-running server.
        """
    ).strip()


async def _wait_for_result(client: Any, ResultMessage: Any) -> None:
    async for message in client.receive_response():
        if not isinstance(message, ResultMessage):
            continue
        subtype = str(getattr(message, "subtype", "") or "").lower()
        if subtype and subtype not in {"success", "completed", "done"}:
            raise RuntimeError(f"Claude turn ended with subtype `{subtype}`")


async def implement_modules_async(
    requirements_dir: Path,
    output_dir: Path,
    modules: list[RequirementModule],
    skills_dir: Path,
) -> None:
    ClaudeAgentOptions, ClaudeSDKClient, ResultMessage = _require_claude_sdk()
    options_kwargs: dict[str, Any] = {
        "cwd": str(output_dir),
        "system_prompt": _system_prompt(skills_dir),
        "allowed_tools": ["Read", "Glob", "Grep", "Edit", "Write", "Bash"],
        "permission_mode": "acceptEdits",
        "max_turns": 60,
    }
    model = os.environ.get("MODEL", "").strip()
    if model:
        options_kwargs["model"] = model

    completed_ids: list[str] = []
    with claude_env_from_openai_env():
        async with ClaudeSDKClient(options=ClaudeAgentOptions(**options_kwargs)) as client:
            for module in modules:
                print(f"[claude] Implementing {module.index}/{module.total}: {module.node_id}", flush=True)
                await client.query(_module_prompt(module, requirements_dir, completed_ids, skills_dir))
                await _wait_for_result(client, ResultMessage)
                completed_ids.append(module.node_id)


def main() -> int:
    args = parse_args()
    requirements_dir = Path(args.requirement_path).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    if not requirements_dir.is_dir():
        raise FileNotFoundError(f"Requirement directory not found: {requirements_dir}")

    agent_root = Path(__file__).resolve().parent
    copy_template_contents(agent_root / "template", output_dir)
    skills_dir = copy_skills_to_output(agent_root / "skills", output_dir)
    asyncio.run(implement_modules_async(requirements_dir, output_dir, load_root_modules(requirements_dir), skills_dir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
