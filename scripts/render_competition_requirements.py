"""Render competition task requirement trees into readable Markdown.

Usage:
    python scripts/render_competition_requirements.py
    python scripts/render_competition_requirements.py --competition Demo

The source of truth is ``competition/<competition>/tasks/<task>/requirements.yaml``.
The generated sibling ``requirements.md`` is used only for reading in the web UI.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import yaml


PROJECT_ROOT = Path(__file__).resolve().parents[1]
COMPETITION_ROOT = PROJECT_ROOT / "competition"


def text(value: Any) -> str:
    return str(value or "").strip()


def list_of_strings(value: Any) -> list[str]:
    return [text(item) for item in value] if isinstance(value, list) else []


def render_node(node: dict[str, Any], depth: int) -> list[str]:
    node_id = text(node.get("id")) or "UNNAMED"
    name = text(node.get("name")) or node_id
    node_type = text(node.get("type")) or "ATOMIC"
    lines = [f"{'#' * min(depth, 6)} {node_id} {name}", ""]
    description = text(node.get("description"))
    if description:
        lines.extend([description, ""])
    lines.extend([f"**Type:** {node_type}"])
    dependencies = list_of_strings(node.get("dependencies"))
    lines.extend([f"**Dependencies:** {', '.join(dependencies) if dependencies else 'None'}", ""])

    scenarios = node.get("scenarios")
    if isinstance(scenarios, list) and scenarios:
        lines.extend(["**Scenarios:**", ""])
        for scenario in scenarios:
            if not isinstance(scenario, dict):
                continue
            lines.append(f"- {text(scenario.get('name')) or 'Unnamed scenario'}")
            steps = scenario.get("steps")
            if isinstance(steps, list):
                for step in steps:
                    if isinstance(step, dict):
                        keyword = text(step.get("keyword")) or "STEP"
                        content = text(step.get("content"))
                        lines.append(f"  - **{keyword}:** {content}")
        lines.append("")

    children = node.get("children")
    if isinstance(children, list):
        for child in children:
            if isinstance(child, dict):
                lines.extend(render_node(child, depth + 1))
    return lines


def render_requirement(tree: dict[str, Any]) -> str:
    title = text(tree.get("name")) or text(tree.get("id")) or "Untitled requirement"
    lines = [f"# {title}", ""]
    description = text(tree.get("description"))
    if description:
        lines.extend([description, ""])
    children = tree.get("children")
    if isinstance(children, list) and children:
        for child in children:
            if isinstance(child, dict):
                lines.extend(render_node(child, 2))
    else:
        lines.extend(render_node(tree, 2)[2:])
    return "\n".join(lines).rstrip() + "\n"


def render_task(task_dir: Path) -> bool:
    yaml_path = task_dir / "requirements.yaml"
    if not yaml_path.is_file():
        return False
    parsed = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
    if not isinstance(parsed, dict):
        raise ValueError(f"requirements.yaml must contain a mapping: {yaml_path}")
    (task_dir / "requirements.md").write_text(render_requirement(parsed), encoding="utf-8")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate requirements.md files from competition requirements.yaml files.")
    parser.add_argument("--competition", help="Only render one competition directory, e.g. Demo")
    args = parser.parse_args()
    roots = [COMPETITION_ROOT / args.competition] if args.competition else sorted(path for path in COMPETITION_ROOT.iterdir() if path.is_dir())
    rendered = 0
    for competition_dir in roots:
        task_root = competition_dir / "tasks"
        if not task_root.is_dir():
            task_root = competition_dir / "requirements"
        if not task_root.is_dir():
            continue
        for task_dir in sorted(path for path in task_root.iterdir() if path.is_dir()):
            if render_task(task_dir):
                rendered += 1
                print(f"rendered {task_dir.relative_to(PROJECT_ROOT) / 'requirements.md'}")
    print(f"Rendered {rendered} requirement document(s).")


if __name__ == "__main__":
    main()
