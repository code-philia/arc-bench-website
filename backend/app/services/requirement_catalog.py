from __future__ import annotations

import importlib.util
import io
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session
import yaml

from app.core.enums import SubmissionStatus
from app.core.config import get_settings
from app.models.requirement import Requirement
from app.models.competition_account import CompetitionEntry, TeamMembership
from app.models.submission import Submission
from app.models.run import Run
from app.models.user import User
from app.schemas.requirement import (
    BenchmarkDetail,
    BenchmarkDownloadLinks,
    BenchmarkSummary,
    BenchmarkTaskSummary,
    CompetitionDetail,
    CompetitionLeaderboardEntry,
    CompetitionSubmissionHistoryEntry,
    CompetitionSummary,
    CompetitionTaskRunScore,
    CompetitionTaskDownloadLinks,
    CompetitionTaskSummary,
    RequirementDetail,
    RequirementSummary,
    RequirementTestFile,
    RequirementTests,
)


@dataclass
class CatalogRequirementEntry:
    id: str
    competition_id: str | None
    title: str
    category: str
    summary: str
    test_runner: str
    total_tests: int
    module_count: int
    requirements_path: Path
    requirements_yaml_path: Path
    prerequisites_path: Path
    tests_path: Path
    assets_path: Path
    references_path: Path


