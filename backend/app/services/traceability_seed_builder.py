import json
import os
import sqlite3
import tempfile
from pathlib import Path
from typing import Any

import yaml

from app.models.requirement import Requirement
from app.services.traceability_db_schema import ensure_traceability_schema


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
        self._write_json_atomic(output_path, seed)

    def write_seed_file_from_yaml_text(self, output_path: Path, yaml_text: str) -> None:
        seed = self.build_from_yaml_text(yaml_text)
        self._write_json_atomic(output_path, seed)

    def write_snapshot_file_from_yaml_text(self, output_path: Path, yaml_text: str) -> None:
        seed = self.build_from_yaml_text(yaml_text)
        snapshot = self._build_snapshot_from_seed(seed)
        self._write_json_atomic(output_path, snapshot)

    def write_sqlite_database_from_yaml_text(self, output_path: Path, yaml_text: str) -> None:
        seed = self.build_from_yaml_text(yaml_text)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(output_path)
        try:
            cursor = connection.cursor()
            ensure_traceability_schema(connection)
            cursor.execute("DELETE FROM node_contracts")
            cursor.execute("DELETE FROM scenarios")
            cursor.execute("DELETE FROM node_states")
            cursor.execute("DELETE FROM call_edges")
            cursor.execute("DELETE FROM tests")
            cursor.execute("DELETE FROM interfaces")
            cursor.execute("DELETE FROM requirements")
            cursor.executemany(
                """
                INSERT OR REPLACE INTO requirements (
                    req_id, name, description, visual_reference, scenarios, parent_id, children_ids, dependencies
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        str(item.get("req_id", "")).strip(),
                        str(item.get("name", "")).strip(),
                        str(item.get("description", "")).strip(),
                        json.dumps(item.get("visual_reference", []), ensure_ascii=False),
                        json.dumps(item.get("scenarios", []), ensure_ascii=False),
                        item.get("parent_id"),
                        json.dumps(item.get("children_ids", []), ensure_ascii=False),
                        json.dumps(item.get("dependencies", []), ensure_ascii=False),
                    )
                    for item in seed["requirements"]
                ],
            )
            cursor.executemany(
                """
                INSERT OR REPLACE INTO scenarios (
                    scenario_id, name, req_id, steps
                )
                VALUES (?, ?, ?, ?)
                """,
                [
                    (
                        str(item.get("scenario_id", "")).strip(),
                        str(item.get("name", "")).strip(),
                        str(item.get("req_id", "")).strip(),
                        json.dumps(item.get("steps", []), ensure_ascii=False),
                    )
                    for item in seed["scenarios"]
                    if str(item.get("scenario_id", "")).strip() and str(item.get("req_id", "")).strip()
                ],
            )
            connection.commit()
        finally:
            connection.close()

    def write_snapshot_file_from_database(self, output_path: Path, db_path: Path) -> None:
        connection = sqlite3.connect(f"{db_path.resolve().as_uri()}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        try:
            snapshot = self._build_snapshot_from_connection(connection)
        finally:
            connection.close()
        self._write_json_atomic(output_path, snapshot)

    def _build_fallback_seed(self, requirement: Requirement) -> dict[str, list[dict[str, Any]]]:
        return {
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
                        "steps": self._normalize_steps(scenario.get("steps")),
                    }
                )

        requirements.append(
            {
                "req_id": req_id,
                "name": self._as_text(node.get("name")) or req_id,
                "description": self._as_text(node.get("description")),
                "visual_reference": self._as_string_list(node.get("visual_reference")),
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

    def _build_snapshot_from_seed(self, seed: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
        requirements = [dict(item) for item in seed.get("requirements", []) if isinstance(item, dict)]
        scenarios = [
            {
                "scenario_id": str(item.get("scenario_id", "")).strip(),
                "name": str(item.get("name", "")).strip(),
                "req_id": str(item.get("req_id", "")).strip(),
                "steps": item.get("steps") if isinstance(item.get("steps"), list) else [],
            }
            for item in seed.get("scenarios", [])
            if isinstance(item, dict)
        ]
        return {
            "requirements": requirements,
            "scenarios": scenarios,
            "interfaces": [],
            "tests": [],
            "call_edges": [],
            "node_states": [],
            "node_contracts": [],
        }

    def _build_snapshot_from_connection(self, connection: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
        requirements_rows = connection.execute("SELECT * FROM requirements ORDER BY req_id").fetchall()
        requirements = [
            {
                "req_id": str(row["req_id"] or "").strip(),
                "name": str(row["name"] or "").strip(),
                "description": str(row["description"] or "").strip(),
                "visual_reference": self._parse_json_list(row["visual_reference"]),
                "scenarios": self._parse_json_list(row["scenarios"]),
                "parent_id": self._as_optional_text(row["parent_id"]),
                "children_ids": self._parse_json_list(row["children_ids"]),
                "dependencies": self._parse_json_list(row["dependencies"]),
            }
            for row in requirements_rows
        ]

        scenarios: list[dict[str, Any]] = []
        if self._table_exists(connection, "scenarios"):
            scenarios = [
                {
                    "scenario_id": str(row["scenario_id"] or "").strip(),
                    "name": str(row["name"] or "").strip(),
                    "req_id": str(row["req_id"] or "").strip(),
                    "steps": self._parse_json_list(row["steps"]),
                }
                for row in connection.execute("SELECT * FROM scenarios ORDER BY scenario_id").fetchall()
            ]
        if not scenarios:
            for requirement in requirements:
                req_id = str(requirement.get("req_id") or "").strip()
                for scenario in requirement.get("scenarios", []):
                    if not isinstance(scenario, dict):
                        continue
                    scenario_id = str(scenario.get("id") or scenario.get("scenario_id") or "").strip()
                    if not scenario_id or not req_id:
                        continue
                    scenarios.append(
                        {
                            "scenario_id": scenario_id,
                            "name": str(scenario.get("name") or "").strip(),
                            "req_id": req_id,
                            "steps": scenario.get("steps") if isinstance(scenario.get("steps"), list) else [],
                        }
                    )

        interfaces = []
        if self._table_exists(connection, "interfaces"):
            interfaces = [
                {
                    "interface_id": str(row["interface_id"] or "").strip(),
                    "req_ids": self._parse_json_list(row["req_ids"]),
                    "type": str(row["type"] or "").strip(),
                    "content": str(row["content"] or "").strip(),
                    "file_path": self._as_optional_text(row["file_path"]),
                    "first_line": self._as_optional_text(row["first_line"]),
                    "implemented": bool(row["implemented"]),
                    "callers": self._parse_json_list(row["callers"]),
                    "callees": self._parse_json_list(row["callees"]),
                }
                for row in connection.execute("SELECT * FROM interfaces ORDER BY interface_id").fetchall()
            ]

        tests = []
        if self._table_exists(connection, "tests"):
            tests = [
                {
                    "test_id": str(row["test_id"] or "").strip(),
                    "req_id": str(row["req_id"] or "").strip(),
                    "interface_ids": self._parse_json_list(row["interface_ids"]),
                    "type": str(row["type"] or "").strip(),
                    "file_path": self._as_optional_text(row["file_path"]),
                    "passed": self._parse_bool(row["passed"]),
                    "first_line": self._as_optional_text(row["first_line"]),
                }
                for row in connection.execute("SELECT * FROM tests ORDER BY test_id").fetchall()
            ]

        call_edges = []
        if self._table_exists(connection, "call_edges"):
            call_edges = [dict(row) for row in connection.execute(
                "SELECT * FROM call_edges ORDER BY source_req_id, target_req_id, from_interface_id, to_interface_id"
            ).fetchall()]

        node_states = []
        if self._table_exists(connection, "node_states"):
            node_states = [dict(row) for row in connection.execute("SELECT * FROM node_states ORDER BY req_id").fetchall()]

        node_contracts = []
        if self._table_exists(connection, "node_contracts"):
            for row in connection.execute("SELECT * FROM node_contracts ORDER BY req_id").fetchall():
                try:
                    content = json.loads(str(row["content"] or "").strip()) if str(row["content"] or "").strip() else {}
                except json.JSONDecodeError:
                    content = {}
                node_contracts.append(
                    {
                        "req_id": str(row["req_id"] or "").strip(),
                        "content": content,
                        "updated_at": self._as_optional_text(row["updated_at"]),
                    }
                )

        return {
            "requirements": requirements,
            "scenarios": scenarios,
            "interfaces": interfaces,
            "tests": tests,
            "call_edges": call_edges,
            "node_states": node_states,
            "node_contracts": node_contracts,
        }

    @staticmethod
    def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
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
        finally:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass

    @staticmethod
    def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
        row = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
            (table_name,),
        ).fetchone()
        return row is not None

    @staticmethod
    def _parse_json_list(value: Any) -> list[Any]:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        try:
            parsed = json.loads(str(value))
        except (TypeError, ValueError, json.JSONDecodeError):
            return []
        return parsed if isinstance(parsed, list) else []

    @staticmethod
    def _parse_bool(value: Any) -> bool | None:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        if normalized in {"1", "true"}:
            return True
        if normalized in {"0", "false"}:
            return False
        return None
