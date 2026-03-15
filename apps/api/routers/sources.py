import logging
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import SyncLog
from schemas import SourceStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sources", tags=["sources"])

_ALL_SOURCES = ["mitre", "etda", "otx", "misp", "opencti"]


@router.get("", response_model=List[SourceStatus])
def list_sources(db: Session = Depends(get_db)) -> List[SourceStatus]:
    """
    Return a list of all known CTI sources with their most recent sync metadata.

    If a source has never been synced it is still returned with null timestamps.
    """
    results: List[SourceStatus] = []

    for source_name in _ALL_SOURCES:
        # Most recent completed (or any) sync log for this source
        log: SyncLog | None = (
            db.query(SyncLog)
            .filter(SyncLog.source == source_name)
            .order_by(SyncLog.started_at.desc())
            .first()
        )

        if log:
            results.append(
                SourceStatus(
                    source=source_name,
                    last_sync=log.completed_at or log.started_at,
                    status=log.status,
                    records_synced=log.records_synced,
                )
            )
        else:
            results.append(SourceStatus(source=source_name))

    return results
