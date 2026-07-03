from __future__ import annotations

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.app_db_schema import migrate_app_database  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate an ArcBench SQLite app database to the current schema.")
    parser.add_argument(
        "db_path",
        nargs="?",
        default=str(ROOT_DIR / "app.db"),
        help="Path to the SQLite database file. Defaults to the project root app.db.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip creating a timestamped backup next to the database before migrating.",
    )
    return parser.parse_args()


def create_backup(db_path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = db_path.with_suffix(f"{db_path.suffix}.bak.{timestamp}")
    shutil.copy2(db_path, backup_path)
    return backup_path


def main() -> int:
    args = parse_args()
    db_path = Path(args.db_path).expanduser().resolve()

    if not db_path.exists():
        print(f"Database file not found: {db_path}", file=sys.stderr)
        return 1

    if not args.no_backup:
        backup_path = create_backup(db_path)
        print(f"Backup created: {backup_path}")

    actions = migrate_app_database(db_path)
    if actions:
        print(f"Migration complete: {db_path}")
        for action in actions:
            print(f"- {action}")
    else:
        print(f"No schema changes needed: {db_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
