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
    prerequisites_markdown: str
    assets_base_url: str
    references_base_url: str
