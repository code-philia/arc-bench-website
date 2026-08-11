"""Idempotent schema upgrades for installations using an existing app.db."""

from __future__ import annotations

from sqlalchemy import Engine, inspect, text


SUBMISSION_COLUMNS: dict[str, str] = {
    "catalog": "VARCHAR(32) NOT NULL DEFAULT 'playground'",
    "competition_id": "VARCHAR(64)",
    # Legacy execution columns remain physically present on this table after
    # migration, but new code reads them only from the runs table.
    "competition_submission_id": "VARCHAR(64)",
    "test_pass_rate": "FLOAT",
    "run_duration_seconds": "INTEGER",
    "token_cost_usd": "FLOAT",
    "feature_implemented_count": "INTEGER NOT NULL DEFAULT 0",
    "feature_total_count": "INTEGER NOT NULL DEFAULT 0",
    "feature_implementation_rate": "FLOAT",
}

RUN_ADDITIVE_COLUMNS: dict[str, str] = {
    "submission_display_name": "VARCHAR(120)",
    "model_name": "VARCHAR(120)",
    "original_filename": "VARCHAR(255)",
    "catalog": "VARCHAR(32) NOT NULL DEFAULT 'playground'",
    "competition_id": "VARCHAR(64)",
}

RUN_COLUMNS = (
    "id, user_id, submission_id, submission_display_name, model_name, original_filename, catalog, competition_id, requirement_id, runtime, agent_source, agent_archive_path, status, "
    "score, test_pass_rate, passed_count, failed_count, run_duration_seconds, token_cost_usd, "
    "feature_implemented_count, feature_total_count, feature_implementation_rate, created_at, started_at, "
    "finished_at, workspace_path, stdout_path, stderr_path, result_path, failure_reason, steps_json"
)


def ensure_schema(engine: Engine) -> None:
    """Upgrade the local SQLite schema to separate agent snapshots and runs."""
    if engine.dialect.name != "sqlite":
        # This project currently deploys app.db. A server database needs a
        # proper Alembic migration instead of SQLite table reconstruction.
        return
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "submissions" not in table_names or "runs" not in table_names:
        return
    existing = {column["name"] for column in inspector.get_columns("submissions")}
    with engine.begin() as connection:
        for name, definition in SUBMISSION_COLUMNS.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE submissions ADD COLUMN {name} {definition}"))
        run_columns = {column["name"] for column in inspect(engine).get_columns("runs")}
        for name, definition in RUN_ADDITIVE_COLUMNS.items():
            if name not in run_columns:
                connection.execute(text(f"ALTER TABLE runs ADD COLUMN {name} {definition}"))
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS app_schema_migrations "
                "(name VARCHAR(120) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        notification_columns = _column_names(connection, "notifications")
        if notification_columns and "run_id" not in notification_columns:
            _rebuild_notifications_as_run_notifications(connection)

        submission_columns = _column_names(connection, "submissions")
        legacy_execution_columns = "status" in submission_columns
        split_migrated = _migration_applied(connection, "submission_run_split_v1")
        if legacy_execution_columns:
            # Re-running this operation is safe because copied Runs use
            # INSERT OR IGNORE and moved legacy run rows are deleted.
            _migrate_legacy_submissions(connection)
        if not split_migrated:
            connection.execute(text("INSERT INTO app_schema_migrations (name) VALUES ('submission_run_split_v1')"))

        # An additive ALTER cannot make old required run columns optional.
        # Rebuild the table after copying its run data, so new immutable
        # snapshots can be inserted without supplying execution fields.
        if legacy_execution_columns and not _migration_applied(connection, "submission_snapshot_table_v2"):
            _rebuild_submission_snapshot_table(connection)
            connection.execute(text("INSERT INTO app_schema_migrations (name) VALUES ('submission_snapshot_table_v2')"))

        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_submissions_catalog ON submissions (catalog)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_submissions_competition_id ON submissions (competition_id)"))


def _column_names(connection, table_name: str) -> set[str]:
    return {row[1] for row in connection.execute(text(f"PRAGMA table_info({table_name})"))}


def _migration_applied(connection, name: str) -> bool:
    return connection.execute(
        text("SELECT 1 FROM app_schema_migrations WHERE name = :name"),
        {"name": name},
    ).first() is not None


