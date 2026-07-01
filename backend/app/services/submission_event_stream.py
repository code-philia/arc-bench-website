from __future__ import annotations

import json
import queue
import threading
import time
from dataclasses import dataclass
from collections import defaultdict


@dataclass(frozen=True)
class SubmissionEventRefresh:
    submission: bool = False
    logs: bool = False
    commit_history: bool = False
    traceability_selected: bool = False
    traceability_all: bool = False
    preview: bool = False

    def to_payload(self) -> dict[str, bool]:
        return {
            "submission": self.submission,
            "logs": self.logs,
            "commit_history": self.commit_history,
            "traceability_selected": self.traceability_selected,
            "traceability_all": self.traceability_all,
            "preview": self.preview,
        }


@dataclass(frozen=True)
class SubmissionEvent:
    submission_id: str
    timestamp: float
    version: int
    refresh: SubmissionEventRefresh
    reason: str | None = None

    def to_payload(self) -> dict[str, object]:
        return {
            "submission_id": self.submission_id,
            "timestamp": self.timestamp,
            "version": self.version,
            "refresh": self.refresh.to_payload(),
            "reason": self.reason,
        }


class SubmissionEventStream:
    _lock = threading.Lock()
    _versions: dict[str, int] = defaultdict(int)
    _subscribers: dict[str, set[queue.Queue[SubmissionEvent | None]]] = defaultdict(set)

    @classmethod
    def publish(
        cls,
        submission_id: str,
        *,
        reason: str | None = None,
        submission: bool = False,
        logs: bool = False,
        commit_history: bool = False,
        traceability_selected: bool = False,
        traceability_all: bool = False,
        preview: bool = False,
    ) -> SubmissionEvent:
        with cls._lock:
            current_version = cls._versions[submission_id] + 1
            cls._versions[submission_id] = current_version
            event = SubmissionEvent(
                submission_id=submission_id,
                timestamp=time.time(),
                version=current_version,
                refresh=SubmissionEventRefresh(
                    submission=submission,
                    logs=logs,
                    commit_history=commit_history,
                    traceability_selected=traceability_selected,
                    traceability_all=traceability_all,
                    preview=preview,
                ),
                reason=reason,
            )
            subscribers = list(cls._subscribers.get(submission_id, set()))
        for subscriber in subscribers:
            try:
                subscriber.put_nowait(event)
            except queue.Full:
                continue
        return event

    @classmethod
    def snapshot(cls, submission_id: str) -> list[SubmissionEvent]:
        return []

    @classmethod
    def subscribe(cls, submission_id: str) -> queue.Queue[SubmissionEvent | None]:
        event_queue: queue.Queue[SubmissionEvent | None] = queue.Queue(maxsize=256)
        with cls._lock:
            cls._subscribers[submission_id].add(event_queue)
        return event_queue

    @classmethod
    def unsubscribe(cls, submission_id: str, event_queue: queue.Queue[SubmissionEvent | None]) -> None:
        with cls._lock:
            subscribers = cls._subscribers.get(submission_id)
            if subscribers is None:
                return
            subscribers.discard(event_queue)
            if not subscribers:
                cls._subscribers.pop(submission_id, None)

    @classmethod
    def shutdown(cls) -> None:
        with cls._lock:
            subscribers_by_submission = {
                submission_id: list(subscribers)
                for submission_id, subscribers in cls._subscribers.items()
            }
            cls._subscribers.clear()
        for subscribers in subscribers_by_submission.values():
            for subscriber in subscribers:
                try:
                    subscriber.put_nowait(None)
                except queue.Full:
                    continue

    @staticmethod
    def encode_sse(event: SubmissionEvent) -> str:
        payload = json.dumps(event.to_payload(), ensure_ascii=True)
        return f"event: submission-update\ndata: {payload}\n\n"
