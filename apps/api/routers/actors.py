import io
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import cast, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from database import get_db
from models import ThreatActor
from schemas import PaginatedResponse, ThreatActorResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/actors", tags=["actors"])

# ── Rarity colour palette (brand colours) ────────────────────────────────────
_RARITY_COLORS = {
    "MYTHIC": (255, 255, 0),       # --color-surprising-yellow
    "LEGENDARY": (255, 11, 190),   # --color-vibrant-pink
    "EPIC": (97, 151, 255),        # --color-sky-blue
    "RARE": (2, 84, 236),          # --color-wiz-blue
}
_DEFAULT_COLOR = (23, 58, 170)     # --color-blue-shadow
_CARD_BG = (0, 18, 63)            # --color-serious-blue
_TEXT_COLOR = (255, 255, 255)
_CARD_W, _CARD_H = 400, 560


def _get_font(size: int) -> ImageFont.ImageFont:
    """Return a PIL font; falls back to default if no TTF available."""
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", size)
    except OSError:
        return ImageFont.load_default()


def _draw_card_base(actor: ThreatActor) -> Image.Image:
    """Create a base card image with background and rarity border."""
    img = Image.new("RGB", (_CARD_W, _CARD_H), _CARD_BG)
    draw = ImageDraw.Draw(img)

    rarity_color = _RARITY_COLORS.get(actor.rarity, _DEFAULT_COLOR)

    # Border
    border = 6
    draw.rectangle(
        [border, border, _CARD_W - border, _CARD_H - border],
        outline=rarity_color,
        width=border,
    )

    return img, draw, rarity_color  # type: ignore[return-value]


