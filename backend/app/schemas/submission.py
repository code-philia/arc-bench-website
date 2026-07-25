from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class SubmissionVisualEvent(BaseModel):
    type: str
    node_id: str
    phase: str
    status: str
    timestamp: str
    message: str | None = None


class SubmissionRunnerEvent(BaseModel):
    type: str
    state: str
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
    agent_source: str
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
    node_states: dict[str, str] = Field(default_factory=dict)
    can_pause: bool = False
    can_resume: bool = False
    can_rewind: bool = False
    can_manual_edit: bool = False
    manual_edit_node_id: str | None = None
    manual_edit_phase: str | None = None
    manual_edit_dirty: bool = False
    pause_available: bool = False


class SubmissionEditableTaskPayload(BaseModel):
    requirements_md: str
    requirements_yaml: str
    prerequisites_md: str
    edited_node_id: str | None = None


class SubmissionRewindPayload(BaseModel):
    commit_oid: str = Field(min_length=7, max_length=64)


class SubmissionPreviewStatus(BaseModel):
    available: bool
    stale: bool = False
    preview_url: str | None = None
    workspace_head_oid: str | None = None
    preview_head_oid: str | None = None
    error: str | None = None


class SubmissionCreateResponse(BaseModel):
    submission: SubmissionSummary


class SubmissionManualEditCommitPreview(BaseModel):
    message: str
    node_id: str | None = None
    phase: str | None = None
    dirty: bool = False
    dirty_files: list[str] = Field(default_factory=list)


class SubmissionLogs(BaseModel):
    events: str
    stdout: str
    stderr: str
    visual_events: list[SubmissionVisualEvent] = Field(default_factory=list)
    runner_events: list[SubmissionRunnerEvent] = Field(default_factory=list)
    runner_event_lines: list[str] = Field(default_factory=list)


class SubmissionTraceabilityInterface(BaseModel):
    interface_id: str
    req_ids: list[str] = Field(default_factory=list)
    type: str
    content: str
    file_path: str
    first_line: str | None = None
    implemented: bool
    callers: list[str] = Field(default_factory=list)
    callees: list[str] = Field(default_factory=list)


class SubmissionTraceabilityTest(BaseModel):
    test_id: str
    req_id: str
    scenario_id: str | None = None
    type: str
    file_path: str
    first_line: str | None = None
    status: str | None = None


class SubmissionTraceabilityPayload(BaseModel):
    interfaces: list[SubmissionTraceabilityInterface] = Field(default_factory=list)
    tests: list[SubmissionTraceabilityTest] = Field(default_factory=list)


class SubmissionCommitChangedFile(BaseModel):
    file_path: str
    change_type: str
    old_file_path: str | None = None


class SubmissionCommitHistoryEntry(BaseModel):
    oid: str
    short_oid: str
    committed_at: str
    message: str
    node_id: str | None = None
    phase: str | None = None
    summary: str | None = None
    changed_files: list[SubmissionCommitChangedFile] = Field(default_factory=list)


class SubmissionCommitHistoryPayload(BaseModel):
    availability: str = "available"
    commits: list[SubmissionCommitHistoryEntry] = Field(default_factory=list)


class SubmissionSourcePayload(BaseModel):
    kind: str
    file_path: str
    language: str
    content: str
    first_line: int


class WorkspaceFileEntry(BaseModel):
    path: str
    name: str
    is_directory: bool
    children: Optional[List['WorkspaceFileEntry']] = None


WorkspaceFileEntry.model_rebuild()


class WorkspaceFileListPayload(BaseModel):
    files: List[WorkspaceFileEntry]


class FileUpdatePayload(BaseModel):
    path: str
    content: str


class TestCreatePayload(BaseModel):
    test_id: str
    req_id: str
    test_type: str  # "Unit" | "Integration" | "E2E"
    scenario_id: Optional[str] = None
    file_path: Optional[str] = None


class TestCreateResponse(BaseModel):
    test_id: str
    req_id: str
    test_type: str
    file_path: str


class TestType:
    UNIT = "Unit"
    INTEGRATION = "Integration"
    E2E = "E2E"