def _rebuild_notifications_as_run_notifications(connection) -> None:
    """Remove the old submissions foreign key while preserving messages."""
    connection.execute(text("DROP TABLE IF EXISTS notifications__run_new"))
    connection.execute(
        text(
            "CREATE TABLE notifications__run_new ("
            "id VARCHAR(32) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, run_id VARCHAR(64), "
            "kind VARCHAR(32) NOT NULL, title VARCHAR(160) NOT NULL, body TEXT NOT NULL, "
            "is_read BOOLEAN NOT NULL DEFAULT 0, created_at DATETIME NOT NULL)"
        )
    )
    connection.execute(
        text(
            "INSERT INTO notifications__run_new (id, user_id, run_id, kind, title, body, is_read, created_at) "
            "SELECT id, user_id, submission_id, kind, title, body, is_read, created_at FROM notifications"
        )
    )
    connection.execute(text("DROP TABLE notifications"))
    connection.execute(text("ALTER TABLE notifications__run_new RENAME TO notifications"))
    connection.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id)"))
    connection.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_run_id ON notifications (run_id)"))


def _rebuild_submission_snapshot_table(connection) -> None:
    """Replace the legacy mixed table with the lean immutable snapshot table."""
    connection.execute(text("DROP TABLE IF EXISTS submissions__snapshot_new"))
    connection.execute(
        text(
            "CREATE TABLE submissions__snapshot_new ("
            "id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64), display_name VARCHAR(120), model_name VARCHAR(120), "
            "catalog VARCHAR(32) NOT NULL DEFAULT 'playground', competition_id VARCHAR(64), requirement_id VARCHAR(64), "
            "runtime VARCHAR(32) NOT NULL, agent_source VARCHAR(64) NOT NULL DEFAULT 'upload', "
            "original_filename VARCHAR(255) NOT NULL, archive_path VARCHAR(512) NOT NULL, created_at DATETIME NOT NULL)"
        )
    )
    connection.execute(
        text(
            "INSERT INTO submissions__snapshot_new "
            "(id, user_id, display_name, model_name, catalog, competition_id, requirement_id, runtime, agent_source, "
            "original_filename, archive_path, created_at) "
            "SELECT id, user_id, display_name, model_name, COALESCE(catalog, 'playground'), competition_id, requirement_id, "
            "runtime, COALESCE(agent_source, 'upload'), original_filename, archive_path, created_at FROM submissions"
        )
    )
    connection.execute(text("DROP TABLE submissions"))
    connection.execute(text("ALTER TABLE submissions__snapshot_new RENAME TO submissions"))


def _migrate_legacy_submissions(connection) -> None:
    """Split pre-existing mixed records without deleting their runtime files."""
    columns = {row[1] for row in connection.execute(text("PRAGMA table_info(submissions)"))}
    if "status" not in columns:
        return
    rows = connection.execute(text("SELECT * FROM submissions")).mappings().all()
    for row in rows:
        requirement_id = str(row.get("requirement_id") or "")
        is_competition_snapshot = requirement_id.endswith("--__agent__")
        is_competition_run = bool(row.get("competition_submission_id")) or (
            "--" in requirement_id and not is_competition_snapshot
        )
        if is_competition_snapshot:
            competition_id = requirement_id.removesuffix("--__agent__")
            connection.execute(
                text("UPDATE submissions SET catalog = 'competition', competition_id = :competition_id WHERE id = :id"),
                {"competition_id": competition_id, "id": row["id"]},
            )
            continue

        if is_competition_run:
            submission_id = str(row.get("competition_submission_id") or "")
            if not submission_id:
                # Old competition runs created before parent IDs get a stable
                # legacy snapshot, preserving their ability to be inspected.
                submission_id = f"legacy-{row['id']}"
                _insert_legacy_snapshot(connection, row, submission_id, requirement_id)
            _insert_legacy_run(connection, row, submission_id)
            # This row is now represented by runs. Its directory is retained
            # because the Run continues to own that workspace and archive.
            connection.execute(text("DELETE FROM submissions WHERE id = :id"), {"id": row["id"]})
            continue

        # A former Playground submission becomes both a durable snapshot and
        # its original first execution.  Reusing the same ID is safe because
        # the entities now reside in distinct tables and preserves its files.
        connection.execute(
            text("UPDATE submissions SET catalog = 'playground', competition_id = NULL WHERE id = :id"),
            {"id": row["id"]},
        )
        _insert_legacy_run(connection, row, str(row["id"]))


