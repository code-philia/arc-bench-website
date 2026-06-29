from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from typing import Any


REQUIREMENTS_COLUMNS: dict[str, str] = {
    "name": "TEXT",
    "scenarios": "TEXT",
    "children_ids": "TEXT",
}

TESTS_COLUMNS: dict[str, str] = {
    "interface_ids": "TEXT",
    "passed": "INTEGER",
}


def ensure_traceability_schema(connection: sqlite3.Connection) -> None:
    cursor = connection.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS requirements (
            req_id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            visual_reference TEXT,
            scenarios TEXT,
            parent_id TEXT,
            children_ids TEXT,
            dependencies TEXT
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
            req_id TEXT,
            interface_ids TEXT,
            type TEXT,
            file_path TEXT,
            passed INTEGER,
            first_line TEXT
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS call_edges (
            source_req_id TEXT,
            target_req_id TEXT,
            from_interface_id TEXT,
            to_interface_id TEXT,
            edge_type TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (source_req_id, target_req_id, from_interface_id, to_interface_id)
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS node_states (
            req_id TEXT PRIMARY KEY,
            state TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    _ensure_columns(cursor, "requirements", REQUIREMENTS_COLUMNS)
    _ensure_columns(cursor, "tests", TESTS_COLUMNS)
    _backfill_legacy_requirements(cursor)
    connection.commit()


def _ensure_columns(cursor: sqlite3.Cursor, table_name: str, columns: dict[str, str]) -> None:
    existing = _get_column_names(cursor, table_name)
    for column_name, column_type in columns.items():
        if column_name in existing:
            continue
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")


def _get_column_names(cursor: sqlite3.Cursor, table_name: str) -> set[str]:
    cursor.execute(f"PRAGMA table_info({table_name})")
    return {str(row[1]) for row in cursor.fetchall() if len(row) > 1}


def _table_exists(cursor: sqlite3.Cursor, table_name: str) -> bool:
    cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        (table_name,),
    )
    return cursor.fetchone() is not None


def _backfill_legacy_requirements(cursor: sqlite3.Cursor) -> None:
    if _table_exists(cursor, "scenarios"):
        scenario_rows = cursor.execute(
            "SELECT scenario_id, name, req_id, steps FROM scenarios ORDER BY scenario_id"
        ).fetchall()
        if scenario_rows:
            grouped_scenarios: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for scenario_id, name, req_id, steps in scenario_rows:
                req_key = str(req_id or "").strip()
                if not req_key:
                    continue
                grouped_scenarios[req_key].append(
                    {
                        "id": str(scenario_id or "").strip(),
                        "name": str(name or "").strip(),
                        "steps": _parse_json_list_like(steps),
                    }
                )
            for req_id, scenarios in grouped_scenarios.items():
                cursor.execute(
                    """
                    UPDATE requirements
                    SET scenarios = ?
                    WHERE req_id = ?
                      AND (scenarios IS NULL OR TRIM(scenarios) = '' OR TRIM(scenarios) = '[]')
                    """,
                    (json.dumps(scenarios, ensure_ascii=False), req_id),
                )

    requirement_rows = cursor.execute("SELECT req_id, parent_id, children_ids FROM requirements").fetchall()
    children_by_parent: dict[str, list[str]] = defaultdict(list)
    for req_id, parent_id, _children_ids in requirement_rows:
        child_id = str(req_id or "").strip()
        parent_key = str(parent_id or "").strip()
        if child_id and parent_key:
            children_by_parent[parent_key].append(child_id)
    for parent_id, child_ids in children_by_parent.items():
        cursor.execute(
            """
            UPDATE requirements
            SET children_ids = ?
            WHERE req_id = ?
              AND (children_ids IS NULL OR TRIM(children_ids) = '' OR TRIM(children_ids) = '[]')
            """,
            (json.dumps(child_ids, ensure_ascii=False), parent_id),
        )


def _parse_json_list_like(raw_value: Any) -> list[Any]:
    if raw_value is None:
        return []
    if isinstance(raw_value, list):
        return raw_value
    try:
        parsed = json.loads(str(raw_value))
    except (TypeError, ValueError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []
