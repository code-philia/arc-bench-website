import json
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Any

import yaml

from app.models.requirement import Requirement


class TraceabilitySeedBuilder:
    def build_from_yaml_text(self, yaml_text: str, *, fallback_description: str = "Updated requirement tree") -> dict[str, list[dict[str, Any]]]:
        parsed = yaml.safe_load(yaml_text) or {}
        if not isinstance(parsed, dict):
            raise ValueError("requirements.yaml must contain a root mapping")

        requirements: list[dict[str, Any]] = []
        scenarios: list[dict[str, Any]] = []
        self._walk_node(parsed, parent_id=None, requirements=requirements, scenarios=scenarios)
        if not requirements:
            return {
                "roles": [],
                "requirements": [
                    {
                        "req_id": "ROOT",
                        "name": "ROOT",
                        "description": fallback_description,
                        "visual_reference": [],
                        "parent_id": None,
                        "dependencies": [],
                        "children_ids": [],
                        "scenarios": [],
                    }
                ],
                "scenarios": [],
            }
        return {"roles": self._normalize_roles(parsed.get("roles")), "requirements": requirements, "scenarios": scenarios}

    def build_for_requirement(self, requirement: Requirement, requirement_yaml_path: Path | None = None) -> dict[str, list[dict[str, Any]]]:
        yaml_path = requirement_yaml_path or Path(requirement.requirements_path).with_name("requirements.yaml")
        if not yaml_path.exists():
            return self._build_fallback_seed(requirement)

        parsed = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
        if not isinstance(parsed, dict):
            raise ValueError(f"requirements.yaml must contain a root mapping: {yaml_path}")

        requirements: list[dict[str, Any]] = []
        scenarios: list[dict[str, Any]] = []
        self._walk_node(parsed, parent_id=None, requirements=requirements, scenarios=scenarios)
        if not requirements:
            return self._build_fallback_seed(requirement)
        return {
            "roles": self._normalize_roles(parsed.get("roles")),
            "requirements": requirements,
            "scenarios": scenarios,
        }

    def write_seed_file(self, output_path: Path, requirement: Requirement, requirement_yaml_path: Path | None = None) -> None:
        seed = self.build_for_requirement(requirement, requirement_yaml_path=requirement_yaml_path)
        self._write_json_atomic(output_path, seed)

    def write_seed_file_from_yaml_text(self, output_path: Path, yaml_text: str) -> None:
        seed = self.build_from_yaml_text(yaml_text)
        self._write_json_atomic(output_path, seed)

    def _build_fallback_seed(self, requirement: Requirement) -> dict[str, list[dict[str, Any]]]:
        return {
            "roles": [],
            "requirements": [
                {
                    "req_id": "ROOT",
                    "name": requirement.title or "ROOT",
                    "description": requirement.summary or requirement.title,
                    "visual_reference": [],
                    "parent_id": None,
                    "dependencies": [],
                    "children_ids": [],
                    "scenarios": [],
                }
            ],
            "scenarios": [],
        }

    def _walk_node(
        self,
        node: dict[str, Any],
        parent_id: str | None,
        requirements: list[dict[str, Any]],
        scenarios: list[dict[str, Any]],
    ) -> None:
        req_id = str(node.get("id", "")).strip()
        if not req_id:
            raise ValueError("Each requirement node in requirements.yaml must define a non-empty id")

        raw_scenarios = node.get("scenarios")
        normalized_scenarios: list[dict[str, Any]] = []
        if isinstance(raw_scenarios, list):
            for index, scenario in enumerate(raw_scenarios, start=1):
                if not isinstance(scenario, dict):
                    continue
                scenario_id = str(scenario.get("id") or f"{req_id}-SCN-{index}").strip()
                if not scenario_id:
                    scenario_id = f"{req_id}-SCN-{index}"
                normalized_scenarios.append(
                    {
                        "id": scenario_id,
                        "name": self._as_text(scenario.get("name")) or f"Scenario {index}",
                        "actor": self._as_optional_text(scenario.get("actor")),
                        "steps": self._normalize_steps(scenario.get("steps")),
                    }
                )

        requirements.append(
            {
                "req_id": req_id,
                "name": self._as_text(node.get("name")) or req_id,
                "description": self._as_text(node.get("description")),
                "visual_reference": self._extract_visual_references(node),
                "permissions": self._normalize_permissions(node.get("permissions")),
                "scenarios": normalized_scenarios,
                "parent_id": parent_id,
                "children_ids": self._collect_child_ids(node.get("children")),
                "dependencies": self._as_string_list(node.get("dependencies")),
            }
        )
        for scenario in normalized_scenarios:
            scenarios.append(
                {
                    "scenario_id": str(scenario["id"]),
                    "name": str(scenario["name"]),
                    "req_id": req_id,
                    "actor": scenario["actor"],
                    "steps": scenario["steps"],
                }
            )

        raw_children = node.get("children")
        if isinstance(raw_children, list):
            for child in raw_children:
                if isinstance(child, dict):
                    self._walk_node(child, parent_id=req_id, requirements=requirements, scenarios=scenarios)

    @staticmethod
    def _as_text(value: Any) -> str:
        return str(value or "").strip()

    @staticmethod
    def _as_optional_text(value: Any) -> str | None:
        text = str(value or "").strip()
        return text or None

    @staticmethod
    def _as_string_list(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]

    def _extract_visual_references(self, node: dict[str, Any]) -> list[str]:
        """Merge legacy visual references and enhanced image declarations."""
        paths = self._as_string_list(node.get("visual_reference"))
        images = node.get("images")
        if isinstance(images, list):
            for image in images:
                path = self._as_text(image.get("path")) if isinstance(image, dict) else self._as_text(image)
                if path:
                    paths.append(path)
        description = self._as_text(node.get("description"))
        paths.extend(re.findall(r"!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)", description))
        return list(dict.fromkeys(path for path in paths if path))

    @staticmethod
    def _normalize_permissions(value: Any) -> str | list[str]:
        if isinstance(value, str):
            return value.strip() or []
        return TraceabilitySeedBuilder._as_string_list(value)

    def _normalize_roles(self, value: Any) -> list[dict[str, str]]:
        if not isinstance(value, list):
            return []
        roles: list[dict[str, str]] = []
        for role in value:
            if not isinstance(role, dict):
                continue
            role_id = self._as_text(role.get("id"))
            if not role_id:
                continue
            roles.append({"id": role_id, "name": self._as_text(role.get("name")) or role_id})
        return roles

    def _normalize_steps(self, value: Any) -> list[dict[str, str | None]]:
        if not isinstance(value, list):
            return []

        steps: list[dict[str, str]] = []
        for step in value:
            if not isinstance(step, dict):
                continue
            keyword = str(step.get("keyword") or "GIVEN").strip().upper() or "GIVEN"
            content = str(step.get("content") or "").strip()
            if not content:
                continue
            steps.append(
                {
                    "keyword": keyword,
                    "content": content,
                    "actor": self._as_optional_text(step.get("actor")),
                }
            )
        return steps

    @staticmethod
    def _collect_child_ids(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        child_ids: list[str] = []
        for child in value:
            if not isinstance(child, dict):
                continue
            child_id = str(child.get("id") or "").strip()
            if child_id:
                child_ids.append(child_id)
        return child_ids

    @staticmethod
    def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        last_error: OSError | None = None
        for delay in (0.0, 0.05, 0.1, 0.2, 0.5, 1.0):
            if delay > 0:
                time.sleep(delay)
            fd, tmp_name = tempfile.mkstemp(
                dir=str(path.parent),
                prefix=f"{path.name}.",
                suffix=".tmp",
                text=True,
            )
            tmp_path = Path(tmp_name)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as output:
                    output.write(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
                os.replace(tmp_path, path)
                return
            except OSError as exc:
                last_error = exc
            finally:
                try:
                    tmp_path.unlink(missing_ok=True)
                except OSError:
                    pass
        if last_error is not None:
            raise last_error
