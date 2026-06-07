from datetime import datetime

from pydantic import BaseModel, Field


class StepState(BaseModel):
    key: str
    title: str
    status: str
    description: str
    logs: list[str] = Field(default_factory=list)


class SubmissionSummary(BaseModel):
    id: str
    display_name: str | None
    model_name: str | None
    requirement_id: str
    runtime: str
    original_filename: str
    status: str
    score: float | None
    passed_count: int
    failed_count: int
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    failure_reason: str | None


class SubmissionDetail(SubmissionSummary):
    steps: list[StepState]
    stdout_path: str | None
    stderr_path: str | None
    result_path: str | None
    workspace_path: str | None
    logs_available: bool
    tests: list[dict]


class SubmissionCreateResponse(BaseModel):
    submission: SubmissionSummary


class SubmissionLogs(BaseModel):
    events: str
    stdout: str
    stderr: str
