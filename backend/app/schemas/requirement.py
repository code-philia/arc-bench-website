from pydantic import BaseModel, Field


class RequirementSummary(BaseModel):
    id: str
    display_id: str
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
    assets_base_url: str
    references_base_url: str


class RequirementTestFile(BaseModel):
    path: str
    content: str


class RequirementTests(BaseModel):
    files: list[RequirementTestFile] = Field(default_factory=list)
    public_downloads: CompetitionTaskDownloadLinks | None = None


class CompetitionSummary(BaseModel):
    id: str
    title: str
    type: str
    summary: str
    task_count: int
    total_tests: int
    is_public: bool
    starts_at: str | None = None
    ends_at: str | None = None
    status: str = "upcoming"
    notice: str = "Tasks will be published here."


class CompetitionLeaderboardEntry(BaseModel):
    username: str
    model_name: str | None = None
    track: str
    avg_pass_rate: float
    total_token_millions: float | None = None
    avg_runtime_seconds: int | None = None
    submission_count: int


class CompetitionTaskRunScore(BaseModel):
    task_id: str
    task_title: str
    run_id: str | None = None
    status: str | None = None
    test_pass_rate: float | None = None
    feature_implementation_rate: float | None = None
    run_duration_seconds: int | None = None
    token_cost_usd: float | None = None
    completed_at: str | None = None


class CompetitionSubmissionHistoryEntry(BaseModel):
    id: str
    display_name: str | None = None
    model_name: str | None = None
    original_filename: str
    runtime: str
    created_at: str
    task_scores: list[CompetitionTaskRunScore] = Field(default_factory=list)
    average_test_pass_rate: float = 0.0
    average_feature_implementation_rate: float = 0.0
    total_run_duration_seconds: int = 0
    token_cost_usd: float | None = None
    is_selected_score: bool = False


class CompetitionDetail(CompetitionSummary):
    downloads: CompetitionTaskDownloadLinks | None = None
    tasks: list[CompetitionTaskSummary]
    flow: list[str] = Field(default_factory=list)
    rules: list[str] = Field(default_factory=list)


class BenchmarkDownloadLinks(BaseModel):
    track_bundle: str | None = None
    task_bundle: str | None = None


class BenchmarkSummary(BaseModel):
    id: str
    title: str
    type: str
    summary: str
    task_count: int
    total_tests: int
    downloads: BenchmarkDownloadLinks | None = None


class BenchmarkTaskSummary(RequirementSummary):
    downloads: BenchmarkDownloadLinks | None = None


class BenchmarkDetail(BenchmarkSummary):
    tasks: list[BenchmarkTaskSummary]
