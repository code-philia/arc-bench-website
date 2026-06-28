from __future__ import annotations

import json
import queue
import threading
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Literal


SubmissionEventChannel = Literal[
    "submission",
    "commit_history",
    "traceability_db",
    "requirement_state",
    "preview",
]


@dataclass(frozen=True)
class SubmissionEvent:
    submission_id: str
    channel: SubmissionEventChannel
    timestamp: float
    version: int
    reason: str | None = None

    def to_payload(self) -> dict[str, object]:
        return {
            "submission_id": self.submission_id,
            "channel": self.channel,
            "timestamp": self.timestamp,
            "version": self.version,
            "reason": self.reason,
        }


class SubmissionEventStream:
    _lock = threading.Lock()
    _versions: dict[str, dict[SubmissionEventChannel, int]] = defaultdict(dict)
    _subscribers: dict[str, set[queue.Queue[SubmissionEvent | None]]] = defaultdict(set)

    @classmethod
    def publish(
        cls,
        submission_id: str,
        channel: SubmissionEventChannel,
        *,
        reason: str | None = None,
    ) -> SubmissionEvent:
        with cls._lock:
            current_version = cls._versions[submission_id].get(channel, 0) + 1
            cls._versions[submission_id][channel] = current_version
            event = SubmissionEvent(
                submission_id=submission_id,
                channel=channel,
                timestamp=time.time(),
                version=current_version,
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
        with cls._lock:
            versions = dict(cls._versions.get(submission_id, {}))
        timestamp = time.time()
        return [
            SubmissionEvent(
                submission_id=submission_id,
                channel=channel,
                timestamp=timestamp,
                version=version,
                reason="snapshot",
            )
            for channel, version in sorted(versions.items())
        ]

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
