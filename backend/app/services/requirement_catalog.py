from __future__ import annotations

import io
import zipfile
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

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


class RequirementCatalogService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    def sync(self) -> None:
        for requirement_dir in sorted(self.settings.requirements_root.iterdir()):
            if not requirement_dir.is_dir():
                continue
            requirement_id = requirement_dir.name
            requirements_path = requirement_dir / "requirements.md"
            prerequisites_path = requirement_dir / "prerequisites.md"
            tests_path = self.settings.tests_root / requirement_id
            assets_path = requirement_dir / "assets"
            references_path = requirement_dir / "reference"
            if not requirements_path.exists() or not prerequisites_path.exists() or not tests_path.exists() or not self.settings.templates_root.exists():
                continue

            requirements_md = requirements_path.read_text(encoding="utf-8")
            title = self._extract_title(requirements_md, fallback=requirement_id)
            summary = self._extract_summary(requirements_md)
            total_tests = len(list(tests_path.glob("*.spec.ts")))
            module_count = sum(1 for line in requirements_md.splitlines() if line.startswith("## REQ-"))

            existing = self.db.get(Requirement, requirement_id)
            data = {
                "title": title,
                "category": "web",
                "summary": summary,
                "test_runner": "playwright",
                "requirements_path": str(requirements_path),
                "prerequisites_path": str(prerequisites_path),
                "tests_path": str(tests_path),
                "assets_path": str(assets_path),
                "references_path": str(references_path),
                "total_tests": total_tests,
                "module_count": module_count,
            }
            if existing:
                for key, value in data.items():
                    setattr(existing, key, value)
            else:
                self.db.add(Requirement(id=requirement_id, **data))

        self.db.commit()

    def list_requirements(self) -> list[RequirementSummary]:
        rows = self._list_requirement_rows()
        return [RequirementSummary.model_validate(row, from_attributes=True) for row in rows]

    def get_requirement_detail(self, requirement_id: str, base_url: str) -> RequirementDetail:
        requirement = self._get_requirement(requirement_id)
        requirements_path = Path(requirement.requirements_path)
        requirements_markdown = requirements_path.read_text(encoding="utf-8")
        requirements_yaml = self._read_requirement_yaml(requirements_path)
        prerequisites_markdown = Path(requirement.prerequisites_path).read_text(encoding="utf-8")
        return RequirementDetail(
            id=requirement.id,
            title=requirement.title,
            category=requirement.category,
            summary=requirement.summary,
            test_runner=requirement.test_runner,
            total_tests=requirement.total_tests,
            module_count=requirement.module_count,
            requirements_markdown=requirements_markdown,
            requirements_yaml=requirements_yaml,
            prerequisites_markdown=prerequisites_markdown,
            assets_base_url=f"{base_url}/api/requirements/{requirement.id}/assets",
            references_base_url=f"{base_url}/api/requirements/{requirement.id}/references",
        )

    def list_competitions(self) -> list[CompetitionSummary]:
        rows = self._list_requirement_rows()
        grouped: dict[str, list[Requirement]] = {}
        for row in rows:
            grouped.setdefault(row.category, []).append(row)

        competitions: list[CompetitionSummary] = []
        for category, items in sorted(grouped.items()):
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
        rows = self._list_requirement_rows()
        competition_tasks = [row for row in rows if row.category == competition_id]
        if not competition_tasks:
            raise LookupError(f"Competition '{competition_id}' not found")

        tasks = [self._to_competition_task(row, base_url, is_public=False) for row in competition_tasks]
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
        requirement = self._get_requirement(requirement_id)
        path = Path(requirement.requirements_path if kind == "requirements" else requirement.prerequisites_path)
        return path.read_text(encoding="utf-8")

    def get_asset_path(self, requirement_id: str, asset_kind: str, relative_path: str) -> Path:
        requirement = self._get_requirement(requirement_id)
        base_dir = Path(requirement.assets_path if asset_kind == "assets" else requirement.references_path)
        target = (base_dir / relative_path).resolve()
        if not str(target).startswith(str(base_dir.resolve())) or not target.exists():
            raise FileNotFoundError(relative_path)
        return target

    def build_public_task_bundle(self, requirement_id: str) -> tuple[bytes, str]:
        requirement = self._get_requirement(requirement_id)
        archive_name = f"arcbench-public-{requirement_id}.zip"
        entries = [
            (Path(requirement.requirements_path), f"{requirement.id}/requirements.md"),
            (Path(requirement.prerequisites_path), f"{requirement.id}/prerequisites.md"),
            (Path(requirement.tests_path), f"{requirement.id}/tests"),
            (Path(requirement.assets_path), f"{requirement.id}/demo/assets"),
            (Path(requirement.references_path), f"{requirement.id}/demo/reference"),
        ]
        requirement_yaml_path = self._resolve_requirement_yaml_path(Path(requirement.requirements_path))
        if requirement_yaml_path.exists():
            entries.append((requirement_yaml_path, f"{requirement.id}/requirements.yaml"))
        return self._build_zip(entries, archive_name)

    def build_public_task_document(self, requirement_id: str, kind: str) -> tuple[bytes, str]:
        requirement = self._get_requirement(requirement_id)
        source = Path(requirement.requirements_path if kind == "requirements" else requirement.prerequisites_path)
        return source.read_bytes(), source.name

    def build_public_task_tests_bundle(self, requirement_id: str) -> tuple[bytes, str]:
        requirement = self._get_requirement(requirement_id)
        archive_name = f"arcbench-public-{requirement_id}-tests.zip"
        return self._build_zip([(Path(requirement.tests_path), f"{requirement.id}/tests")], archive_name)

    def build_public_task_demo_bundle(self, requirement_id: str) -> tuple[bytes, str]:
        requirement = self._get_requirement(requirement_id)
        archive_name = f"arcbench-public-{requirement_id}-demo.zip"
        return self._build_zip(
            [
                (Path(requirement.assets_path), f"{requirement.id}/assets"),
                (Path(requirement.references_path), f"{requirement.id}/reference"),
            ],
            archive_name,
        )

    def build_public_competition_bundle(self) -> tuple[bytes, str]:
        rows = self._list_requirement_rows()
        entries: list[tuple[Path, str]] = []
        for requirement in rows:
            entries.extend(
                [
                    (Path(requirement.requirements_path), f"public/{requirement.id}/requirements.md"),
                    (Path(requirement.prerequisites_path), f"public/{requirement.id}/prerequisites.md"),
                    (Path(requirement.tests_path), f"public/{requirement.id}/tests"),
                    (Path(requirement.assets_path), f"public/{requirement.id}/demo/assets"),
                    (Path(requirement.references_path), f"public/{requirement.id}/demo/reference"),
                ]
            )
            requirement_yaml_path = self._resolve_requirement_yaml_path(Path(requirement.requirements_path))
            if requirement_yaml_path.exists():
                entries.append((requirement_yaml_path, f"public/{requirement.id}/requirements.yaml"))
        return self._build_zip(entries, "arcbench-public-competition.zip")

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

    def _list_requirement_rows(self) -> list[Requirement]:
        return self.db.scalars(select(Requirement).order_by(Requirement.category, Requirement.id)).all()

    def _to_competition_task(self, row: Requirement, base_url: str, is_public: bool) -> CompetitionTaskSummary:
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
            title=row.title,
            category=row.category,
            summary=row.summary,
            test_runner=row.test_runner,
            total_tests=row.total_tests,
            module_count=row.module_count,
            public_downloads=downloads,
        )

    def _get_requirement(self, requirement_id: str) -> Requirement:
        requirement = self.db.get(Requirement, requirement_id)
        if not requirement:
            raise LookupError(f"Requirement '{requirement_id}' not found")
        return requirement

    @staticmethod
    def _resolve_requirement_yaml_path(requirements_path: Path) -> Path:
        return requirements_path.with_name("requirements.yaml")

    def _read_requirement_yaml(self, requirements_path: Path) -> str | None:
        yaml_path = self._resolve_requirement_yaml_path(requirements_path)
        if not yaml_path.exists():
            return None
        return yaml_path.read_text(encoding="utf-8")

    @staticmethod
    def _competition_title(category: str) -> str:
        if category == "web":
            return "Web Competition"
        if category == "android":
            return "Android Competition"
        return f"{category.title()} Competition"

    @staticmethod
    def _competition_summary(category: str, task_count: int) -> str:
        if category == "web":
            return f"Browser-based product tasks with Playwright evaluation across {task_count} benchmark tasks."
        if category == "android":
            return f"Android application tasks across {task_count} benchmark tasks."
        return f"{task_count} benchmark tasks in the {category} track."

    @staticmethod
    def _extract_title(markdown: str, fallback: str) -> str:
        for line in markdown.splitlines():
            if line.startswith("# "):
                return line[2:].strip()
        return fallback

    @staticmethod
    def _extract_summary(markdown: str) -> str:
        lines = [line.strip() for line in markdown.splitlines()]
        for line in lines:
            if line and not line.startswith("#"):
                return line
        return ""
