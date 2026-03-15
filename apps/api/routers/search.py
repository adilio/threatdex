import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import ThreatActor
from schemas import PaginatedResponse, ThreatActorResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=PaginatedResponse[ThreatActorResponse])
def search_actors(
    q: str = Query(..., description="Search query (minimum 2 characters)"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PaginatedResponse[ThreatActorResponse]:
    """
    Full-text search across canonical name, aliases, tools, and TTP technique names.

    Returns a paginated list of matching ThreatActorResponse objects.
    """
    if len(q.strip()) < 2:
        raise HTTPException(
            status_code=400,
            detail="Search query must be at least 2 characters long.",
        )

    pattern = f"%{q.lower()}%"

    query = db.query(ThreatActor).filter(
        func.lower(ThreatActor.canonical_name).like(pattern)
        # Aliases: cast the JSONB array to text for a simple substring search
        | func.cast(ThreatActor.aliases, type_=func.text()).like(f"%{q}%")
        # Tools array substring search
        | func.cast(ThreatActor.tools, type_=func.text()).like(f"%{q}%")
        # TTPs array substring search (covers technique names + IDs)
        | func.cast(ThreatActor.ttps, type_=func.text()).like(f"%{q}%")
    )

    total = query.count()
    actors = query.order_by(ThreatActor.threat_level.desc()).offset(offset).limit(limit).all()

    return PaginatedResponse(
        items=[ThreatActorResponse.from_orm_model(a) for a in actors],
        total=total,
        limit=limit,
        offset=offset,
    )
