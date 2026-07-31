"""Convert one requirement-tree YAML file into a sibling Markdown document.

The rendered structure follows ``arc-bench-playground/webapp/requirements/__demo__``:
the root becomes the document title, requirement nodes become nested headings, and
their descriptions, dependencies, and scenarios are rendered as readable Markdown.

Usage:
    python scripts/render_competition_requirements.py path/to/requirements.yaml

For example, ``competition/Demo/tasks/github/requirements.yaml`` produces
``competition/Demo/tasks/github/requirements.md``.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import yaml


def normalise_text(value: Any) -> str:
    """Return a stripped, display-safe string for optional YAML values."""
    return str(value or "").strip()


def string_list(value: Any) -> list[str]:
    """Return only non-empty values from an optional YAML list."""
    if not isinstance(value, list):
        return []
    return [item for raw in value if (item := normalise_text(raw))]


def render_node(node: dict[str, Any], depth: int) -> list[str]:
    """Render one requirement node and all of its children."""
    node_id = normalise_text(node.get("id")) or "UNNAMED"
    name = normalise_text(node.get("name")) or node_id
    node_type = normalise_text(node.get("type")) or "ATOMIC"
    lines = [f"{'#' * min(depth, 6)} {node_id} {name}", ""]

    if description := normalise_text(node.get("description")):
        lines.extend([description, ""])

    dependencies = string_list(node.get("dependencies"))
    lines.extend([
        f"**Type:** {node_type}",
        f"**Dependencies:** {', '.join(dependencies) if dependencies else 'None'}",
        "",
    ])

    scenarios = node.get("scenarios")
    if isinstance(scenarios, list) and scenarios:
        rendered_scenarios: list[str] = []
        for scenario in scenarios:
            if not isinstance(scenario, dict):
                continue
            scenario_name = normalise_text(scenario.get("name")) or "Unnamed scenario"
            rendered_scenarios.append(f"- {scenario_name}")
            steps = scenario.get("steps")
            if not isinstance(steps, list):
                continue
            for step in steps:
                if not isinstance(step, dict):
                    continue
                keyword = normalise_text(step.get("keyword")) or "STEP"
                content = normalise_text(step.get("content"))
                rendered_scenarios.append(f"  - **{keyword}:** {content}")
        if rendered_scenarios:
            lines.extend(["**Scenarios:**", "", *rendered_scenarios, ""])

    children = node.get("children")
    if isinstance(children, list):
        for child in children:
            if isinstance(child, dict):
                lines.extend(render_node(child, depth + 1))
    return lines


def render_requirement(tree: dict[str, Any]) -> str:
    """Render the root tree into Markdown suitable for ``requirements.md``."""
    title = normalise_text(tree.get("name")) or normalise_text(tree.get("id")) or "Untitled requirement"
    lines = [f"# {title}", ""]

    if description := normalise_text(tree.get("description")):
        lines.extend([description, ""])

    children = tree.get("children")
    if isinstance(children, list) and children:
        for child in children:
            if isinstance(child, dict):
                lines.extend(render_node(child, depth=2))
    else:
        # A single-node file still deserves the node metadata and scenarios.
        lines.extend(render_node(tree, depth=2)[2:])

    return "\n".join(lines).rstrip() + "\n"


def output_path_for(yaml_path: Path) -> Path:
    """Return the required sibling Markdown path for a YAML input path."""
    return yaml_path.with_suffix(".md")


def convert_file(yaml_path: Path) -> Path:
    """Convert one YAML file and return the generated Markdown path."""
    if not yaml_path.is_file():
        raise FileNotFoundError(f"YAML file not found: {yaml_path}")
    if yaml_path.suffix.lower() not in {".yaml", ".yml"}:
        raise ValueError(f"Expected a .yaml or .yml file: {yaml_path}")

    try:
        parsed = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as error:
        raise ValueError(f"Invalid YAML in {yaml_path}: {error}") from error

    if not isinstance(parsed, dict):
        raise ValueError(f"Requirement YAML must contain a top-level mapping: {yaml_path}")

    markdown_path = output_path_for(yaml_path)
    markdown_path.write_text(render_requirement(parsed), encoding="utf-8")
    return markdown_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert one requirement YAML file into a sibling Markdown document.")
    parser.add_argument("yaml_file", type=Path, help="Path to the input .yaml or .yml file")
    args = parser.parse_args()

    markdown_path = convert_file(args.yaml_file)
    print(f"Rendered {markdown_path}")


if __name__ == "__main__":
    main()
