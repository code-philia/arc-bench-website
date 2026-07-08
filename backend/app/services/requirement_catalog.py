from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session
import yaml

from app.core.config import get_settings
from app.models.requirement import Requirement
from app.schemas.requirement import (
    CompetitionDetail,
    CompetitionSummary,
    CompetitionTaskDownloadLinks,
    CompetitionTaskSummary,
    RequirementDetail,
    RequirementSummary,
)


@dataclass
class CatalogRequirementEntry:
    id: str
    title: str
    category: str
    summary: str
    test_runner: str
    total_tests: int
    module_count: int
    requirements_path: Path
    prerequisites_path: Path
    tests_path: Path
    assets_path: Path
    references_path: Path
    templates_root: Path


class RequirementCatalogService:
    def __init__(
        self,
        db: Session,
        *,
        catalog_name: str,
        requirements_root: Path,
        tests_root: Path,
        templates_root: Path,
    ):
        self.db = db
        self.settings = get_settings()
        self.catalog_name = catalog_name
        self.requirements_root = requirements_root
        self.tests_root = tests_root
        self.templates_root = templates_root

    @classmethod
    def for_catalog(cls, db: Session, catalog: str) -> "RequirementCatalogService":
        settings = get_settings()
        if catalog == "competition":
            return cls(
                db,
                catalog_name="competition",
                requirements_root=settings.requirements_root,
                tests_root=settings.tests_root,
                templates_root=settings.templates_root,
            )
        if catalog == "playground":
            return cls(
                db,
                catalog_name="playground",
                requirements_root=settings.playground_requirements_root,
                tests_root=settings.playground_tests_root,
                templates_root=settings.playground_templates_root,
            )
        raise ValueError(f"Unknown catalog '{catalog}'")

    def scan_entries(self) -> list[CatalogRequirementEntry]:
        rows: list[CatalogRequirementEntry] = []
        for category, requirements_root, tests_root, templates_root in self._iter_catalog_sources():
            if not requirements_root.exists():
                continue

            for requirement_dir in sorted(requirements_root.iterdir()):
                if not requirement_dir.is_dir():
                    continue

                requirement_id = requirement_dir.name
                requirements_path = requirement_dir / "requirements.md"
                prerequisites_path = requirement_dir / "prerequisites.md"
                tests_path = tests_root / requirement_id
                assets_path = requirement_dir / "assets"
                references_path = requirement_dir / "reference"

                if not requirements_path.exists():
                    continue

                requirements_md = requirements_path.read_text(encoding="utf-8")
                requirement_yaml_path = self._resolve_requirement_yaml_path(requirements_path)
                leaf_requirement_count = self._count_leaf_requirements(requirement_yaml_path)
                rows.append(
                    CatalogRequirementEntry(
                        id=requirement_id,
                        title=self._extract_title(requirements_md, fallback=requirement_id),
                        category=category,
                        summary=self._extract_summary(requirements_md),
                        test_runner=self._test_runner_for_category(category),
                        total_tests=self._estimate_total_tests(category, tests_path, leaf_requirement_count),
                        module_count=leaf_requirement_count,
                        requirements_path=requirements_path,
                        prerequisites_path=prerequisites_path,
                        tests_path=tests_path,
                        assets_path=assets_path,
                        references_path=references_path,
                        templates_root=templates_root,
                    )
                )

        return rows

    def _iter_catalog_sources(self) -> list[tuple[str, Path, Path, Path]]:
        if self.catalog_name != "competition":
            return [("web", self.requirements_root, self.tests_root, self.templates_root)]

        competition_root = self.requirements_root.parent.parent
        if not competition_root.exists():
            return []

        sources: list[tuple[str, Path, Path, Path]] = []
        for app_root in sorted(competition_root.iterdir()):
            if not app_root.is_dir() or not app_root.name.endswith("app"):
                continue
            sources.append(
                (
                    self._normalize_competition_category(app_root.name),
                    app_root / "requirements",
                    app_root / "tests",
                    app_root / "template",
                )
            )
        return sources

    @staticmethod
    def _normalize_competition_category(app_dir_name: str) -> str:
        if app_dir_name == "webapp":
            return "web"
        if app_dir_name == "mobileapp":
            return "mobile"
        if app_dir_name.endswith("app"):
            return app_dir_name[:-3]
        return app_dir_name

    def sync_to_db(self, requirement_id: str | None = None) -> None:
        for entry in self.scan_entries():
            if requirement_id and entry.id != requirement_id:
                continue

            existing = self.db.get(Requirement, entry.id)
            data = {
                "title": entry.title,
                "category": entry.category,
                "summary": entry.summary,
                "test_runner": entry.test_runner,
                "requirements_path": str(entry.requirements_path),
                "prerequisites_path": str(entry.prerequisites_path),
                "tests_path": str(entry.tests_path),
                "assets_path": str(entry.assets_path),
                "references_path": str(entry.references_path),
                "total_tests": entry.total_tests,
                "module_count": entry.module_count,
            }
            if existing:
                for key, value in data.items():
                    setattr(existing, key, value)
            else:
                self.db.add(Requirement(id=entry.id, **data))

        self.db.commit()

    def list_requirements(self) -> list[RequirementSummary]:
        rows = self.scan_entries()
        display_ids = self._build_display_id_map(rows)
        return [self._to_requirement_summary(row, display_ids.get(row.id, row.id)) for row in rows]

    def get_requirement_detail(self, requirement_id: str, base_url: str) -> RequirementDetail:
        rows = self.scan_entries()
        display_ids = self._build_display_id_map(rows)
        requirement = self.get_entry(requirement_id, rows)
        requirements_markdown = requirement.requirements_path.read_text(encoding="utf-8")
        requirements_yaml = self._read_requirement_yaml(requirement.requirements_path)
        prerequisites_markdown = self._read_text_if_exists(requirement.prerequisites_path)

        return RequirementDetail(
            id=requirement.id,
            display_id=display_ids.get(requirement.id, requirement.id),
            title=requirement.title,
            category=requirement.category,
            summary=requirement.summary,
            test_runner=requirement.test_runner,
            total_tests=requirement.total_tests,
            module_count=requirement.module_count,
            requirements_markdown=requirements_markdown,
            requirements_yaml=requirements_yaml,
            prerequisites_markdown=prerequisites_markdown,
            assets_base_url=f"{base_url}/api/requirements/{requirement.id}/assets?catalog={self.catalog_name}",
            references_base_url=f"{base_url}/api/requirements/{requirement.id}/references?catalog={self.catalog_name}",
        )

    def list_competitions(self) -> list[CompetitionSummary]:
        rows = self.scan_entries()
        grouped: dict[str, list[CatalogRequirementEntry]] = {}
        for row in rows:
            grouped.setdefault(row.category, []).append(row)

        competitions: list[CompetitionSummary] = []
        for category, items in sorted(grouped.items(), key=lambda item: self._competition_sort_key(item[0])):
            competitions.append(
                CompetitionSummary(
                    id=category,
                    title=self._competition_title(category),
                    type=category,
                    summary=self._competition_summary(category, len(items)),
                    task_count=len(items),
                    total_tests=sum(item.total_tests for item in items),
                    is_public=False,
                )
            )

        return competitions

    def get_competition_detail(self, competition_id: str, base_url: str) -> CompetitionDetail:
        rows = self.scan_entries()
        display_ids = self._build_display_id_map(rows)
        competition_tasks = [row for row in rows if row.category == competition_id]
        if not competition_tasks:
            raise LookupError(f"Competition '{competition_id}' not found")

        tasks = [
            self._to_competition_task(row, base_url, is_public=False, display_id=display_ids.get(row.id, row.id))
            for row in competition_tasks
        ]
        return CompetitionDetail(
            id=competition_id,
            title=self._competition_title(competition_id),
            type=competition_id,
            summary=self._competition_summary(competition_id, len(tasks)),
            task_count=len(tasks),
            total_tests=sum(task.total_tests for task in tasks),
            is_public=False,
            downloads=None,
            tasks=tasks,
        )

    def get_document(self, requirement_id: str, kind: str) -> str:
        requirement = self.get_entry(requirement_id)
        path = requirement.requirements_path if kind == "requirements" else requirement.prerequisites_path
        return self._read_text_if_exists(path)

    def get_asset_path(self, requirement_id: str, asset_kind: str, relative_path: str) -> Path:
        requirement = self.get_entry(requirement_id)
        base_dir = requirement.assets_path if asset_kind == "assets" else requirement.references_path
        if not base_dir.exists():
            raise FileNotFoundError(relative_path)
        target = (base_dir / relative_path).resolve()
        if not str(target).startswith(str(base_dir.resolve())) or not target.exists():
            raise FileNotFoundError(relative_path)
        return target

    def build_public_task_bundle(self, requirement_id: str) -> tuple[bytes, str]:
        requirement = self.get_entry(requirement_id)
        archive_name = f"arcbench-public-{requirement_id}.zip"
        entries = [
            (requirement.requirements_path, f"{requirement.id}/requirements.md"),
            (requirement.prerequisites_path, f"{requirement.id}/prerequisites.md"),
            (requirement.tests_path, f"{requirement.id}/tests"),
            (requirement.assets_path, f"{requirement.id}/demo/assets"),
            (requirement.references_path, f"{requirement.id}/demo/reference"),
        ]
        requirement_yaml_path = self._resolve_requirement_yaml_path(requirement.requirements_path)
        if requirement_yaml_path.exists():
            entries.append((requirement_yaml_path, f"{requirement.id}/requirements.yaml"))
        return self._build_zip(entries, archive_name)

    def build_public_task_document(self, requirement_id: str, kind: str) -> tuple[bytes, str]:
        requirement = self.get_entry(requirement_id)
        source = requirement.requirements_path if kind == "requirements" else requirement.prerequisites_path
        return self._read_bytes_if_exists(source), source.name

    def build_public_task_tests_bundle(self, requirement_id: str) -> tuple[bytes, str]:
        requirement = self.get_entry(requirement_id)
        archive_name = f"arcbench-public-{requirement_id}-tests.zip"
        return self._build_zip([(requirement.tests_path, f"{requirement.id}/tests")], archive_name)

    def build_public_task_demo_bundle(self, requirement_id: str) -> tuple[bytes, str]:
        requirement = self.get_entry(requirement_id)
        archive_name = f"arcbench-public-{requirement_id}-demo.zip"
        return self._build_zip(
            [
                (requirement.assets_path, f"{requirement.id}/assets"),
                (requirement.references_path, f"{requirement.id}/reference"),
            ],
            archive_name,
        )

    def build_public_competition_bundle(self) -> tuple[bytes, str]:
        rows = self.scan_entries()
        entries: list[tuple[Path, str]] = []
        for requirement in rows:
            entries.extend(
                [
                    (requirement.requirements_path, f"public/{requirement.id}/requirements.md"),
                    (requirement.prerequisites_path, f"public/{requirement.id}/prerequisites.md"),
                    (requirement.tests_path, f"public/{requirement.id}/tests"),
                    (requirement.assets_path, f"public/{requirement.id}/demo/assets"),
                    (requirement.references_path, f"public/{requirement.id}/demo/reference"),
                ]
            )
            requirement_yaml_path = self._resolve_requirement_yaml_path(requirement.requirements_path)
            if requirement_yaml_path.exists():
                entries.append((requirement_yaml_path, f"public/{requirement.id}/requirements.yaml"))
        return self._build_zip(entries, "arcbench-public-competition.zip")

    def get_entry(self, requirement_id: str, rows: list[CatalogRequirementEntry] | None = None) -> CatalogRequirementEntry:
        entries = rows if rows is not None else self.scan_entries()
        for entry in entries:
            if entry.id == requirement_id:
                return entry
        raise LookupError(f"Requirement '{requirement_id}' not found")

    def _build_zip(self, entries: list[tuple[Path, str]], archive_name: str) -> tuple[bytes, str]:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for source, target in entries:
                if not source.exists():
                    continue
                if source.is_dir():
                    for path in sorted(source.rglob("*")):
                        if path.is_file():
                            archive.write(path, arcname=f"{target}/{path.relative_to(source).as_posix()}")
                else:
                    archive.write(source, arcname=target)
        return buffer.getvalue(), archive_name

    def _to_requirement_summary(self, row: CatalogRequirementEntry, display_id: str) -> RequirementSummary:
        return RequirementSummary(
            id=row.id,
            display_id=display_id,
            title=row.title,
            category=row.category,
            summary=row.summary,
            test_runner=row.test_runner,
            total_tests=row.total_tests,
            module_count=row.module_count,
        )

    def _to_competition_task(
        self,
        row: CatalogRequirementEntry,
        base_url: str,
        is_public: bool,
        display_id: str,
    ) -> CompetitionTaskSummary:
        downloads = None
        if is_public:
            downloads = CompetitionTaskDownloadLinks(
                requirement_document=f"{base_url}/api/competitions/public/tasks/{row.id}/download/requirements",
                prerequisites_document=f"{base_url}/api/competitions/public/tasks/{row.id}/download/prerequisites",
                tests_bundle=f"{base_url}/api/competitions/public/tasks/{row.id}/download/tests",
                demo_bundle=f"{base_url}/api/competitions/public/tasks/{row.id}/download/demo",
                full_bundle=f"{base_url}/api/competitions/public/tasks/{row.id}/download/full",
            )
        return CompetitionTaskSummary(
            id=row.id,
            display_id=display_id,
            title=row.title,
            category=row.category,
            summary=row.summary,
            test_runner=row.test_runner,
            total_tests=row.total_tests,
            module_count=row.module_count,
            public_downloads=downloads,
        )

    @staticmethod
    def _build_display_id_map(rows: list[CatalogRequirementEntry]) -> dict[str, str]:
        grouped: dict[str, list[CatalogRequirementEntry]] = {}
        for row in rows:
            grouped.setdefault(row.category, []).append(row)

        display_ids: dict[str, str] = {}
        for _, items in sorted(grouped.items(), key=lambda item: RequirementCatalogService._competition_sort_key(item[0])):
            for index, row in enumerate(items, start=1):
                display_ids[row.id] = f"TASK-{index:03d}"
        return display_ids

    @staticmethod
    def _competition_sort_key(category: str) -> tuple[int, str]:
        priority = {
            "web": 0,
            "mobile": 1,
        }
        return (priority.get(category, 99), category)

    @staticmethod
    def _test_runner_for_category(category: str) -> str:
        if category == "mobile":
            return "android-uiautomator"
        return "playwright"

    @staticmethod
    def _estimate_total_tests(category: str, tests_path: Path, leaf_requirement_count: int) -> int:
        if category == "mobile" and tests_path.exists():
            return len([path for path in tests_path.glob("*.json") if path.is_file()])
        return leaf_requirement_count * 3

    @staticmethod
    def _resolve_requirement_yaml_path(requirements_path: Path) -> Path:
        return requirements_path.with_name("requirements.yaml")

    def _read_requirement_yaml(self, requirements_path: Path) -> str | None:
        yaml_path = self._resolve_requirement_yaml_path(requirements_path)
        if not yaml_path.exists():
            return None
        return yaml_path.read_text(encoding="utf-8")

    def _count_leaf_requirements(self, yaml_path: Path) -> int:
        if not yaml_path.exists():
            return 0
        parsed = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
        if not isinstance(parsed, dict):
            return 0
        return self._count_leaf_nodes(parsed)

    def _count_leaf_nodes(self, node: dict[str, Any]) -> int:
        children = node.get("children")
        if not isinstance(children, list) or len(children) == 0:
            return 1
        valid_children = [child for child in children if isinstance(child, dict)]
        if len(valid_children) == 0:
            return 1
        return sum(self._count_leaf_nodes(child) for child in valid_children)

    @staticmethod
    def _read_text_if_exists(path: Path) -> str:
        if not path.exists():
            return ""
        return path.read_text(encoding="utf-8")

    @staticmethod
    def _read_bytes_if_exists(path: Path) -> bytes:
        if not path.exists():
            return b""
        return path.read_bytes()

    @staticmethod
    def _competition_title(category: str) -> str:
        if category == "web":
            return "Web Competition"
        if category == "mobile":
            return "Mobile Competition"
        return f"{category.title()} Competition"

    @staticmethod
    def _competition_summary(category: str, task_count: int) -> str:
        if category == "web":
            return f"Browser-based product tasks with Playwright evaluation across {task_count} benchmark tasks."
        if category == "mobile":
            return f"Mobile application tasks across {task_count} benchmark tasks."
        return f"{task_count} benchmark tasks in the {category} track."

    @staticmethod
    def _extract_title(markdown: str, fallback: str) -> str:
        for line in markdown.splitlines():
            stripped = line.strip()
            if stripped:
                return stripped[2:].strip() if stripped.startswith("#") else stripped
        return fallback

    @staticmethod
    def _extract_summary(markdown: str) -> str:
        non_empty_lines = [line.strip() for line in markdown.splitlines() if line.strip()]
        if len(non_empty_lines) >= 2:
            return non_empty_lines[1]
        return ""