class RequirementCatalogService:
    def __init__(
        self,
        db: Session,
        *,
        catalog_name: str,
        requirements_root: Path,
        tests_root: Path,
    ):
        self.db = db
        self.settings = get_settings()
        self.catalog_name = catalog_name
        self.requirements_root = requirements_root
        self.tests_root = tests_root

    @classmethod
    def for_catalog(cls, db: Session, catalog: str) -> "RequirementCatalogService":
        settings = get_settings()
        if catalog in {"competition", "benchmark"}:
            return cls(
                db,
                catalog_name=catalog,
                requirements_root=settings.requirements_root,
                tests_root=settings.tests_root,
            )
        if catalog == "playground":
            return cls(
                db,
                catalog_name="playground",
                requirements_root=settings.playground_requirements_root,
                tests_root=settings.playground_tests_root,
            )
        raise ValueError(f"Unknown catalog '{catalog}'")

    def scan_entries(self) -> list[CatalogRequirementEntry]:
        rows: list[CatalogRequirementEntry] = []
        for category, tasks_root, tests_root in self._iter_catalog_sources():
            if not tasks_root.exists():
                continue

            for task_dir in sorted(tasks_root.iterdir()):
                if not task_dir.is_dir():
                    continue

                source_requirement_id = task_dir.name
                requirement_id = (
                    f"{category}--{source_requirement_id}"
                    if self.catalog_name == "competition"
                    else source_requirement_id
                )
                # A competition directory identifies the event, not the
                # deployable task type. Competition packs currently run as
                # web applications regardless of their event ID.
                task_category = "web" if self.catalog_name == "competition" else category
                resolved_paths = self._resolve_task_requirement_paths(task_dir)
                if resolved_paths is None:
                    continue
                requirements_path, requirement_yaml_path, prerequisites_path, assets_path, references_path = resolved_paths
                tests_path = task_dir / "tests"
                requirement_metadata = self._read_requirement_metadata(requirement_yaml_path)
                leaf_requirement_count = self._count_leaf_requirements(requirement_yaml_path)
                display_test_count = self._count_test_cases(tests_path)
                rows.append(
                    CatalogRequirementEntry(
                        id=requirement_id,
                        competition_id=category if self.catalog_name == "competition" else None,
                        title=str(requirement_metadata.get("name") or requirement_id).strip() or requirement_id,
                        category=task_category,
                        summary=str(requirement_metadata.get("description") or "").strip(),
                        test_runner="playwright",
                        total_tests=display_test_count,
                        module_count=leaf_requirement_count,
                        requirements_path=requirements_path,
                        requirements_yaml_path=requirement_yaml_path,
                        prerequisites_path=prerequisites_path,
                        tests_path=tests_path,
                        assets_path=assets_path,
                        references_path=references_path,
                    )
                )

        return rows

    def _resolve_task_requirement_paths(self, task_dir: Path) -> tuple[Path, Path, Path, Path, Path] | None:
        """Resolve a task from its YAML source without requiring rendered Markdown.

        ``requirements.yaml`` is the source of truth for every catalog. Markdown
        is only a presentation artifact and is rendered on demand when a detail
        page or document download needs it.
        """
        candidates = (
            task_dir / "requirements" / "requirements.yaml",
            task_dir / "requirements" / "requirements.yml",
            task_dir / "requirements.yaml",
            task_dir / "requirements.yml",
        )
        requirement_yaml_path = next((path for path in candidates if path.is_file()), None)
        if requirement_yaml_path is None:
            return None

        requirements_path = requirement_yaml_path.with_suffix(".md")
        source_dir = requirement_yaml_path.parent
        references_path = source_dir / "reference"
        assets_path = source_dir / "assets"
        if source_dir == task_dir:
            # Existing task packs keep references beside requirements.yaml.
            references_path = task_dir / "reference"
            assets_path = task_dir / "assets"
        return (
            requirements_path,
            requirement_yaml_path,
            source_dir / "prerequisites.md",
            assets_path,
            references_path,
        )

    @staticmethod
    def _render_requirement_markdown(requirement_yaml_path: Path) -> None:
        script_path = Path(__file__).resolve().parents[3] / "scripts" / "render_competition_requirements.py"
        spec = importlib.util.spec_from_file_location("arcbench_competition_requirement_renderer", script_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Unable to load requirement renderer: {script_path}")
        renderer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(renderer)
        renderer.convert_file(requirement_yaml_path)

    @staticmethod
    def _read_requirement_metadata(requirement_yaml_path: Path) -> dict[str, Any]:
        try:
            payload = yaml.safe_load(requirement_yaml_path.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError as exc:
            raise ValueError(f"Invalid requirement YAML: {requirement_yaml_path}") from exc
        return payload if isinstance(payload, dict) else {}

    def _iter_catalog_sources(self) -> list[tuple[str, Path, Path]]:
        if self.catalog_name == "competition":
            sources: list[tuple[str, Path, Path]] = []
            for competition_root in self._competition_roots():
                sources.append(
                    (
                        self._competition_id(competition_root.name),
                        competition_root,
                        competition_root,
                    )
                )
            return sources

        source_root = self.settings.arc_bench_root if self.catalog_name == "benchmark" else self.settings.playground_root
        if not source_root.is_dir():
            return []
        return [
            (track_root.name, track_root, track_root)
            for track_root in sorted(source_root.iterdir())
            if track_root.is_dir()
        ]

    def _competition_roots(self) -> list[Path]:
        root = self.settings.competition_root
        if not root.is_dir():
            return []
        return [path for path in sorted(root.iterdir()) if path.is_dir() and not path.name.startswith(".")]

    @staticmethod
    def _competition_id(name: str) -> str:
        return "-".join(part for part in name.strip().lower().replace("_", " ").split() if part)

    @staticmethod
    def _normalize_competition_category(app_dir_name: str) -> str:
        if app_dir_name == "webapp":
            return "web"
        if app_dir_name == "mobileapp":
            return "mobile"
        if app_dir_name.endswith("app"):
            return app_dir_name[:-3]
        return app_dir_name

    def sync_to_db(self, requirement_id: str | None = None) -> None:
        for entry in self.scan_entries():
            if requirement_id and entry.id != requirement_id:
                continue

            existing = self.db.get(Requirement, entry.id)
            data = {
                "title": entry.title,
                "category": entry.category,
                "summary": entry.summary,
                "test_runner": entry.test_runner,
                "requirements_path": str(entry.requirements_path),
                "prerequisites_path": str(entry.prerequisites_path),
                "tests_path": str(entry.tests_path),
                "assets_path": str(entry.assets_path),
                "references_path": str(entry.references_path),
                "total_tests": entry.total_tests,
                "module_count": entry.module_count,
            }
            if existing:
                for key, value in data.items():
                    setattr(existing, key, value)
            else:
                self.db.add(Requirement(id=entry.id, **data))

        self.db.commit()

    def list_requirements(self) -> list[RequirementSummary]:
        rows = self.scan_entries()
        display_ids = self._build_display_id_map(rows)
        return [self._to_requirement_summary(row, display_ids.get(row.id, row.id)) for row in rows]

    def get_requirement_detail(self, requirement_id: str, base_url: str) -> RequirementDetail:
        rows = self.scan_entries()
        display_ids = self._build_display_id_map(rows)
        requirement = self.get_entry(requirement_id, rows)
        self._ensure_requirement_markdown(requirement)
        requirements_markdown = requirement.requirements_path.read_text(encoding="utf-8")
        requirements_yaml = requirement.requirements_yaml_path.read_text(encoding="utf-8")
        prerequisites_markdown = self._read_text_if_exists(requirement.prerequisites_path)

        return RequirementDetail(
            id=requirement.id,
            display_id=display_ids.get(requirement.id, requirement.id),
            title=requirement.title,
            category=requirement.category,
            summary=requirement.summary,
            test_runner=requirement.test_runner,
            total_tests=requirement.total_tests,
            module_count=requirement.module_count,
            requirements_markdown=requirements_markdown,
            requirements_yaml=requirements_yaml,
            prerequisites_markdown=prerequisites_markdown,
            assets_base_url=f"{base_url}/api/requirements/{requirement.id}/assets?catalog={self.catalog_name}",
            references_base_url=f"{base_url}/api/requirements/{requirement.id}/references?catalog={self.catalog_name}",
        )

    def list_competitions(self) -> list[CompetitionSummary]:
        rows = self.scan_entries()
        grouped: dict[str, list[CatalogRequirementEntry]] = {}
        for row in rows:
            grouped.setdefault(row.competition_id or row.category, []).append(row)

        competitions: list[CompetitionSummary] = []
        for root in self._competition_roots():
            competition_id = self._competition_id(root.name)
            competitions.append(self._competition_summary_model(competition_id, root.name, grouped.get(competition_id, [])))

        return competitions

    def list_competition_leaderboard(
        self,
        track: str = "all",
        competition_id: str | None = None,
        allowed_competition_ids: set[str] | None = None,
    ) -> list[CompetitionLeaderboardEntry]:
        normalized_track = track.strip().lower() or "all"
        if normalized_track not in {"all", "web", "mobile", "kernel"}:
            raise ValueError(f"Unsupported leaderboard track '{track}'")

        rows = self.scan_entries()
        if allowed_competition_ids is not None:
            rows = [row for row in rows if (row.competition_id or "").lower() in allowed_competition_ids]
        requirement_ids_by_category: dict[str, list[str]] = {}
        for row in rows:
            requirement_ids_by_category.setdefault(row.category, []).append(row.id)

        normalized_competition_id = competition_id.strip().lower() if competition_id else None
        if normalized_competition_id:
            # A leaderboard entry is the user's selected competition
            # submission, rather than an average over every retry ever run.
            # This matches the score rule shown on the competition page.
            competitors = self.db.scalars(
                select(CompetitionEntry).where(CompetitionEntry.competition_id == normalized_competition_id)
            ).all()
            leaderboard: list[CompetitionLeaderboardEntry] = []
            for entry in competitors:
                history = self._competition_submission_history(
                    normalized_competition_id,
                    task_entries=[item for item in rows if item.competition_id == normalized_competition_id],
                    competition_entry_id=entry.id,
                    legacy_user_id=None,
                )
                selected = next((entry for entry in history if entry.is_selected_score), None)
                if selected is None:
                    continue
                completed_tasks = [task for task in selected.task_scores if task.run_id is not None]
                avg_runtime_seconds = (
                    int(round(selected.total_run_duration_seconds / len(completed_tasks)))
                    if completed_tasks
                    else None
                )
                leaderboard.append(
                    CompetitionLeaderboardEntry(
                        username=entry.display_name,
                        model_name=selected.model_name,
                        track=normalized_competition_id,
                        avg_pass_rate=selected.average_test_pass_rate,
                        total_token_millions=None,
                        avg_runtime_seconds=avg_runtime_seconds,
                        submission_count=len(history),
                    )
                )
            # Preserve pre-migration individual snapshots that have no entry
            # yet; newly created competition snapshots always use an entry.
            legacy_competitors = self.db.execute(
                select(Submission.user_id, User.username)
                .join(User, Submission.user_id == User.id)
                .where(Submission.catalog == "competition")
                .where(Submission.competition_id == normalized_competition_id)
                .where(Submission.competition_entry_id.is_(None))
                .where(Submission.user_id.is_not(None))
                .distinct()
            ).all()
            for user_id, username in legacy_competitors:
                history = self._competition_submission_history(
                    normalized_competition_id,
                    task_entries=[item for item in rows if item.competition_id == normalized_competition_id],
                    competition_entry_id=None,
                    legacy_user_id=str(user_id),
                )
                selected = next((item for item in history if item.is_selected_score), None)
                if selected is None:
                    continue
                completed_tasks = [task for task in selected.task_scores if task.run_id is not None]
                leaderboard.append(
                    CompetitionLeaderboardEntry(
                        username=str(username),
                        model_name=selected.model_name,
                        track=normalized_competition_id,
                        avg_pass_rate=selected.average_test_pass_rate,
                        total_token_millions=None,
                        avg_runtime_seconds=(
                            int(round(selected.total_run_duration_seconds / len(completed_tasks))) if completed_tasks else None
                        ),
                        submission_count=len(history),
                    )
                )
            leaderboard.sort(
                key=lambda item: (
                    -item.avg_pass_rate,
                    item.avg_runtime_seconds if item.avg_runtime_seconds is not None else 10**9,
                    item.username.lower(),
                )
            )
            return leaderboard

        if normalized_track == "all":
            requirement_ids = [requirement_id for ids in requirement_ids_by_category.values() for requirement_id in ids]
        else:
            requirement_ids = requirement_ids_by_category.get(normalized_track, [])

        if not requirement_ids:
            return []

        query = (
            select(Run, User.username, Submission.model_name)
            .join(User, Run.user_id == User.id)
            .outerjoin(Submission, Run.submission_id == Submission.id)
            .where(Run.requirement_id.in_(requirement_ids))
            .where(Run.user_id.is_not(None))
            .where(Run.status.in_([SubmissionStatus.PASSED.value, SubmissionStatus.FAILED.value]))
            .where(Run.score.is_not(None))
        )

        aggregates: dict[tuple[str, str], dict[str, object]] = {}
        for submission, username, source_model_name in self.db.execute(query).all():
            model_name = (source_model_name or "").strip() or None
            key = (submission.user_id or "", model_name or "")
            aggregate = aggregates.setdefault(
                key,
                {
                    "username": username,
                    "model_name": model_name,
                    "pass_rate_sum": 0.0,
                    "submission_count": 0,
                    "runtime_sum": 0,
                    "runtime_count": 0,
                },
            )
            aggregate["pass_rate_sum"] = float(aggregate["pass_rate_sum"]) + float(submission.score or 0.0)
            aggregate["submission_count"] = int(aggregate["submission_count"]) + 1
            if submission.started_at and submission.finished_at:
                runtime_seconds = max(0, int((submission.finished_at - submission.started_at).total_seconds()))
                aggregate["runtime_sum"] = int(aggregate["runtime_sum"]) + runtime_seconds
                aggregate["runtime_count"] = int(aggregate["runtime_count"]) + 1

        leaderboard: list[CompetitionLeaderboardEntry] = []
        for aggregate in aggregates.values():
            submission_count = int(aggregate["submission_count"])
            runtime_count = int(aggregate["runtime_count"])
            avg_runtime_seconds = int(round(int(aggregate["runtime_sum"]) / runtime_count)) if runtime_count > 0 else None
            leaderboard.append(
                CompetitionLeaderboardEntry(
                    username=str(aggregate["username"]),
                    model_name=aggregate["model_name"] if isinstance(aggregate["model_name"], str) or aggregate["model_name"] is None else None,
                    track=normalized_competition_id or normalized_track,
                    avg_pass_rate=round(float(aggregate["pass_rate_sum"]) / submission_count, 1),
                    total_token_millions=None,
                    avg_runtime_seconds=avg_runtime_seconds,
                    submission_count=submission_count,
                )
            )

        leaderboard.sort(
            key=lambda item: (
                -item.avg_pass_rate,
                -item.submission_count,
                item.avg_runtime_seconds if item.avg_runtime_seconds is not None else 10**9,
                item.username.lower(),
                (item.model_name or "").lower(),
            )
        )
        return leaderboard

    def list_competition_submission_history(
        self,
        competition_id: str,
        user_id: str,
    ) -> list[CompetitionSubmissionHistoryEntry]:
        """Return one row per uploaded competition agent and its latest task scores.

        Re-running a task never overwrites a previous run.  The competition view
        treats the most recently completed run of a task as that submission's
        current task score.  Missing tasks count as zero in the submission's
        average so partially run submissions cannot receive an inflated score.
        """
        normalized_competition_id = competition_id.strip().lower()
        task_entries = [
            entry for entry in self.scan_entries() if entry.competition_id == normalized_competition_id
        ]
        if not any(item.id == normalized_competition_id for item in self.list_competitions()):
            raise LookupError(f"Competition '{competition_id}' not found")

        membership = self.db.scalar(select(TeamMembership).where(TeamMembership.user_id == user_id))
        entry = None
        if membership:
            entry = self.db.scalar(
                select(CompetitionEntry).where(
                    CompetitionEntry.competition_id == normalized_competition_id,
                    CompetitionEntry.team_id == membership.team_id,
                )
            )
        if entry is None:
            entry = self.db.scalar(
                select(CompetitionEntry).where(
                    CompetitionEntry.competition_id == normalized_competition_id,
                    CompetitionEntry.user_id == user_id,
                )
            )
        return self._competition_submission_history(
            normalized_competition_id,
            task_entries=task_entries,
            competition_entry_id=entry.id if entry else None,
            legacy_user_id=user_id,
        )

    def _competition_submission_history(
        self,
        competition_id: str,
        *,
        task_entries: list[CatalogRequirementEntry],
        competition_entry_id: str | None,
        legacy_user_id: str | None,
    ) -> list[CompetitionSubmissionHistoryEntry]:
        snapshots_query = (
            select(Submission)
            .where(Submission.catalog == "competition")
            .where(Submission.competition_id == competition_id)
            .order_by(desc(Submission.created_at))
        )
        if competition_entry_id:
            snapshots_query = snapshots_query.where(Submission.competition_entry_id == competition_entry_id)
        elif legacy_user_id:
            snapshots_query = snapshots_query.where(
                Submission.user_id == legacy_user_id,
                Submission.competition_entry_id.is_(None),
            )
        else:
            return []
        snapshots = self.db.scalars(snapshots_query).all()
        if not snapshots:
            return []

        snapshot_ids = [snapshot.id for snapshot in snapshots]
        completed_statuses = [SubmissionStatus.PASSED.value, SubmissionStatus.FAILED.value]
        runs = self.db.scalars(
            select(Run)
            .where(Run.submission_id.in_(snapshot_ids))
            .where(Run.requirement_id.in_([task.id for task in task_entries]))
            .where(Run.status.in_(completed_statuses))
            .order_by(desc(Run.finished_at), desc(Run.created_at))
        ).all()

        latest_runs: dict[tuple[str, str], Run] = {}
        for run in runs:
            key = (str(run.submission_id), run.requirement_id)
            latest_runs.setdefault(key, run)

        history: list[CompetitionSubmissionHistoryEntry] = []
        for snapshot in snapshots:
            task_scores: list[CompetitionTaskRunScore] = []
            pass_rate_sum = 0.0
            feature_rate_sum = 0.0
            duration_sum = 0
            for task in task_entries:
                run = latest_runs.get((snapshot.id, task.id))
                if run is None:
                    task_scores.append(CompetitionTaskRunScore(task_id=task.id, task_title=task.title))
                    continue
                test_pass_rate = run.test_pass_rate if run.test_pass_rate is not None else run.score
                feature_rate = run.feature_implementation_rate
                pass_rate_sum += float(test_pass_rate or 0.0)
                feature_rate_sum += float(feature_rate or 0.0)
                duration_sum += int(run.run_duration_seconds or 0)
                task_scores.append(
                    CompetitionTaskRunScore(
                        task_id=task.id,
                        task_title=task.title,
                        run_id=run.id,
                        status=run.status,
                        test_pass_rate=test_pass_rate,
                        feature_implementation_rate=feature_rate,
                        run_duration_seconds=run.run_duration_seconds,
                        token_cost_usd=run.token_cost_usd,
                        completed_at=run.finished_at.isoformat() if run.finished_at else None,
                    )
                )
            task_count = len(task_entries)
            history.append(
                CompetitionSubmissionHistoryEntry(
                    id=snapshot.id,
                    display_name=snapshot.display_name,
                    model_name=snapshot.model_name,
                    original_filename=snapshot.original_filename,
                    runtime=snapshot.runtime,
                    created_at=snapshot.created_at.isoformat(),
                    task_scores=task_scores,
                    average_test_pass_rate=round(pass_rate_sum / task_count, 1) if task_count else 0.0,
                    average_feature_implementation_rate=round(feature_rate_sum / task_count, 1) if task_count else 0.0,
                    total_run_duration_seconds=duration_sum,
                    token_cost_usd=None,
                )
            )

        if history:
            # Stable tie-breaking keeps the newest equally scoring submission
            # selected, because snapshots are already ordered by created_at.
            selected = max(
                enumerate(history),
                key=lambda indexed: (indexed[1].average_test_pass_rate, -indexed[0]),
            )[0]
            history[selected].is_selected_score = True
        return history

    def get_competition_detail(self, competition_id: str, base_url: str) -> CompetitionDetail:
        rows = self.scan_entries()
        display_ids = self._build_display_id_map(rows)
        competition_tasks = [row for row in rows if row.competition_id == competition_id]
        competition_root = next((root for root in self._competition_roots() if self._competition_id(root.name) == competition_id), None)
        if competition_root is None:
            raise LookupError(f"Competition '{competition_id}' not found")

        tasks = [
            self._to_competition_task(row, base_url, is_public=False, display_id=display_ids.get(row.id, row.id))
            for row in competition_tasks
        ]
        summary = self._competition_summary_model(competition_id, competition_root.name, competition_tasks)
        return CompetitionDetail(
            **summary.model_dump(),
            downloads=None,
            tasks=tasks,
            flow=[
                "Upload an agent snapshot or select a built-in one.",
                "Compile the large requirement into smaller runnable modules.",
                "Run the GitHub-style and spreadsheet-style tasks in order.",
                "Inspect evidence and refine the system until the output is stable.",
            ],
            rules=[
                "Treat the requirement document as the source of truth.",
                "Keep changes small enough to verify each step.",
                "Use the task artifacts to explain what your agent changed.",
            ],
        )

    def _competition_summary_model(
        self,
        competition_id: str,
        directory_name: str,
        tasks: list[CatalogRequirementEntry],
    ) -> CompetitionSummary:
        is_hackathon = "hackathon" in competition_id
        title = "OAIC Harness 2026 Hackathon" if is_hackathon else ("Demo Competition" if competition_id == "demo" else directory_name)
        return CompetitionSummary(
            id=competition_id,
            title=title,
            type="hackathon" if is_hackathon else "demo",
            summary=(
                "An empty practice competition for validating the ARC-Bench submission workflow."
                if competition_id == "demo"
                else "A software-factory hackathon that compiles a large requirement into a GitHub-style collaboration system and a Google Sheets-style data workspace."
                if is_hackathon
                else self._competition_summary(competition_id, len(tasks))
            ),
            task_count=len(tasks),
            total_tests=sum(task.total_tests for task in tasks),
            is_public=True,
            starts_at="2026-09-01" if is_hackathon else None,
            ends_at="2026-10-17" if is_hackathon else None,
            status="upcoming" if is_hackathon else ("upcoming" if not tasks else "open"),
            notice=(
                "The hackathon focuses on software factory decomposition, requirements compilation, and two concrete task packs."
                if is_hackathon
                else "No tasks have been published yet. Add task folders directly to the competition directory."
                if not tasks
                else "Task packs are ready. Create a submission from this competition page."
            ),
        )

    def list_benchmarks(self, base_url: str) -> list[BenchmarkSummary]:
        rows = self.scan_entries()
        grouped: dict[str, list[CatalogRequirementEntry]] = {}
        for row in rows:
            grouped.setdefault(row.category, []).append(row)

        benchmarks: list[BenchmarkSummary] = []
        for category, items in sorted(grouped.items(), key=lambda item: self._competition_sort_key(item[0])):
            benchmarks.append(
                BenchmarkSummary(
                    id=category,
                    title=self._benchmark_title(category),
                    type=category,
                    summary=self._benchmark_summary(category, len(items)),
                    task_count=len(items),
                    total_tests=sum(item.total_tests for item in items),
                    downloads=BenchmarkDownloadLinks(
                        track_bundle=f"{base_url}/api/benchmarks/{category}/download",
                    ),
                )
            )
        return benchmarks

    def get_benchmark_detail(self, benchmark_id: str, base_url: str) -> BenchmarkDetail:
        rows = self.scan_entries()
        display_ids = self._build_display_id_map(rows)
        benchmark_tasks = [row for row in rows if row.category == benchmark_id]
        if not benchmark_tasks:
            raise LookupError(f"Benchmark '{benchmark_id}' not found")

        tasks = [
            self._to_benchmark_task_summary(row, base_url, display_ids.get(row.id, row.id))
            for row in benchmark_tasks
        ]
        return BenchmarkDetail(
            id=benchmark_id,
            title=self._benchmark_title(benchmark_id),
            type=benchmark_id,
            summary=self._benchmark_summary(benchmark_id, len(tasks)),
            task_count=len(tasks),
            total_tests=sum(task.total_tests for task in tasks),
            downloads=BenchmarkDownloadLinks(
                track_bundle=f"{base_url}/api/benchmarks/{benchmark_id}/download",
            ),
            tasks=tasks,
        )

    def get_document(self, requirement_id: str, kind: str) -> str:
        requirement = self.get_entry(requirement_id)
        if kind == "requirements":
            self._ensure_requirement_markdown(requirement)
        path = requirement.requirements_path if kind == "requirements" else requirement.prerequisites_path
        return self._read_text_if_exists(path)

    def get_asset_path(self, requirement_id: str, asset_kind: str, relative_path: str) -> Path:
        requirement = self.get_entry(requirement_id)
        base_dir = requirement.assets_path if asset_kind == "assets" else requirement.references_path
        if not base_dir.exists():
            raise FileNotFoundError(relative_path)
        target = (base_dir / relative_path).resolve()
        if not str(target).startswith(str(base_dir.resolve())) or not target.exists():
            raise FileNotFoundError(relative_path)
        return target

    def build_public_task_bundle(self, requirement_id: str) -> tuple[bytes, str]:
        requirement = self.get_entry(requirement_id)
        self._ensure_requirement_markdown(requirement)
        archive_name = f"arcbench-public-{requirement_id}.zip"
        entries = [
            (requirement.requirements_path, f"{requirement.id}/requirements/requirements.md"),
            (requirement.prerequisites_path, f"{requirement.id}/requirements/prerequisites.md"),
            (requirement.tests_path, f"{requirement.id}/tests"),
            (requirement.assets_path, f"{requirement.id}/requirements/assets"),
            (requirement.references_path, f"{requirement.id}/requirements/reference"),
        ]
        entries.append((requirement.requirements_yaml_path, f"{requirement.id}/requirements/requirements.yaml"))
        return self._build_zip(entries, archive_name)

    def build_public_task_document(self, requirement_id: str, kind: str) -> tuple[bytes, str]:
        requirement = self.get_entry(requirement_id)
        if kind == "requirements":
            self._ensure_requirement_markdown(requirement)
        source = requirement.requirements_path if kind == "requirements" else requirement.prerequisites_path
        return self._read_bytes_if_exists(source), source.name

    def build_public_task_tests_bundle(self, requirement_id: str) -> tuple[bytes, str]:
        requirement = self.get_entry(requirement_id)
        archive_name = f"arcbench-public-{requirement_id}-tests.zip"
        return self._build_zip([(requirement.tests_path, f"{requirement.id}/tests")], archive_name)

    def build_public_task_demo_bundle(self, requirement_id: str) -> tuple[bytes, str]:
        requirement = self.get_entry(requirement_id)
        archive_name = f"arcbench-public-{requirement_id}-demo.zip"
        return self._build_zip(
            [
                (requirement.assets_path, f"{requirement.id}/assets"),
                (requirement.references_path, f"{requirement.id}/reference"),
            ],
            archive_name,
        )

    def build_public_competition_bundle(self) -> tuple[bytes, str]:
        rows = self.scan_entries()
        entries: list[tuple[Path, str]] = []
        for requirement in rows:
            self._ensure_requirement_markdown(requirement)
            entries.extend(
                [
                    (requirement.requirements_path, f"public/{requirement.id}/requirements/requirements.md"),
                    (requirement.prerequisites_path, f"public/{requirement.id}/requirements/prerequisites.md"),
                    (requirement.tests_path, f"public/{requirement.id}/tests"),
                    (requirement.assets_path, f"public/{requirement.id}/requirements/assets"),
                    (requirement.references_path, f"public/{requirement.id}/requirements/reference"),
                ]
            )
            entries.append((requirement.requirements_yaml_path, f"public/{requirement.id}/requirements/requirements.yaml"))
        return self._build_zip(entries, "arcbench-public-competition.zip")

    def build_benchmark_track_bundle(self, benchmark_id: str) -> tuple[bytes, str]:
        rows = self.scan_entries()
        benchmark_tasks = [row for row in rows if row.category == benchmark_id]
        if not benchmark_tasks:
            raise LookupError(f"Benchmark '{benchmark_id}' not found")

        entries: list[tuple[Path, str]] = []
        for requirement in benchmark_tasks:
            root = f"{benchmark_id}"
            entries.extend(
                [
                    (requirement.requirements_path.parent, f"{root}/requirements/{requirement.id}"),
                    (requirement.tests_path, f"{root}/tests/{requirement.id}"),
                ]
            )

        readme = self._build_benchmark_bundle_readme(benchmark_id, benchmark_tasks)
        return self._build_zip_with_virtual_files(
            entries,
            [(f"{benchmark_id}/README.md", readme)],
            f"arcbench-{benchmark_id}-bundle.zip",
        )

    def build_benchmark_task_bundle(self, requirement_id: str) -> tuple[bytes, str]:
        requirement = self.get_entry(requirement_id)
        archive_name = f"arcbench-{requirement.id}-bundle.zip"
        entries = [
            (requirement.requirements_path.parent, f"{requirement.id}/requirements"),
            (requirement.tests_path, f"{requirement.id}/tests"),
        ]
        readme = self._build_benchmark_bundle_readme(requirement.category, [requirement])
        return self._build_zip_with_virtual_files(
            entries,
            [(f"{requirement.id}/README.md", readme)],
            archive_name,
        )

    def get_entry(self, requirement_id: str, rows: list[CatalogRequirementEntry] | None = None) -> CatalogRequirementEntry:
        entries = rows if rows is not None else self.scan_entries()
        for entry in entries:
            if entry.id == requirement_id:
                return entry
        raise LookupError(f"Requirement '{requirement_id}' not found")

    def _ensure_requirement_markdown(self, requirement: CatalogRequirementEntry) -> None:
        if not requirement.requirements_path.is_file():
            self._render_requirement_markdown(requirement.requirements_yaml_path)

    def get_requirement_tests(self, requirement_id: str) -> RequirementTests:
        requirement = self.get_entry(requirement_id)
        if not requirement.tests_path.is_dir():
            return RequirementTests()

        files: list[RequirementTestFile] = []
        for path in sorted(requirement.tests_path.rglob("*")):
            if not path.is_file() or path.name.startswith("."):
                continue
            try:
                content = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            files.append(RequirementTestFile(path=path.relative_to(requirement.tests_path).as_posix(), content=content))
        return RequirementTests(files=files)

    def _build_zip(self, entries: list[tuple[Path, str]], archive_name: str) -> tuple[bytes, str]:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for source, target in entries:
                if not source.exists():
                    continue
                if source.is_dir():
                    for path in sorted(source.rglob("*")):
                        if path.is_file():
                            archive.write(path, arcname=f"{target}/{path.relative_to(source).as_posix()}")
                else:
                    archive.write(source, arcname=target)
        return buffer.getvalue(), archive_name

    def _build_zip_with_virtual_files(
        self,
        entries: list[tuple[Path, str]],
        virtual_files: list[tuple[str, str]],
        archive_name: str,
    ) -> tuple[bytes, str]:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for source, target in entries:
                if not source.exists():
                    continue
                if source.is_dir():
                    for path in sorted(source.rglob("*")):
                        if path.is_file():
                            archive.write(path, arcname=f"{target}/{path.relative_to(source).as_posix()}")
                else:
                    archive.write(source, arcname=target)
            for target, content in virtual_files:
                archive.writestr(target, content)
        return buffer.getvalue(), archive_name

    def _to_requirement_summary(self, row: CatalogRequirementEntry, display_id: str) -> RequirementSummary:
        return RequirementSummary(
            id=row.id,
            display_id=display_id,
            title=row.title,
            category=row.category,
            summary=row.summary,
            test_runner=row.test_runner,
            total_tests=row.total_tests,
            module_count=row.module_count,
        )

    def _to_benchmark_task_summary(
        self,
        row: CatalogRequirementEntry,
        base_url: str,
        display_id: str,
    ) -> BenchmarkTaskSummary:
        return BenchmarkTaskSummary(
            id=row.id,
            display_id=display_id,
            title=row.title,
            category=row.category,
            summary=row.summary,
            test_runner=row.test_runner,
            total_tests=row.total_tests,
            module_count=row.module_count,
            downloads=BenchmarkDownloadLinks(
                task_bundle=f"{base_url}/api/benchmarks/tasks/{row.id}/download",
            ),
        )

    def _to_competition_task(
        self,
        row: CatalogRequirementEntry,
        base_url: str,
        is_public: bool,
        display_id: str,
    ) -> CompetitionTaskSummary:
        downloads = None
        if is_public:
            downloads = CompetitionTaskDownloadLinks(
                requirement_document=f"{base_url}/api/competitions/public/tasks/{row.id}/download/requirements",
                prerequisites_document=f"{base_url}/api/competitions/public/tasks/{row.id}/download/prerequisites",
                tests_bundle=f"{base_url}/api/competitions/public/tasks/{row.id}/download/tests",
                demo_bundle=f"{base_url}/api/competitions/public/tasks/{row.id}/download/demo",
                full_bundle=f"{base_url}/api/competitions/public/tasks/{row.id}/download/full",
            )
        return CompetitionTaskSummary(
            id=row.id,
            display_id=display_id,
            title=row.title,
            category=row.category,
            summary=row.summary,
            test_runner=row.test_runner,
            total_tests=row.total_tests,
            module_count=row.module_count,
            assets_base_url=f"{base_url}/api/requirements/{row.id}/assets?catalog=competition",
            references_base_url=f"{base_url}/api/requirements/{row.id}/references?catalog=competition",
            public_downloads=downloads,
        )

    @staticmethod
    def _build_display_id_map(rows: list[CatalogRequirementEntry]) -> dict[str, str]:
        grouped: dict[str, list[CatalogRequirementEntry]] = {}
        for row in rows:
            grouped.setdefault(row.category, []).append(row)

        display_ids: dict[str, str] = {}
        for _, items in sorted(grouped.items(), key=lambda item: RequirementCatalogService._competition_sort_key(item[0])):
            for index, row in enumerate(items, start=1):
                display_ids[row.id] = f"TASK-{index:03d}"
        return display_ids

    @staticmethod
    def _competition_sort_key(category: str) -> tuple[int, str]:
        priority = {
            "web": 0,
            "mobile": 1,
            "android": 1,
        }
        return (priority.get(category, 99), category)

    def _count_leaf_requirements(self, yaml_path: Path) -> int:
        if not yaml_path.exists():
            return 0
        parsed = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
        if not isinstance(parsed, dict):
            return 0
        return self._count_leaf_nodes(parsed)

    def _count_leaf_nodes(self, node: dict[str, Any]) -> int:
        children = node.get("children")
        if not isinstance(children, list) or len(children) == 0:
            return 1
        valid_children = [child for child in children if isinstance(child, dict)]
        if len(valid_children) == 0:
            return 1
        return sum(self._count_leaf_nodes(child) for child in valid_children)

    @staticmethod
    def _count_test_cases(tests_path: Path) -> int:
        if not tests_path.exists() or not tests_path.is_dir():
            return 0
        declaration = re.compile(r"\b(?:test|it)(?:\.(?:only|skip|todo|fails))?\s*\(")
        total = 0
        for path in tests_path.rglob("*"):
            if not path.is_file():
                continue
            try:
                source = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            total += len(declaration.findall(source))
        return total

    @staticmethod
    def _read_text_if_exists(path: Path) -> str:
        if not path.exists():
            return ""
        return path.read_text(encoding="utf-8")

    @staticmethod
    def _read_bytes_if_exists(path: Path) -> bytes:
        if not path.exists():
            return b""
        return path.read_bytes()

    @staticmethod
    def _competition_title(category: str) -> str:
        if category == "web":
            return "Web Competition"
        if category == "mobile":
            return "Mobile Competition"
        if category == "android":
            return "Mobile Competition"
        return f"{category.title()} Competition"

    @staticmethod
    def _competition_summary(category: str, task_count: int) -> str:
        if category == "web":
            return f"Browser-based product tasks with Playwright evaluation across {task_count} benchmark tasks."
        if category in {"mobile", "android"}:
            return f"Mobile application tasks across {task_count} benchmark tasks."
        return f"{task_count} benchmark tasks in the {category} track."

    @staticmethod
    def _benchmark_title(category: str) -> str:
        if category == "web":
            return "Web Applications"
        if category in {"mobile", "android"}:
            return "Mobile Applications"
        return f"{category.title()} Applications"

    @staticmethod
    def _benchmark_summary(category: str, task_count: int) -> str:
        if category == "web":
            return f"ARC-Bench web application tasks with executable test suites across {task_count} benchmarks."
        if category in {"mobile", "android"}:
            return f"ARC-Bench mobile application tasks across {task_count} benchmarks."
        return f"ARC-Bench tasks across {task_count} benchmarks in the {category} track."

    @staticmethod
    def _build_benchmark_bundle_readme(category: str, tasks: list[CatalogRequirementEntry]) -> str:
        title = RequirementCatalogService._benchmark_title(category)
        lines = [
            f"# ARC-Bench / {title}",
            "",
            "This archive contains the requirement documents and test suites for this ARC-Bench track.",
            "",
            "## Included",
            "",
            "- `requirements/<task>/` with every file from the task requirement directory",
            "- `tests/<task>/` containing the benchmark test cases",
            "",
            "## How to run tests",
            "",
            "1. Prepare the corresponding project template or generated implementation.",
            "2. Install the task runtime dependencies required by the target project.",
            "3. Run the provided test suite inside the benchmark runner environment.",
            "4. For web tasks, the tests are Playwright-based and expect the target app to be running.",
            "",
            "## Tasks",
            "",
        ]
        for item in tasks:
            lines.append(f"- `{item.id}`: {item.title}")
        lines.append("")
        return "\n".join(lines)

    @staticmethod
    def _extract_title(markdown: str, fallback: str) -> str:
        for line in markdown.splitlines():
            stripped = line.strip()
            if stripped:
                return stripped[2:].strip() if stripped.startswith("#") else stripped
        return fallback

    @staticmethod
    def _extract_summary(markdown: str) -> str:
        non_empty_lines = [line.strip() for line in markdown.splitlines() if line.strip()]
        if len(non_empty_lines) >= 2:
            return non_empty_lines[1]
        return ""
