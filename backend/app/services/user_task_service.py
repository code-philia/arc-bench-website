from __future__ import annotations

import json
import re
import shutil
import zipfile
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.user import User
from app.models.user_task import UserTask
from app.schemas.user_task import (
    UserTaskCreateRequest,
    UserTaskDetail,
    UserTaskDraftResponse,
    UserTaskDraftSaveRequest,
    UserTaskSummary,
    UserTaskUpdateRequest,
)


class UserTaskService:
    ACTIVE_DRAFT_ID = "create-task-current"

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    def list_user_tasks(self, user: User) -> list[UserTaskSummary]:
        rows = self.db.scalars(
            select(UserTask).where(UserTask.owner_user_id == user.id).order_by(UserTask.updated_at.desc(), UserTask.created_at.desc())
        ).all()
        return [UserTaskSummary.model_validate(row, from_attributes=True) for row in rows]

    def get_user_task_detail(self, user: User, task_id: str) -> UserTaskDetail:
        task = self._get_owned_task(user, task_id)
        return UserTaskDetail(
            **UserTaskSummary.model_validate(task, from_attributes=True).model_dump(),
            yaml_content=Path(task.yaml_path).read_text(encoding="utf-8"),
            markdown_content=Path(task.markdown_path).read_text(encoding="utf-8"),
        )

    def create_draft(self, user: User) -> UserTaskDraftResponse:
        draft_id = self.ACTIVE_DRAFT_ID
        draft_dir = self._draft_dir(user, draft_id)
        (draft_dir / "reference").mkdir(parents=True, exist_ok=True)
        payload = self._read_draft_payload(draft_dir)
        return UserTaskDraftResponse(
            draft_id=draft_id,
            references_base_url=f"/api/my-tasks/drafts/{draft_id}/reference/",
            title=payload["title"],
            task_type=payload["task_type"],
            yaml_content=payload["yaml_content"],
            markdown_content=payload["markdown_content"],
        )

    def save_draft(self, user: User, draft_id: str, payload: UserTaskDraftSaveRequest) -> UserTaskDraftResponse:
        draft_dir = self._draft_dir(user, draft_id)
        draft_dir.mkdir(parents=True, exist_ok=True)
        (draft_dir / "reference").mkdir(parents=True, exist_ok=True)
        (draft_dir / "requirements.yaml").write_text(payload.yaml_content.strip() + "\n", encoding="utf-8")
        (draft_dir / "requirements.md").write_text(payload.markdown_content.strip() + "\n", encoding="utf-8")
        (draft_dir / "draft.json").write_text(json.dumps({
            "title": payload.title.strip() or "My Custom Task",
            "task_type": payload.task_type,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return self.create_draft(user)

    def save_draft_reference(self, user: User, draft_id: str, filename: str, content: bytes) -> str:
        safe_name = self._sanitize_filename(filename)
        if not safe_name:
            raise ValueError("Uploaded image filename is invalid")
        target_dir = self._draft_dir(user, draft_id) / "reference"
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = self._unique_path(target_dir, safe_name)
        target_path.write_bytes(content)
        return target_path.name

    def save_task_reference(self, user: User, task_id: str, filename: str, content: bytes) -> str:
        safe_name = self._sanitize_filename(filename)
        if not safe_name:
            raise ValueError("Uploaded image filename is invalid")
        task = self._get_owned_task(user, task_id)
        target_dir = Path(task.yaml_path).parent / "reference"
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = self._unique_path(target_dir, safe_name)
        target_path.write_bytes(content)
        return target_path.name

    def create_user_task(self, user: User, payload: UserTaskCreateRequest) -> UserTaskDetail:
        task_id = f"task_{uuid4().hex[:12]}"
        task_dir = self._task_dir(user, task_id)
        task_dir.mkdir(parents=True, exist_ok=True)

        yaml_path = task_dir / "task.yaml"
        markdown_path = task_dir / "task.md"
        yaml_content = payload.yaml_content.strip() + "\n"
        markdown_content = payload.markdown_content.strip() + "\n"

        yaml_path.write_text(yaml_content, encoding="utf-8")
        markdown_path.write_text(markdown_content, encoding="utf-8")
        self._copy_draft_references(user, payload.draft_id, task_dir)

        task = UserTask(
            id=task_id,
            owner_user_id=user.id,
            title=payload.title.strip(),
            task_type=payload.task_type,
            summary=payload.summary.strip(),
            root_requirement_id=payload.root_requirement_id.strip(),
            node_count=payload.node_count,
            atomic_count=payload.atomic_count,
            yaml_path=str(yaml_path),
            markdown_path=str(markdown_path),
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return self.get_user_task_detail(user, task.id)

    def update_user_task(self, user: User, task_id: str, payload: UserTaskUpdateRequest) -> UserTaskDetail:
        task = self._get_owned_task(user, task_id)

        Path(task.yaml_path).write_text(payload.yaml_content.strip() + "\n", encoding="utf-8")
        Path(task.markdown_path).write_text(payload.markdown_content.strip() + "\n", encoding="utf-8")

        task.title = payload.title.strip()
        task.task_type = payload.task_type
        task.summary = payload.summary.strip()
        task.root_requirement_id = payload.root_requirement_id.strip()
        task.node_count = payload.node_count
        task.atomic_count = payload.atomic_count

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return self.get_user_task_detail(user, task.id)

    def get_document(self, user: User, task_id: str, kind: str) -> tuple[str, str]:
        task = self._get_owned_task(user, task_id)
        if kind == "yaml":
            return Path(task.yaml_path).read_text(encoding="utf-8"), f"{task.id}.yaml"
        if kind == "markdown":
            return Path(task.markdown_path).read_text(encoding="utf-8"), f"{task.id}.md"
        raise LookupError("Unknown task document kind")

    def get_draft_reference_path(self, user: User, draft_id: str, asset_path: str) -> Path:
        reference_root = (self._draft_dir(user, draft_id) / "reference").resolve()
        reference_root.mkdir(parents=True, exist_ok=True)
        target = (reference_root / asset_path).resolve()
        try:
            target.relative_to(reference_root)
        except ValueError as exc:
            raise LookupError("Draft reference path is outside the draft directory") from exc
        if not target.is_file():
            raise LookupError("Draft reference image not found")
        return target

    def build_draft_bundle(self, user: User, draft_id: str) -> tuple[bytes, str]:
        draft_dir = self._draft_dir(user, draft_id)
        draft_dir.mkdir(parents=True, exist_ok=True)
        payload = self._read_draft_payload(draft_dir)
        reference_dir = draft_dir / "reference"
        reference_dir.mkdir(parents=True, exist_ok=True)
        buffer = BytesIO()
        root_dir = "requirement"
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(f"{root_dir}/requirements.yaml", (payload["yaml_content"].strip() + "\n") if payload["yaml_content"].strip() else "")
            archive.writestr(f"{root_dir}/requirements.md", (payload["markdown_content"].strip() + "\n") if payload["markdown_content"].strip() else "")
            archive.writestr(f"{root_dir}/reference/", "")
            for file_path in reference_dir.rglob("*"):
                if not file_path.is_file():
                    continue
                archive.write(file_path, f"{root_dir}/reference/{file_path.relative_to(reference_dir).as_posix()}")
        return buffer.getvalue(), "requirement.zip"

    def _get_owned_task(self, user: User, task_id: str) -> UserTask:
        task = self.db.scalar(
            select(UserTask).where(
                UserTask.id == task_id,
                UserTask.owner_user_id == user.id,
            )
        )
        if task is None:
            raise LookupError(f"Task '{task_id}' not found")
        return task

    def _task_dir(self, user: User, task_id: str) -> Path:
        owner_slug = f"{user.username}-{user.id}"
        return self.settings.user_tasks_root / owner_slug / task_id

    def _draft_dir(self, user: User, draft_id: str) -> Path:
        owner_slug = f"{user.username}-{user.id}"
        return self.settings.user_tasks_root / owner_slug / "_drafts" / draft_id

    def _read_draft_payload(self, draft_dir: Path) -> dict[str, str]:
        meta_path = draft_dir / "draft.json"
        yaml_path = draft_dir / "requirements.yaml"
        markdown_path = draft_dir / "requirements.md"
        title = "My Custom Task"
        task_type = "web"
        if meta_path.is_file():
            try:
                payload = json.loads(meta_path.read_text(encoding="utf-8"))
                if isinstance(payload, dict):
                    raw_title = payload.get("title")
                    raw_task_type = payload.get("task_type")
                    if isinstance(raw_title, str) and raw_title.strip():
                        title = raw_title.strip()
                    if raw_task_type in {"web", "mobile", "kernel", "mixed"}:
                        task_type = raw_task_type
            except json.JSONDecodeError:
                pass
        return {
            "title": title,
            "task_type": task_type,
            "yaml_content": yaml_path.read_text(encoding="utf-8") if yaml_path.is_file() else "",
            "markdown_content": markdown_path.read_text(encoding="utf-8") if markdown_path.is_file() else "",
        }

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        cleaned = Path(filename).name.strip()
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", cleaned)
        return cleaned.strip(".-")

    @staticmethod
    def _unique_path(directory: Path, filename: str) -> Path:
        candidate = directory / filename
        if not candidate.exists():
            return candidate
        stem = candidate.stem
        suffix = candidate.suffix
        counter = 2
        while True:
            alternative = directory / f"{stem}-{counter}{suffix}"
            if not alternative.exists():
                return alternative
            counter += 1

    def _copy_draft_references(self, user: User, draft_id: str | None, task_dir: Path) -> None:
        if not draft_id:
            return
        source_reference_dir = self._draft_dir(user, draft_id) / "reference"
        if not source_reference_dir.is_dir():
            return
        target_reference_dir = task_dir / "reference"
        shutil.copytree(source_reference_dir, target_reference_dir, dirs_exist_ok=True)
