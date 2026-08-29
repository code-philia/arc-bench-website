"""Shared Celery application configuration.

Tasks are imported lazily when the task module exists so that the API can be
started while the queue migration is being developed. Workers should only be
started after ``app.worker.tasks`` has been implemented.
"""

from celery import Celery

from app.core.config import get_settings


settings = get_settings()

celery_app = Celery(
    "arcbench",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    # A task is acknowledged after execution. If a worker dies mid-run,
    # Redis can make the message visible again after visibility_timeout.
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_time_limit=settings.worker_hard_time_limit_seconds,
    task_soft_time_limit=settings.worker_soft_time_limit_seconds,
    worker_concurrency=settings.max_concurrent_runs,
    task_default_queue="evaluation.default",
    task_default_exchange="evaluation",
    task_default_routing_key="evaluation.default",
    task_queues={
        "evaluation.default": {"exchange": "evaluation", "routing_key": "evaluation.default"},
        "evaluation.retry": {"exchange": "evaluation", "routing_key": "evaluation.retry"},
    },
    broker_transport_options={
        # Must exceed the hard limit, otherwise a long task can be redelivered
        # while it is still running.
        "visibility_timeout": max(7200, settings.worker_hard_time_limit_seconds + 300),
        "global_keyprefix": "arcbench:",
    },
    result_expires=86400,
    task_ignore_result=False,
)

# Register application tasks when the Celery app is imported. The import is at
# the end so ``tasks.py`` can safely import ``celery_app`` above.
from app.worker import tasks as _tasks  # noqa: E402,F401
