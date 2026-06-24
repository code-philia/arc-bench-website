from datetime import datetime

from pydantic import BaseModel, Field


class SubmissionVisualEvent(BaseModel):
    type: str
    node_id: str
    phase: str
    status: str
    timestamp: str
    message: str | None = None


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
    visual_events: list[SubmissionVisualEvent] = Field(default_factory=list)


class SubmissionTraceabilityInterface(BaseModel):
    interface_id: str
    req_ids: list[str] = Field(default_factory=list)
    type: str
    content: str
    file_path: str
    first_line: int | None = None
    implemented: bool
    callers: list[str] = Field(default_factory=list)
    callees: list[str] = Field(default_factory=list)


class SubmissionTraceabilityTest(BaseModel):
    test_id: str
    req_id: str
    scenario_id: str | None = None
    type: str
    file_path: str
    first_line: int | None = None


class SubmissionTraceabilityPayload(BaseModel):
    interfaces: list[SubmissionTraceabilityInterface] = Field(default_factory=list)
    tests: list[SubmissionTraceabilityTest] = Field(default_factory=list)


class SubmissionSourcePayload(BaseModel):
    kind: str
    file_path: str
    language: str
    content: str
    first_line: int
