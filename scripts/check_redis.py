"""Check Redis connectivity and the primitives ARC-Bench workers require."""

from __future__ import annotations

import argparse
import os
import secrets
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Check ARC-Bench Redis connectivity and Streams support")
    parser.add_argument("--url-env", default="ARCBENCH_REDIS_URL")
    args = parser.parse_args()

    redis_url = os.environ.get(args.url_env, "").strip()
    if not redis_url:
        print(f"Set {args.url_env} to the Redis URL", file=sys.stderr)
        return 2

    try:
        import redis
    except ImportError:
        print("Redis client is not installed; run pip install -r backend/requirements.txt", file=sys.stderr)
        return 2

    token = secrets.token_hex(8)
    key = f"arcbench:health:{token}"
    stream = f"arcbench:health-stream:{token}"
    client = redis.Redis.from_url(
        redis_url,
        socket_connect_timeout=5,
        socket_timeout=5,
        decode_responses=True,
    )
    try:
        if not client.ping():
            raise RuntimeError("PING did not return PONG")
        client.set(key, "ok", ex=60)
        if client.get(key) != "ok":
            raise RuntimeError("key read/write check failed")
        event_id = client.xadd(stream, {"status": "ok"}, maxlen=10)
        events = client.xrange(stream, min=event_id, max=event_id)
        if not events or events[0][1].get("status") != "ok":
            raise RuntimeError("Redis Streams check failed")
        info = client.info(section="server")
        print(f"Redis PING/read-write/Streams: OK")
        print(f"Redis version: {info.get('redis_version', 'unknown')}")
    except Exception as exc:  # noqa: BLE001
        print(f"Redis check failed: {exc}", file=sys.stderr)
        return 1
    finally:
        try:
            client.delete(key, stream)
            client.close()
        except Exception:  # noqa: BLE001
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
