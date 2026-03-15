from celery import Celery

from config import settings

celery_app = Celery(
    "threatdex",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    # Serialisation
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Task behaviour
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Result expiry — keep results for 24 hours
    result_expires=86400,
)

# Auto-discover tasks in the workers package (populated in later phases)
celery_app.autodiscover_tasks(["workers"])
