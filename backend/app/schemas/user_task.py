from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


TaskType = Literal["web", "mobile", "kernel", "mixed"]


class UserTaskCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    task_type: TaskType
    summary: str = Field(default="", max_length=4000)
    root_requirement_id: str = Field(default="ROOT", min_length=1, max_length=64)
    node_count: int = Field(default=1, ge=1, le=1000)
    atomic_count: int = Field(default=0, ge=0, le=1000)
    yaml_content: str = Field(min_length=1, max_length=500000)
    markdown_content: str = Field(min_length=1, max_length=500000)
    draft_id: str | None = Field(default=None, min_length=1, max_length=128)


class UserTaskSummary(BaseModel):
    id: str
    title: str
    task_type: TaskType
    summary: str
    root_requirement_id: str
    node_count: int
    atomic_count: int
    created_at: datetime
    updated_at: datetime


class UserTaskDetail(UserTaskSummary):
    yaml_content: str
    markdown_content: str


class UserTaskDraftSaveRequest(BaseModel):
    title: str = Field(default="My Custom Task", max_length=255)
    task_type: TaskType = "web"
    yaml_content: str = Field(default="", max_length=500000)
    markdown_content: str = Field(default="", max_length=500000)


class UserTaskDraftResponse(BaseModel):
    draft_id: str
    references_base_url: str
    title: str = "My Custom Task"
    task_type: TaskType = "web"
    yaml_content: str = ""
    markdown_content: str = ""
