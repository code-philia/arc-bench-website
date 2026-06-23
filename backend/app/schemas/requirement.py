from pydantic import BaseModel


class RequirementSummary(BaseModel):
    id: str
    title: str
    category: str
    summary: str
    test_runner: str
    total_tests: int
    module_count: int


class RequirementDetail(RequirementSummary):
    requirements_markdown: str
    requirements_yaml: str | None = None
    prerequisites_markdown: str
    assets_base_url: str
    references_base_url: str


class CompetitionTaskDownloadLinks(BaseModel):
    requirement_document: str | None = None
    prerequisites_document: str | None = None
    tests_bundle: str | None = None
    demo_bundle: str | None = None
    full_bundle: str | None = None


class CompetitionTaskSummary(RequirementSummary):
    public_downloads: CompetitionTaskDownloadLinks | None = None


class CompetitionSummary(BaseModel):
    id: str
    title: str
    type: str
    summary: str
    task_count: int
    total_tests: int
    is_public: bool


class CompetitionDetail(CompetitionSummary):
    downloads: CompetitionTaskDownloadLinks | None = None
    tasks: list[CompetitionTaskSummary]
