from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.requirement import Requirement
from app.schemas.requirement import RequirementDetail, RequirementSummary


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
            if not requirements_path.exists() or not prerequisites_path.exists() or not tests_path.exists():
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
        rows = self.db.scalars(select(Requirement).order_by(Requirement.id)).all()
        return [RequirementSummary.model_validate(row, from_attributes=True) for row in rows]

    def get_requirement_detail(self, requirement_id: str, base_url: str) -> RequirementDetail:
        requirement = self._get_requirement(requirement_id)
        requirements_markdown = Path(requirement.requirements_path).read_text(encoding="utf-8")
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
            prerequisites_markdown=prerequisites_markdown,
            assets_base_url=f"{base_url}/api/requirements/{requirement.id}/assets",
            references_base_url=f"{base_url}/api/requirements/{requirement.id}/references",
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

    def _get_requirement(self, requirement_id: str) -> Requirement:
        requirement = self.db.get(Requirement, requirement_id)
        if not requirement:
            raise LookupError(f"Requirement '{requirement_id}' not found")
        return requirement

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
