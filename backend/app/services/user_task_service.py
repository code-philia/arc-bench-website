from __future__ import annotations

import json
import re
import shutil
import zipfile
from io import BytesIO
from pathlib import Path, PurePosixPath
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.requirement import Requirement
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
    MAX_IMPORT_ARCHIVE_BYTES = 25 * 1024 * 1024
    MAX_IMPORT_FILE_COUNT = 1_000
    MAX_IMPORT_UNCOMPRESSED_BYTES = 100 * 1024 * 1024

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

    def import_draft_bundle(self, user: User, filename: str, content: bytes) -> UserTaskDraftResponse:
        """Replace the active draft with a validated requirement bundle.

        The bundle may place its files at the ZIP root or beneath one enclosing
        directory (for example the directory emitted by the export endpoint).
        The requirement documents and every safe resource file beneath the
        enclosing bundle directory are imported. This preserves enhanced
        documents that use folders besides the legacy reference/ directory.
        """
        if not filename.lower().endswith(".zip"):
            raise ValueError("Only .zip requirement bundles are supported")
        if not content:
            raise ValueError("Uploaded requirement bundle is empty")
        if len(content) > self.MAX_IMPORT_ARCHIVE_BYTES:
            raise ValueError("Requirement bundle exceeds the 25 MB upload limit")

        try:
            archive = zipfile.ZipFile(BytesIO(content))
        except zipfile.BadZipFile as exc:
            raise ValueError("Uploaded file is not a valid ZIP archive") from exc

        with archive:
            members: list[tuple[zipfile.ZipInfo, PurePosixPath]] = []
            uncompressed_size = 0
            for info in archive.infolist():
                if info.is_dir():
                    continue
                if len(members) >= self.MAX_IMPORT_FILE_COUNT:
                    raise ValueError("Requirement bundle contains too many files")
                member_path = self._safe_zip_member_path(info.filename)
                uncompressed_size += info.file_size
                if uncompressed_size > self.MAX_IMPORT_UNCOMPRESSED_BYTES:
                    raise ValueError("Requirement bundle expands beyond the 100 MB safety limit")
                members.append((info, member_path))

            yaml_members = [(info, path) for info, path in members if path.name == "requirements.yaml"]
            if len(yaml_members) != 1:
                raise ValueError("Requirement bundle must contain exactly one requirements.yaml file")

            yaml_info, yaml_path = yaml_members[0]
            bundle_root = yaml_path.parent
            markdown_info = next(
                (info for info, path in members if path == bundle_root / "requirements.md"),
                None,
            )
            resource_members = [
                (info, path.relative_to(bundle_root))
                for info, path in members
                if path not in {yaml_path, bundle_root / "requirements.md", bundle_root / "draft.json"}
                and bundle_root in path.parents
            ]

            draft_dir = self._draft_dir(user, self.ACTIVE_DRAFT_ID)
            staging_dir = draft_dir.parent / f".{self.ACTIVE_DRAFT_ID}-{uuid4().hex}.importing"
            backup_dir = draft_dir.parent / f".{self.ACTIVE_DRAFT_ID}-{uuid4().hex}.backup"
            try:
                staging_dir.mkdir(parents=True, exist_ok=False)
                (staging_dir / "reference").mkdir()
                (staging_dir / "requirements.yaml").write_bytes(archive.read(yaml_info))
                if markdown_info is not None:
                    (staging_dir / "requirements.md").write_bytes(archive.read(markdown_info))
                else:
                    (staging_dir / "requirements.md").write_text("", encoding="utf-8")
                (staging_dir / "draft.json").write_text(
                    json.dumps({"title": "My Custom Task", "task_type": "web"}, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
                for info, relative_path in resource_members:
                    target = staging_dir / Path(*relative_path.parts)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(archive.read(info))

                draft_dir.parent.mkdir(parents=True, exist_ok=True)
                if draft_dir.exists():
                    draft_dir.replace(backup_dir)
                staging_dir.replace(draft_dir)
                if backup_dir.exists():
                    shutil.rmtree(backup_dir)
            except Exception:
                if staging_dir.exists():
                    shutil.rmtree(staging_dir, ignore_errors=True)
                if backup_dir.exists() and not draft_dir.exists():
                    backup_dir.replace(draft_dir)
                raise

        return self.create_draft(user)

    def save_draft_reference(self, user: User, draft_id: str, filename: str, content: bytes) -> str:
        safe_name = self._sanitize_filename(filename)
        if not safe_name:
            raise ValueError("Uploaded attachment filename is invalid")
        target_dir = self._draft_dir(user, draft_id) / "reference"
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = self._unique_path(target_dir, safe_name)
        target_path.write_bytes(content)
        return target_path.name

    def save_task_reference(self, user: User, task_id: str, filename: str, content: bytes) -> str:
        safe_name = self._sanitize_filename(filename)
        if not safe_name:
            raise ValueError("Uploaded attachment filename is invalid")
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

        yaml_path = task_dir / "requirements.yaml"
        markdown_path = task_dir / "requirements.md"
        yaml_content = payload.yaml_content.strip() + "\n"
        markdown_content = payload.markdown_content.strip() + "\n"

        yaml_path.write_text(yaml_content, encoding="utf-8")
        markdown_path.write_text(markdown_content, encoding="utf-8")
        self._copy_draft_resources(user, payload.draft_id, task_dir)
        self._ensure_task_runtime_layout(task_dir, payload.task_type, yaml_content, markdown_content)

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
        self.sync_task_requirement(user, task.id)
        return self.get_user_task_detail(user, task.id)

    def update_user_task(self, user: User, task_id: str, payload: UserTaskUpdateRequest) -> UserTaskDetail:
        task = self._get_owned_task(user, task_id)

        yaml_content = payload.yaml_content.strip() + "\n"
        markdown_content = payload.markdown_content.strip() + "\n"
        task_dir = Path(task.yaml_path).parent
        Path(task.yaml_path).write_text(yaml_content, encoding="utf-8")
        Path(task.markdown_path).write_text(markdown_content, encoding="utf-8")
        self._ensure_task_runtime_layout(task_dir, payload.task_type, yaml_content, markdown_content)

        task.title = payload.title.strip()
        task.task_type = payload.task_type
        task.summary = payload.summary.strip()
        task.root_requirement_id = payload.root_requirement_id.strip()
        task.node_count = payload.node_count
        task.atomic_count = payload.atomic_count

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        self.sync_task_requirement(user, task.id)
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
            raise LookupError("Draft reference attachment not found")
        return target

    def delete_draft_reference(self, user: User, draft_id: str, asset_path: str) -> None:
        target = self.get_draft_reference_path(user, draft_id, asset_path)
        target.unlink()

    def delete_task_reference(self, user: User, task_id: str, asset_path: str) -> None:
        task = self._get_owned_task(user, task_id)
        reference_root = (Path(task.yaml_path).parent / "reference").resolve()
        target = (reference_root / asset_path).resolve()
        try:
            target.relative_to(reference_root)
        except ValueError as exc:
            raise LookupError("Reference attachment path is invalid") from exc
        if not target.is_file():
            raise LookupError("Reference attachment not found")
        target.unlink()

    def build_draft_bundle(self, user: User, draft_id: str) -> tuple[bytes, str]:
        draft_dir = self._draft_dir(user, draft_id)
        draft_dir.mkdir(parents=True, exist_ok=True)
        payload = self._read_draft_payload(draft_dir)
        buffer = BytesIO()
        root_dir = "requirement"
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(f"{root_dir}/requirements.yaml", (payload["yaml_content"].strip() + "\n") if payload["yaml_content"].strip() else "")
            archive.writestr(f"{root_dir}/requirements.md", (payload["markdown_content"].strip() + "\n") if payload["markdown_content"].strip() else "")
            for file_path in self._iter_bundle_resource_files(draft_dir):
                archive.write(file_path, f"{root_dir}/{file_path.relative_to(draft_dir).as_posix()}")
        return buffer.getvalue(), "requirement.zip"

    def build_task_bundle(self, user: User, task_id: str) -> tuple[bytes, str]:
        task = self._get_owned_task(user, task_id)
        task_dir = Path(task.yaml_path).parent
        buffer = BytesIO()
        root_dir = task.id
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(f"{root_dir}/requirements.yaml", Path(task.yaml_path).read_text(encoding="utf-8"))
            archive.writestr(f"{root_dir}/requirements.md", Path(task.markdown_path).read_text(encoding="utf-8"))
            for file_path in self._iter_bundle_resource_files(task_dir):
                archive.write(file_path, f"{root_dir}/{file_path.relative_to(task_dir).as_posix()}")
        return buffer.getvalue(), f"{task.id}.zip"

    def sync_task_requirement(self, user: User, task_id: str) -> Requirement:
        task = self._get_owned_task(user, task_id)
        task_dir = Path(task.yaml_path).parent
        self._ensure_task_runtime_layout(
            task_dir,
            task.task_type,
            Path(task.yaml_path).read_text(encoding="utf-8"),
            Path(task.markdown_path).read_text(encoding="utf-8"),
        )
        requirement = self.db.get(Requirement, task.id)
        if requirement is None:
            requirement = Requirement(id=task.id)
            self.db.add(requirement)

        requirement.title = task.title
        requirement.category = task.task_type
        requirement.summary = task.summary
        requirement.test_runner = "playwright"
        requirement.requirements_path = str(task_dir / "requirements.md")
        requirement.prerequisites_path = str(task_dir / "prerequisites.md")
        requirement.tests_path = str(task_dir / "tests")
        requirement.assets_path = str(task_dir / "assets")
        requirement.references_path = str(task_dir / "reference")
        requirement.total_tests = 0
        requirement.module_count = task.atomic_count

        self.db.add(requirement)
        self.db.commit()
        self.db.refresh(requirement)
        return requirement

    def get_owned_task_for_submission(self, user: User, task_id: str) -> tuple[UserTask, Requirement]:
        task = self._get_owned_task(user, task_id)
        requirement = self.sync_task_requirement(user, task_id)
        return task, requirement

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
                    if raw_task_type in {"web", "mobile", "kernel", "mixed", "cli"}:
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
    def _safe_zip_member_path(filename: str) -> PurePosixPath:
        normalized = filename.replace("\\", "/")
        path = PurePosixPath(normalized)
        if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
            raise ValueError("Requirement bundle contains an unsafe file path")
        return path

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

    def _copy_draft_resources(self, user: User, draft_id: str | None, task_dir: Path) -> None:
        if not draft_id:
            return
        draft_dir = self._draft_dir(user, draft_id)
        for source_path in self._iter_bundle_resource_files(draft_dir):
            target_path = task_dir / source_path.relative_to(draft_dir)
            target_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_path, target_path)

    @staticmethod
    def _iter_bundle_resource_files(root_dir: Path):
        excluded_root_names = {"requirements.yaml", "requirements.md", "draft.json"}
        if not root_dir.is_dir():
            return
        for source_path in sorted(root_dir.rglob("*")):
            if not source_path.is_file():
                continue
            relative_path = source_path.relative_to(root_dir)
            if not relative_path.parts or relative_path.parts[0] in excluded_root_names:
                continue
            yield source_path

    def _ensure_task_runtime_layout(self, task_dir: Path, task_type: str, yaml_content: str, markdown_content: str) -> None:
        (task_dir / "requirements.yaml").write_text(yaml_content.strip() + "\n", encoding="utf-8")
        (task_dir / "requirements.md").write_text(markdown_content.strip() + "\n", encoding="utf-8")
        (task_dir / "prerequisites.md").write_text("", encoding="utf-8")
        (task_dir / "assets").mkdir(parents=True, exist_ok=True)
        (task_dir / "reference").mkdir(parents=True, exist_ok=True)
        (task_dir / "tests").mkdir(parents=True, exist_ok=True)

        template_dir = task_dir / "template"
        template_source = self._resolve_template_source(task_type)
        if template_source is not None and template_source.is_dir():
            shutil.copytree(template_source, template_dir, dirs_exist_ok=True)
        else:
            template_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_template_source(self, task_type: str) -> Path | None:
        normalized = str(task_type or "").strip().lower()
        if normalized == "web":
            return self.settings.web_template_files_root
        if normalized in {"mobile", "android"}:
            return self.settings.mobile_template_files_root
        if normalized == "cli":
            return self.settings.builtin_arc_agent_source_dir / "templates" / "cli"
        return None