def _insert_legacy_snapshot(connection, row, submission_id: str, requirement_id: str) -> None:
    """Insert a synthetic parent while old required run fields still exist."""
    available = _column_names(connection, "submissions")
    values = {
        "id": submission_id,
        "user_id": row.get("user_id"),
        "display_name": row.get("display_name"),
        "model_name": row.get("model_name"),
        "catalog": "competition",
        "competition_id": requirement_id.split("--", 1)[0],
        "requirement_id": f"{requirement_id.split('--', 1)[0]}--__agent__",
        "runtime": row.get("runtime"),
        "agent_source": row.get("agent_source") or "upload",
        "original_filename": row.get("original_filename"),
        "archive_path": row.get("archive_path"),
        "created_at": row.get("created_at"),
        # Values for the legacy mixed table's non-null execution fields.
        "status": "PENDING",
        "passed_count": 0,
        "failed_count": 0,
        "feature_implemented_count": 0,
        "feature_total_count": 0,
        "steps_json": "[]",
    }
    names = [name for name in values if name in available]
    columns = ", ".join(names)
    placeholders = ", ".join(f":{name}" for name in names)
    connection.execute(
        text(f"INSERT OR IGNORE INTO submissions ({columns}) VALUES ({placeholders})"),
        {name: values[name] for name in names},
    )


def _insert_legacy_run(connection, row, submission_id: str) -> None:
    connection.execute(
        text(
            f"INSERT OR IGNORE INTO runs ({RUN_COLUMNS}) VALUES "
            "(:id, :user_id, :submission_id, :submission_display_name, :model_name, :original_filename, :catalog, :competition_id, :requirement_id, :runtime, :agent_source, :agent_archive_path, :status, "
            ":score, :test_pass_rate, :passed_count, :failed_count, :run_duration_seconds, :token_cost_usd, "
            ":feature_implemented_count, :feature_total_count, :feature_implementation_rate, :created_at, :started_at, "
            ":finished_at, :workspace_path, :stdout_path, :stderr_path, :result_path, :failure_reason, :steps_json)"
        ),
        {
            "id": row["id"],
            "user_id": row.get("user_id"),
            "submission_id": submission_id,
            "submission_display_name": row.get("display_name"),
            "model_name": row.get("model_name"),
            "original_filename": row.get("original_filename"),
            "catalog": row.get("catalog") or ("competition" if "--" in str(row.get("requirement_id") or "") else "playground"),
            "competition_id": row.get("competition_id") or (
                str(row.get("requirement_id") or "").split("--", 1)[0]
                if "--" in str(row.get("requirement_id") or "") else None
            ),
            "requirement_id": row.get("requirement_id"),
            "runtime": row.get("runtime"),
            "agent_source": row.get("agent_source") or "upload",
            "agent_archive_path": row.get("archive_path"),
            "status": row.get("status") or "PENDING",
            "score": row.get("score"),
            "test_pass_rate": row.get("test_pass_rate") if row.get("test_pass_rate") is not None else row.get("score"),
            "passed_count": row.get("passed_count") or 0,
            "failed_count": row.get("failed_count") or 0,
            "run_duration_seconds": row.get("run_duration_seconds"),
            "token_cost_usd": row.get("token_cost_usd"),
            "feature_implemented_count": row.get("feature_implemented_count") or 0,
            "feature_total_count": row.get("feature_total_count") or 0,
            "feature_implementation_rate": row.get("feature_implementation_rate"),
            "created_at": row.get("created_at"),
            "started_at": row.get("started_at"),
            "finished_at": row.get("finished_at"),
            "workspace_path": row.get("workspace_path"),
            "stdout_path": row.get("stdout_path"),
            "stderr_path": row.get("stderr_path"),
            "result_path": row.get("result_path"),
            "failure_reason": row.get("failure_reason"),
            "steps_json": row.get("steps_json") or "[]",
        },
    )
