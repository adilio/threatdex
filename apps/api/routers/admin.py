import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from config import settings
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

_VALID_SOURCES = {"mitre", "etda", "otx", "misp", "opencti"}


def _verify_admin(admin_secret: str | None = Header(default=None, alias="ADMIN_SECRET")) -> None:
    """Dependency that validates the ADMIN_SECRET request header."""
    if not admin_secret or admin_secret != settings.ADMIN_SECRET:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid ADMIN_SECRET header.",
        )


@router.post("/sync/{source}")
def trigger_sync(
    source: str,
    db: Session = Depends(get_db),  # noqa: ARG001 — reserved for future use
    _: None = Depends(_verify_admin),
) -> Dict[str, Any]:
    """
    Trigger a manual data synchronisation for the specified CTI source.

    Requires the ``ADMIN_SECRET`` header to match the configured secret.
    Valid sources: mitre, etda, otx, misp, opencti.
    """
    if source not in _VALID_SOURCES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown source '{source}'. Valid sources: {sorted(_VALID_SOURCES)}",
        )

    # Attempt to enqueue a Celery task; degrade gracefully if Celery/Redis is unavailable.
    try:
        from celery_app import celery_app  # noqa: PLC0415

        task_name = f"workers.{source}_sync.sync"
        celery_app.send_task(task_name, kwargs={"source": source})
        logger.info("Queued sync task for source '%s'", source)
    except Exception as exc:
        logger.warning(
            "Could not enqueue Celery task for source '%s': %s — running is no-op", source, exc
        )

    return {"status": "queued", "source": source}
