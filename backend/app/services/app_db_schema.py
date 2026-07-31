from __future__ import annotations

import sqlite3
from pathlib import Path


TABLE_DEFINITIONS: dict[str, str] = {
    "requirements": """
        CREATE TABLE IF NOT EXISTS requirements (
            id VARCHAR(64) NOT NULL,
            title VARCHAR(255) NOT NULL,
            category VARCHAR(64) NOT NULL,
            summary TEXT NOT NULL,
            test_runner VARCHAR(64) NOT NULL,
            requirements_path VARCHAR(512) NOT NULL,
            prerequisites_path VARCHAR(512) NOT NULL,
            tests_path VARCHAR(512) NOT NULL,
            assets_path VARCHAR(512) NOT NULL,
            references_path VARCHAR(512) NOT NULL,
            total_tests INTEGER NOT NULL,
            module_count INTEGER NOT NULL,
            PRIMARY KEY (id)
        )
    """,
    "submissions": """
        CREATE TABLE IF NOT EXISTS submissions (
            id VARCHAR(64) NOT NULL,
            user_id VARCHAR(64),
            display_name VARCHAR(120),
            model_name VARCHAR(120),
            requirement_id VARCHAR(64) NOT NULL,
            runtime VARCHAR(32) NOT NULL,
            agent_source VARCHAR(64) NOT NULL DEFAULT 'upload',
            original_filename VARCHAR(255) NOT NULL,
            archive_path VARCHAR(512) NOT NULL,
            status VARCHAR(32) NOT NULL,
            score FLOAT,
            passed_count INTEGER NOT NULL,
            failed_count INTEGER NOT NULL,
            created_at DATETIME NOT NULL,
            started_at DATETIME,
            finished_at DATETIME,
            workspace_path VARCHAR(512),
            stdout_path VARCHAR(512),
            stderr_path VARCHAR(512),
            result_path VARCHAR(512),
            failure_reason TEXT,
            steps_json TEXT NOT NULL,
            PRIMARY KEY (id)
        )
    """,
    "user_tasks": """
        CREATE TABLE IF NOT EXISTS user_tasks (
            id VARCHAR(64) NOT NULL,
            owner_user_id VARCHAR(64) NOT NULL,
            title VARCHAR(255) NOT NULL,
            task_type VARCHAR(32) NOT NULL,
            summary TEXT NOT NULL,
            root_requirement_id VARCHAR(64) NOT NULL,
            node_count INTEGER NOT NULL,
            atomic_count INTEGER NOT NULL,
            yaml_path VARCHAR(512) NOT NULL,
            markdown_path VARCHAR(512) NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id)
        )
    """,
    "users": """
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) NOT NULL,
            email VARCHAR(255) NOT NULL,
            username VARCHAR(64) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            github_email VARCHAR(255),
            github_username VARCHAR(255),
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id)
        )
    """,
}

TABLE_COLUMNS: dict[str, dict[str, str]] = {
    "requirements": {
        "id": "VARCHAR(64) NOT NULL",
        "title": "VARCHAR(255) NOT NULL",
        "category": "VARCHAR(64) NOT NULL",
        "summary": "TEXT NOT NULL",
        "test_runner": "VARCHAR(64) NOT NULL",
        "requirements_path": "VARCHAR(512) NOT NULL",
        "prerequisites_path": "VARCHAR(512) NOT NULL",
        "tests_path": "VARCHAR(512) NOT NULL",
        "assets_path": "VARCHAR(512) NOT NULL",
        "references_path": "VARCHAR(512) NOT NULL",
        "total_tests": "INTEGER NOT NULL",
        "module_count": "INTEGER NOT NULL",
    },
    "submissions": {
        "id": "VARCHAR(64) NOT NULL",
        "user_id": "VARCHAR(64)",
        "display_name": "VARCHAR(120)",
        "model_name": "VARCHAR(120)",
        "requirement_id": "VARCHAR(64) NOT NULL",
        "runtime": "VARCHAR(32) NOT NULL",
        "agent_source": "VARCHAR(64) NOT NULL DEFAULT 'upload'",
        "original_filename": "VARCHAR(255) NOT NULL",
        "archive_path": "VARCHAR(512) NOT NULL",
        "status": "VARCHAR(32) NOT NULL",
        "score": "FLOAT",
        "passed_count": "INTEGER NOT NULL",
        "failed_count": "INTEGER NOT NULL",
        "created_at": "DATETIME NOT NULL",
        "started_at": "DATETIME",
        "finished_at": "DATETIME",
        "workspace_path": "VARCHAR(512)",
        "stdout_path": "VARCHAR(512)",
        "stderr_path": "VARCHAR(512)",
        "result_path": "VARCHAR(512)",
        "failure_reason": "TEXT",
        "steps_json": "TEXT NOT NULL",
    },
    "user_tasks": {
        "id": "VARCHAR(64) NOT NULL",
        "owner_user_id": "VARCHAR(64) NOT NULL",
        "title": "VARCHAR(255) NOT NULL",
        "task_type": "VARCHAR(32) NOT NULL",
        "summary": "TEXT NOT NULL",
        "root_requirement_id": "VARCHAR(64) NOT NULL",
        "node_count": "INTEGER NOT NULL",
        "atomic_count": "INTEGER NOT NULL",
        "yaml_path": "VARCHAR(512) NOT NULL",
        "markdown_path": "VARCHAR(512) NOT NULL",
        "created_at": "DATETIME NOT NULL",
        "updated_at": "DATETIME NOT NULL",
    },
    "users": {
        "id": "VARCHAR(64) NOT NULL",
        "email": "VARCHAR(255) NOT NULL",
        "username": "VARCHAR(64) NOT NULL",
        "password_hash": "VARCHAR(255) NOT NULL",
        "github_email": "VARCHAR(255)",
        "github_username": "VARCHAR(255)",
        "created_at": "DATETIME NOT NULL",
    },
}