def _render_front(actor: ThreatActor) -> bytes:
    """Generate a placeholder card-front PNG with PIL."""
    img, draw, rarity_color = _draw_card_base(actor)  # type: ignore[misc]

    font_title = _get_font(22)
    font_sub = _get_font(14)
    font_stat = _get_font(12)

    # Actor name
    draw.text((20, 20), actor.canonical_name, font=font_title, fill=_TEXT_COLOR)

    # MITRE ID
    if actor.mitre_id:
        draw.text((20, 52), f"MITRE: {actor.mitre_id}", font=font_sub, fill=rarity_color)

    # Rarity badge
    badge_text = f"◆ {actor.rarity}"
    draw.text((_CARD_W - 130, 20), badge_text, font=font_sub, fill=rarity_color)

    # Hero area placeholder
    hero_y1, hero_y2 = 80, 300
    draw.rectangle([20, hero_y1, _CARD_W - 20, hero_y2], fill=(10, 30, 80), outline=rarity_color)
    draw.text(
        ((_CARD_W // 2) - 40, (hero_y1 + hero_y2) // 2 - 10),
        "[ image ]",
        font=font_sub,
        fill=(97, 151, 255),
    )

    # Stats
    stats_y = 315
    draw.text((20, stats_y), f"Threat Level: {actor.threat_level}/10", font=font_stat, fill=_TEXT_COLOR)
    draw.text((20, stats_y + 20), f"Sophistication: {actor.sophistication}", font=font_stat, fill=_TEXT_COLOR)
    draw.text((20, stats_y + 40), f"Country: {actor.country or 'Unknown'}", font=font_stat, fill=_TEXT_COLOR)
    draw.text(
        (20, stats_y + 60),
        f"Motivation: {', '.join(actor.motivation or [])}",
        font=font_stat,
        fill=_TEXT_COLOR,
    )

    # Tagline
    tagline = actor.tagline or ""
    if tagline:
        draw.text((20, stats_y + 90), f'"{tagline}"', font=font_stat, fill=(255, 191, 255))

    # TLP label
    draw.text((20, _CARD_H - 30), f"TLP:{actor.tlp}", font=font_stat, fill=_TEXT_COLOR)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _render_back(actor: ThreatActor) -> bytes:
    """Generate a placeholder card-back PNG with PIL."""
    img, draw, rarity_color = _draw_card_base(actor)  # type: ignore[misc]

    font_title = _get_font(18)
    font_sub = _get_font(13)
    font_small = _get_font(11)

    draw.text((20, 20), "THREAT PROFILE", font=font_title, fill=rarity_color)
    draw.text((20, 48), actor.canonical_name, font=font_sub, fill=_TEXT_COLOR)

    y = 80
    # Description (truncated)
    desc = actor.description[:200] + "…" if len(actor.description) > 200 else actor.description
    # Word-wrap manually
    words = desc.split()
    line, lines = [], []
    for word in words:
        test = " ".join(line + [word])
        if len(test) > 50:
            lines.append(" ".join(line))
            line = [word]
        else:
            line.append(word)
    if line:
        lines.append(" ".join(line))

    for text_line in lines[:6]:
        draw.text((20, y), text_line, font=font_small, fill=_TEXT_COLOR)
        y += 16

    y += 8
    draw.line([(20, y), (_CARD_W - 20, y)], fill=rarity_color, width=1)
    y += 8

    # Sectors
    draw.text((20, y), "Sectors:", font=font_sub, fill=rarity_color)
    y += 18
    sectors_text = ", ".join(actor.sectors[:5]) if actor.sectors else "—"
    draw.text((20, y), sectors_text, font=font_small, fill=_TEXT_COLOR)
    y += 20

    # Tools
    draw.text((20, y), "Tools:", font=font_sub, fill=rarity_color)
    y += 18
    tools_text = ", ".join(actor.tools[:5]) if actor.tools else "—"
    draw.text((20, y), tools_text, font=font_small, fill=_TEXT_COLOR)
    y += 20

    # TTPs
    draw.text((20, y), "TTPs:", font=font_sub, fill=rarity_color)
    y += 18
    ttps = actor.ttps or []
    ttp_text = ", ".join(t.get("techniqueId", "") for t in ttps[:5]) if ttps else "—"
    draw.text((20, y), ttp_text, font=font_small, fill=_TEXT_COLOR)
    y += 20

    # Sources
    draw.line([(20, _CARD_H - 40), (_CARD_W - 20, _CARD_H - 40)], fill=rarity_color, width=1)
    sources = actor.sources or []
    src_names = ", ".join({s.get("source", "") for s in sources}) if sources else "—"
    draw.text((20, _CARD_H - 28), f"Sources: {src_names}", font=font_small, fill=(97, 151, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ── List endpoint ─────────────────────────────────────────────────────────────


@router.get("", response_model=PaginatedResponse[ThreatActorResponse])
def list_actors(
    country: str | None = Query(default=None, description="Filter by country name"),
    motivation: str | None = Query(default=None, description="Filter by motivation value"),
    search: str | None = Query(default=None, description="Search canonical name and aliases"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PaginatedResponse[ThreatActorResponse]:
    q = db.query(ThreatActor)

    if country:
        q = q.filter(func.lower(ThreatActor.country) == country.lower())

    if motivation:
        # JSONB containment: motivation array contains the given value
        q = q.filter(ThreatActor.motivation.contains(cast([motivation.lower()], JSONB)))

    if search:
        pattern = f"%{search}%"
        q = q.filter(
            func.lower(ThreatActor.canonical_name).like(f"%{search.lower()}%")
            | func.cast(ThreatActor.aliases, type_=func.text()).like(pattern)
        )

    total = q.count()
    actors = q.order_by(ThreatActor.threat_level.desc()).offset(offset).limit(limit).all()

    return PaginatedResponse(
        items=[ThreatActorResponse.from_orm_model(a) for a in actors],
        total=total,
        limit=limit,
        offset=offset,
    )


# ── Detail endpoint ───────────────────────────────────────────────────────────


@router.get("/{actor_id}", response_model=ThreatActorResponse)
def get_actor(actor_id: str, db: Session = Depends(get_db)) -> ThreatActorResponse:
    actor = db.get(ThreatActor, actor_id)
    if actor is None:
        raise HTTPException(status_code=404, detail=f"Actor '{actor_id}' not found")
    return ThreatActorResponse.from_orm_model(actor)


# ── Card image endpoints ──────────────────────────────────────────────────────


@router.get("/{actor_id}/card/front", response_class=Response)
def card_front(actor_id: str, db: Session = Depends(get_db)) -> Response:
    actor = db.get(ThreatActor, actor_id)
    if actor is None:
        raise HTTPException(status_code=404, detail=f"Actor '{actor_id}' not found")

    png_bytes = _render_front(actor)
    return Response(content=png_bytes, media_type="image/png")


@router.get("/{actor_id}/card/back", response_class=Response)
def card_back(actor_id: str, db: Session = Depends(get_db)) -> Response:
    actor = db.get(ThreatActor, actor_id)
    if actor is None:
        raise HTTPException(status_code=404, detail=f"Actor '{actor_id}' not found")

    png_bytes = _render_back(actor)
    return Response(content=png_bytes, media_type="image/png")
