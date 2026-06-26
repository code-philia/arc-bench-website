import json
import sqlite3
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
                "requirements": [
                    {
                        "req_id": "ROOT",
                        "description": fallback_description,
                        "visual_reference": None,
                        "status": "pending",
                        "parent_id": None,
                        "dependencies": [],
                    }
                ],
                "scenarios": [],
            }
        return {"requirements": requirements, "scenarios": scenarios}

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
            "requirements": requirements,
            "scenarios": scenarios,
        }

    def write_seed_file(self, output_path: Path, requirement: Requirement, requirement_yaml_path: Path | None = None) -> None:
        seed = self.build_for_requirement(requirement, requirement_yaml_path=requirement_yaml_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def write_seed_file_from_yaml_text(self, output_path: Path, yaml_text: str) -> None:
        seed = self.build_from_yaml_text(yaml_text)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def write_sqlite_database_from_yaml_text(self, output_path: Path, yaml_text: str) -> None:
        seed = self.build_from_yaml_text(yaml_text)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(output_path)
        try:
            cursor = connection.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS requirements (
                    req_id TEXT PRIMARY KEY,
                    description TEXT,
                    visual_reference TEXT,
                    status TEXT,
                    parent_id TEXT,
                    dependencies TEXT
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS scenarios (
                    scenario_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    req_id TEXT NOT NULL,
                    steps TEXT NOT NULL,
                    FOREIGN KEY(req_id) REFERENCES requirements(req_id)
                        ON DELETE CASCADE
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS interfaces (
                    interface_id TEXT PRIMARY KEY,
                    req_ids TEXT,
                    type TEXT,
                    content TEXT,
                    file_path TEXT,
                    first_line TEXT,
                    implemented INTEGER,
                    callers TEXT,
                    callees TEXT
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS tests (
                    test_id TEXT PRIMARY KEY,
                    req_id TEXT NOT NULL,
                    scenario_id TEXT,
                    type TEXT,
                    file_path TEXT,
                    first_line TEXT,
                    FOREIGN KEY(req_id) REFERENCES requirements(req_id)
                        ON DELETE CASCADE,
                    FOREIGN KEY(scenario_id) REFERENCES scenarios(scenario_id)
                        ON DELETE CASCADE
                )
                """
            )
            cursor.execute("DELETE FROM scenarios")
            cursor.execute("DELETE FROM requirements")
            cursor.executemany(
                """
                INSERT OR REPLACE INTO requirements (req_id, description, visual_reference, status, parent_id, dependencies)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        str(item.get("req_id", "")).strip(),
                        str(item.get("description", "")).strip(),
                        item.get("visual_reference"),
                        str(item.get("status", "pending")).strip() or "pending",
                        item.get("parent_id"),
                        json.dumps(item.get("dependencies", []), ensure_ascii=False),
                    )
                    for item in seed["requirements"]
                ],
            )
            cursor.executemany(
                """
                INSERT OR REPLACE INTO scenarios (scenario_id, name, req_id, steps)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (
                        str(item.get("scenario_id", "")).strip(),
                        str(item.get("name", "")).strip() or "Scenario",
                        str(item.get("req_id", "")).strip(),
                        json.dumps(item.get("steps", []), ensure_ascii=False),
                    )
                    for item in seed["scenarios"]
                ],
            )
            connection.commit()
        finally:
            connection.close()

    def _build_fallback_seed(self, requirement: Requirement) -> dict[str, list[dict[str, Any]]]:
        return {
            "requirements": [
                {
                    "req_id": "ROOT",
                    "description": requirement.summary or requirement.title,
                    "visual_reference": None,
                    "status": "pending",
                    "parent_id": None,
                    "dependencies": [],
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

        requirements.append(
            {
                "req_id": req_id,
                "description": self._as_text(node.get("description")),
                "visual_reference": self._as_optional_text(node.get("visual_reference")),
                "status": "pending",
                "parent_id": parent_id,
                "dependencies": self._as_string_list(node.get("dependencies")),
            }
        )

        raw_scenarios = node.get("scenarios")
        if isinstance(raw_scenarios, list):
            for index, scenario in enumerate(raw_scenarios, start=1):
                if not isinstance(scenario, dict):
                    continue
                scenario_id = str(scenario.get("id") or f"{req_id}-SCN-{index}").strip()
                if not scenario_id:
                    scenario_id = f"{req_id}-SCN-{index}"
                scenarios.append(
                    {
                        "scenario_id": scenario_id,
                        "name": self._as_text(scenario.get("name")) or f"Scenario {index}",
                        "req_id": req_id,
                        "steps": self._normalize_steps(scenario.get("steps")),
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

    def _normalize_steps(self, value: Any) -> list[dict[str, str]]:
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
                }
            )
        return steps