INDEX_DEFINITIONS: dict[str, str] = {
    "ix_submissions_agent_source": "CREATE INDEX IF NOT EXISTS ix_submissions_agent_source ON submissions (agent_source)",
    "ix_submissions_display_name": "CREATE INDEX IF NOT EXISTS ix_submissions_display_name ON submissions (display_name)",
    "ix_submissions_model_name": "CREATE INDEX IF NOT EXISTS ix_submissions_model_name ON submissions (model_name)",
    "ix_submissions_requirement_id": "CREATE INDEX IF NOT EXISTS ix_submissions_requirement_id ON submissions (requirement_id)",
    "ix_submissions_status": "CREATE INDEX IF NOT EXISTS ix_submissions_status ON submissions (status)",
    "ix_submissions_user_id": "CREATE INDEX IF NOT EXISTS ix_submissions_user_id ON submissions (user_id)",
    "ix_user_tasks_owner_user_id": "CREATE INDEX IF NOT EXISTS ix_user_tasks_owner_user_id ON user_tasks (owner_user_id)",
    "ix_user_tasks_task_type": "CREATE INDEX IF NOT EXISTS ix_user_tasks_task_type ON user_tasks (task_type)",
    "ix_user_tasks_title": "CREATE INDEX IF NOT EXISTS ix_user_tasks_title ON user_tasks (title)",
    "ix_users_email": "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)",
    "ix_users_username": "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)",
}


def migrate_app_database(db_path: Path) -> list[str]:
    connection = sqlite3.connect(db_path)
    try:
        return ensure_app_schema(connection)
    finally:
        connection.close()


def ensure_app_schema(connection: sqlite3.Connection) -> list[str]:
    actions: list[str] = []
    cursor = connection.cursor()

    for table_name, ddl in TABLE_DEFINITIONS.items():
        if not _table_exists(cursor, table_name):
            cursor.execute(ddl)
            actions.append(f"created table {table_name}")

    for table_name, columns in TABLE_COLUMNS.items():
        actions.extend(_ensure_columns(cursor, table_name, columns))

    cursor.execute("UPDATE submissions SET agent_source = 'upload' WHERE agent_source IS NULL OR TRIM(agent_source) = ''")
    if cursor.rowcount > 0:
        actions.append(f"backfilled submissions.agent_source for {cursor.rowcount} row(s)")

    for index_name, ddl in INDEX_DEFINITIONS.items():
        if index_name in _get_index_names(cursor):
            continue
        cursor.execute(ddl)
        actions.append(f"created index {index_name}")

    connection.commit()
    return actions


def _ensure_columns(cursor: sqlite3.Cursor, table_name: str, columns: dict[str, str]) -> list[str]:
    existing = _get_column_names(cursor, table_name)
    actions: list[str] = []
    for column_name, column_type in columns.items():
        if column_name in existing:
            continue
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
        actions.append(f"added column {table_name}.{column_name}")
    return actions


def _get_column_names(cursor: sqlite3.Cursor, table_name: str) -> set[str]:
    cursor.execute(f"PRAGMA table_info({table_name})")
    return {str(row[1]) for row in cursor.fetchall() if len(row) > 1}


def _get_index_names(cursor: sqlite3.Cursor) -> set[str]:
    cursor.execute("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")
    return {str(row[0]) for row in cursor.fetchall() if row and row[0]}


def _table_exists(cursor: sqlite3.Cursor, table_name: str) -> bool:
    cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        (table_name,),
    )
    return cursor.fetchone() is not None
