from __future__ import annotations

from dataclasses import dataclass
import importlib.util
import sys
import threading
from pathlib import Path
from types import ModuleType
from typing import Any


_MODULE_LOCK = threading.Lock()
_DEMO_AGENT_MAIN_MODULE: ModuleType | None = None


@dataclass(frozen=True)
class DemoReplayPaths:
    source_template_dir: Path
    queue_path: Path
    tasks_dir: Path


@dataclass(frozen=True)
class DemoReplayStep:
    index: int
    node_id: str
    phase: str
    commit_message: str
    source_commit: str
    interfaces: list[dict[str, Any]]
    tests: list[dict[str, Any]]
    implemented_interface_ids: list[str]
    passed_test_ids: list[str]


def resolve_demo_replay_paths(workspace_path: Path) -> DemoReplayPaths | None:
    source_template_dir = workspace_path / "submission" / "template"
    queue_path = source_template_dir / "arc-replay" / "queue.json"
    tasks_dir = source_template_dir / "arc-replay" / "tasks"
    if not source_template_dir.is_dir() or not queue_path.is_file() or not tasks_dir.is_dir():
        return None
    return DemoReplayPaths(
        source_template_dir=source_template_dir,
        queue_path=queue_path,
        tasks_dir=tasks_dir,
    )


def load_demo_replay_steps(workspace_path: Path, replay_paths: DemoReplayPaths) -> list[DemoReplayStep]:
    module = load_demo_agent_module()
    config = module.ReplayConfig(
        requirement_dir=workspace_path / "task",
        source_template_dir=replay_paths.source_template_dir,
        queue_path=replay_paths.queue_path,
        tasks_dir=replay_paths.tasks_dir,
        target_template_dir=workspace_path / "template",
        artifacts_dir=workspace_path / "artifacts",
        submission_dir=workspace_path / "submission",
        step_delay_seconds=0.0,
        interface_delay_seconds=0.0,
        test_delay_seconds=0.0,
        phase_delay_seconds=0.0,
        interface_group_delay_seconds=0.0,
        test_group_delay_seconds=0.0,
        before_node_pass_delay_seconds=0.0,
    )
    raw_steps = module.load_steps(config)
    steps: list[DemoReplayStep] = []
    for raw_step in raw_steps:
        steps.append(
            DemoReplayStep(
                index=int(raw_step.index),
                node_id=str(raw_step.node_id),
                phase=str(raw_step.phase),
                commit_message=str(raw_step.commit_message),
                source_commit=str(raw_step.source_commit),
                interfaces=[dict(item) for item in raw_step.interfaces],
                tests=[dict(item) for item in raw_step.tests],
                implemented_interface_ids=[str(item) for item in raw_step.implemented_interface_ids],
                passed_test_ids=[str(item) for item in raw_step.passed_test_ids],
            )
        )
    return steps


def find_replay_step_index(steps: list[DemoReplayStep], *, node_id: str, phase: str) -> int:
    normalized_node_id = str(node_id or "").strip()
    normalized_phase = str(phase or "").strip().lower()
    for step in steps:
        if step.node_id == normalized_node_id and step.phase == normalized_phase:
            return step.index
    return 0


def _load_demo_agent_main_module() -> ModuleType:
    global _DEMO_AGENT_MAIN_MODULE
    with _MODULE_LOCK:
        if _DEMO_AGENT_MAIN_MODULE is not None:
            return _DEMO_AGENT_MAIN_MODULE

        repo_root = Path(__file__).resolve().parents[3]
        runtime_root = repo_root / "runtime" / "demo-agent"
        main_path = runtime_root / "main.py"
        if not main_path.is_file():
            raise FileNotFoundError(f"Demo agent main.py not found: {main_path}")
        runtime_root_str = str(runtime_root)
        if runtime_root_str not in sys.path:
            sys.path.insert(0, runtime_root_str)
        spec = importlib.util.spec_from_file_location("_arcbench_demo_agent_main", main_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Unable to load demo agent module from {main_path}")
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        try:
            spec.loader.exec_module(module)
        except Exception:
            sys.modules.pop(spec.name, None)
            raise
        _DEMO_AGENT_MAIN_MODULE = module
        return module


def load_demo_agent_module() -> ModuleType:
    return _load_demo_agent_main_module()
