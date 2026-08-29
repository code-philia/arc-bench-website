from __future__ import annotations

import json
import logging
import queue
import threading
import time
from dataclasses import dataclass

import redis

from app.core.config import get_settings

LOG = logging.getLogger(__name__)
STREAM_MAXLEN = 1000
STREAM_RETENTION_SECONDS = 72 * 60 * 60


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
    stream_id: str | None = None

    def to_payload(self) -> dict[str, object]:
        return {
            "submission_id": self.submission_id,
            "timestamp": self.timestamp,
            "version": self.version,
            "refresh": self.refresh.to_payload(),
            "reason": self.reason,
        }


class RedisSubscription:
    def __init__(self, stream_key: str, client: redis.Redis, start_id: str = "$") -> None:
        self.queue: queue.Queue[SubmissionEvent | None] = queue.Queue(maxsize=256)
        self._client = client
        self._stream_key = stream_key
        self._last_id = start_id
        self._stopped = threading.Event()
        self._thread = threading.Thread(target=self._run, name="arcbench-sse", daemon=True)
        self._thread.start()

    def _run(self) -> None:
        while not self._stopped.is_set():
            try:
                rows = self._client.xread({self._stream_key: self._last_id}, count=100, block=5000)
                for _key, entries in rows:
                    for stream_id, fields in entries:
                        self._last_id = stream_id
                        event = SubmissionEventStream._from_redis(stream_id, fields)
                        try:
                            self.queue.put_nowait(event)
                        except queue.Full:
                            LOG.warning("SSE subscriber queue full for %s", self._stream_key)
            except (redis.RedisError, OSError):
                if not self._stopped.wait(1):
                    LOG.exception("Redis Streams subscription failed for %s", self._stream_key)

    def stop(self) -> None:
        self._stopped.set()
        try:
            self._client.close()
        except Exception:
            pass
        try:
            self.queue.put_nowait(None)
        except queue.Full:
            pass


class SubmissionEventStream:
    @staticmethod
    def _client() -> redis.Redis:
        return redis.Redis.from_url(get_settings().redis_url, decode_responses=True, socket_timeout=10)

    @staticmethod
    def _stream_key(submission_id: str) -> str:
        return f"arcbench:run:{submission_id}:events"

    @staticmethod
    def _version_key(submission_id: str) -> str:
        return f"arcbench:run:{submission_id}:event-version"

    @classmethod
    def publish(cls, submission_id: str, *, reason: str | None = None, submission: bool = False, logs: bool = False, commit_history: bool = False, traceability_selected: bool = False, traceability_all: bool = False, preview: bool = False) -> SubmissionEvent:
        client = cls._client()
        try:
            version = int(client.incr(cls._version_key(submission_id)))
            timestamp = time.time()
            payload = SubmissionEvent(
                submission_id=submission_id,
                timestamp=timestamp,
                version=version,
                refresh=SubmissionEventRefresh(submission, logs, commit_history, traceability_selected, traceability_all, preview),
                reason=reason,
            )
            stream_id = client.xadd(
                cls._stream_key(submission_id),
                {"payload": json.dumps(payload.to_payload(), ensure_ascii=True), "created_at": str(timestamp)},
                maxlen=STREAM_MAXLEN,
                approximate=True,
            )
            client.expire(cls._stream_key(submission_id), STREAM_RETENTION_SECONDS)
            return SubmissionEvent(**{**payload.__dict__, "stream_id": stream_id})
        finally:
            client.close()

    @classmethod
    def _from_redis(cls, stream_id: str, fields: dict[str, str]) -> SubmissionEvent:
        payload = json.loads(fields["payload"])
        refresh = SubmissionEventRefresh(**payload.get("refresh", {}))
        return SubmissionEvent(
            payload["submission_id"],
            float(payload["timestamp"]),
            int(payload["version"]),
            refresh,
            payload.get("reason"),
            stream_id,
        )

    @classmethod
    def snapshot(cls, submission_id: str, since_version: int = 0) -> list[SubmissionEvent]:
        client = cls._client()
        try:
            rows = client.xrange(cls._stream_key(submission_id), min="-", max="+")
            events = [cls._from_redis(stream_id, fields) for stream_id, fields in rows]
            return [event for event in events if event.version > since_version]
        finally:
            client.close()

    @classmethod
    def subscribe(cls, submission_id: str) -> RedisSubscription:
        return RedisSubscription(cls._stream_key(submission_id), cls._client())

    @staticmethod
    def unsubscribe(_submission_id: str, subscription: RedisSubscription) -> None:
        subscription.stop()

    @staticmethod
    def shutdown() -> None:
        return None

    @staticmethod
    def encode_sse(event: SubmissionEvent) -> str:
        payload = json.dumps(event.to_payload(), ensure_ascii=True)
        return f"id: {event.version}\nevent: submission-update\ndata: {payload}\n\n"
