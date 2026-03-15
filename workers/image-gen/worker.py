"""
AI hero image generation worker.

Feature-flagged: skips gracefully if OPENAI_API_KEY is not set.
Uses OpenAI DALL-E 3 to generate card hero images for ThreatDex threat actors.

Each actor gets a unique cyberpunk-style hero image derived from their
intelligence profile (country, sophistication, motivation, tools, etc.).

Usage (direct):
    OPENAI_API_KEY=<key> python worker.py <actor_id>

Usage (Celery):
    celery -A image_gen.worker worker --loglevel=info
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
_WORKERS_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKERS_ROOT not in sys.path:
    sys.path.insert(0, _WORKERS_ROOT)

# ---------------------------------------------------------------------------
# Optional imports — never crash if a library is absent
# ---------------------------------------------------------------------------
try:
    import openai as _openai_module
    _OPENAI_AVAILABLE = True
except ImportError:
    _openai_module = None  # type: ignore[assignment]
    _OPENAI_AVAILABLE = False

try:
    from celery import Celery
    _CELERY_AVAILABLE = True
except ImportError:
    Celery = None  # type: ignore[assignment,misc]
    _CELERY_AVAILABLE = False

try:
    import requests as _requests_module
    _REQUESTS_AVAILABLE = True
except ImportError:
    _requests_module = None  # type: ignore[assignment]
    _REQUESTS_AVAILABLE = False

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

IMAGE_OUTPUT_DIR = Path(os.environ.get("IMAGE_OUTPUT_DIR", "./images"))
IMAGE_SIZE = "1024x1024"
IMAGE_QUALITY = "standard"
IMAGE_MODEL = "dall-e-3"

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Celery app — only instantiated if Celery is available
# ---------------------------------------------------------------------------

if _CELERY_AVAILABLE and Celery is not None:
    celery_app = Celery("image_gen", broker=REDIS_URL, backend=REDIS_URL)
    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
    )
else:
    celery_app = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

_SOPHISTICATION_DESCRIPTORS: dict[str, str] = {
    "Nation-State Elite": "elite nation-state threat actor, cutting-edge cyber warfare capabilities",
    "Very High": "highly sophisticated advanced persistent threat",
    "High": "sophisticated professional hacker group",
    "Medium": "moderately skilled cybercriminal collective",
    "Low": "script kiddie or low-skill threat actor",
}

_MOTIVATION_DESCRIPTORS: dict[str, str] = {
    "espionage": "intelligence gathering and cyber espionage",
    "financial": "financially motivated cybercrime and theft",
    "sabotage": "destructive cyberattacks and sabotage",
    "hacktivism": "ideologically motivated hacktivism",
    "military": "military cyber operations and warfare",
}

_RARITY_STYLE: dict[str, str] = {
    "MYTHIC": (
        "legendary holographic foil card, bright yellow aura, "
        "mythic-tier god-like power, chromatic rainbow shimmer"
    ),
    "LEGENDARY": (
        "legendary golden foil card, deep orange glow, "
        "legendary aura, metallic sheen"
    ),
    "EPIC": (
        "epic purple holographic card, violet glow, "
        "powerful epic-tier energy field"
    ),
    "RARE": (
        "rare blue holographic card, cool blue shimmer, "
        "rare-tier energy aura"
    ),
}


def build_image_prompt(actor: dict[str, Any]) -> str:
    """Build a DALL-E image generation prompt from a threat actor record.

    The prompt uses the actor's country, sophistication, motivation, tools,
    and rarity tier to generate a contextually appropriate cyberpunk trading
    card illustration.

    Parameters
    ----------
    actor:
        Threat actor record as a dict (as returned by to_db_dict or DB query).

    Returns
    -------
    str
        A detailed image generation prompt string.
    """
    name: str = actor.get("canonical_name") or actor.get("id", "Unknown Actor")
    country: str | None = actor.get("country")
    sophistication: str = actor.get("sophistication") or "High"
    motivation: list[str] = actor.get("motivation") or ["espionage"]
    tools: list[str] = actor.get("tools") or []
    rarity: str = actor.get("rarity") or "RARE"

    # Core style constants
    base_style = (
        "cyberpunk trading card art, dark navy blue background (#00123F), "
        "glowing circuit board patterns, neon accent lighting, "
        "Wiz-style security aesthetic, dramatic lighting, high detail"
    )

    # Sophistication description
    soph_desc = _SOPHISTICATION_DESCRIPTORS.get(sophistication, "skilled threat actor")

    # Motivation description (take the first / primary one)
    primary_motivation = motivation[0] if motivation else "espionage"
    motiv_desc = _MOTIVATION_DESCRIPTORS.get(primary_motivation, "cyber operations")

    # Country aesthetic
    country_aesthetic = ""
    if country:
        country_aesthetic = f", {country} cultural aesthetic elements, "

    # Tool references (limit to 3 for conciseness)
    tool_desc = ""
    if tools:
        tool_names = tools[:3]
        tool_desc = f"associated with tools like {', '.join(tool_names)}, "

    # Rarity visual style
    rarity_style = _RARITY_STYLE.get(rarity, _RARITY_STYLE["RARE"])

    # Antagonist figure description
    figure_desc = (
        f"shadowy hacker figure representing a {soph_desc}, "
        f"engaged in {motiv_desc}"
    )

    prompt = (
        f"{base_style}. "
        f"{figure_desc}{country_aesthetic}"
        f"{tool_desc}"
        f"{rarity_style}. "
        f"Card title area reserved at top reading '{name}'. "
        f"Cinematic composition, portrait orientation, ultra-detailed, "
        f"digital art, trending on artstation."
    )

    return prompt


# ---------------------------------------------------------------------------
# Image download helper
# ---------------------------------------------------------------------------


def _download_image(url: str, output_path: Path) -> bool:
    """Download an image from a URL and save it to disk.

    Parameters
    ----------
    url:
        Direct URL of the generated image.
    output_path:
        Local filesystem path to save to.

    Returns
    -------
    bool
        True on success, False on any error.
    """
    if not _REQUESTS_AVAILABLE or _requests_module is None:
        logger.error("requests library is not available — cannot download image")
        return False

    try:
        response = _requests_module.get(url, timeout=60)
        response.raise_for_status()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(response.content)
        logger.info("Saved image to %s (%d bytes)", output_path, len(response.content))
        return True
    except Exception as exc:
        logger.error("Failed to download image from %s: %s", url, exc)
        return False


# ---------------------------------------------------------------------------
# Core generation function
# ---------------------------------------------------------------------------


def _get_openai_key() -> str | None:
    return os.environ.get("OPENAI_API_KEY") or None


def generate_image_for_actor(actor: dict[str, Any]) -> str | None:
    """Generate a hero image for a threat actor and return the local file path.

    Skips gracefully if OPENAI_API_KEY is not configured or OpenAI library
    is unavailable. Does not raise exceptions on API failures — instead logs
    the error and returns None.

    Parameters
    ----------
    actor:
        Threat actor record dict (must contain at minimum ``id``).

    Returns
    -------
    str | None
        Absolute path to the saved image file, or None if generation failed/skipped.
    """
    api_key = _get_openai_key()
    if not api_key:
        logger.warning(
            "OPENAI_API_KEY is not set — skipping image generation for actor %s",
            actor.get("id", "unknown"),
        )
        return None

    if not _OPENAI_AVAILABLE or _openai_module is None:
        logger.warning("openai library is not installed — skipping image generation")
        return None

    actor_id: str = actor.get("id", "unknown")
    prompt = build_image_prompt(actor)

    logger.info("Generating image for actor %s (prompt: %d chars)", actor_id, len(prompt))

    try:
        client = _openai_module.OpenAI(api_key=api_key)
        response = client.images.generate(
            model=IMAGE_MODEL,
            prompt=prompt,
            size=IMAGE_SIZE,  # type: ignore[arg-type]
            quality=IMAGE_QUALITY,  # type: ignore[arg-type]
            n=1,
        )
        image_url: str | None = response.data[0].url if response.data else None
        if not image_url:
            logger.error("OpenAI returned no image URL for actor %s", actor_id)
            return None

        output_path = IMAGE_OUTPUT_DIR / f"{actor_id}.png"
        success = _download_image(image_url, output_path)
        if not success:
            return None

        return str(output_path.resolve())

    except Exception as exc:
        logger.error(
            "Image generation failed for actor %s: %s", actor_id, exc, exc_info=True
        )
        return None


def _update_actor_image_url(engine: Any, actor_id: str, image_url: str) -> None:
    """Persist the generated image URL back to the threat_actors table."""
    from sqlalchemy import text as _text

    with engine.begin() as conn:
        conn.execute(
            _text(
                "UPDATE threat_actors SET image_url = :url, "
                "last_updated = :ts WHERE id = :id"
            ),
            {
                "url": image_url,
                "ts": datetime.now(timezone.utc).isoformat(),
                "id": actor_id,
            },
        )
    logger.info("Updated image_url for actor %s", actor_id)


# ---------------------------------------------------------------------------
# Celery task
# ---------------------------------------------------------------------------


def _make_celery_task(app: Any) -> Any:
    """Factory that creates the Celery task bound to the given app."""

    @app.task(bind=True, max_retries=2, default_retry_delay=60)
    def generate_actor_image(self: Any, actor_id: str) -> str | None:
        """Celery task: generate and persist a hero image for a threat actor.

        Parameters
        ----------
        actor_id:
            The slug ID of the actor to process (e.g. ``"apt28"``).

        Returns
        -------
        str | None
            Local file path of the generated image, or None if skipped/failed.
        """
        from shared.db import get_engine
        from sqlalchemy import text as _text
        import json as _json

        logger.info("Celery task generate_actor_image started for %s", actor_id)

        # Feature-flag check
        if not _get_openai_key():
            logger.warning(
                "OPENAI_API_KEY not set — skipping image generation task for %s",
                actor_id,
            )
            return None

        try:
            engine = get_engine()

            with engine.connect() as conn:
                row = conn.execute(
                    _text("SELECT row_to_json(t) FROM threat_actors t WHERE id = :id"),
                    {"id": actor_id},
                ).fetchone()

            if not row:
                logger.warning("Actor %s not found in database", actor_id)
                return None

            actor_dict = _json.loads(row[0]) if isinstance(row[0], str) else row[0]
            image_path = generate_image_for_actor(actor_dict)

            if image_path:
                _update_actor_image_url(engine, actor_id, image_path)

            return image_path

        except Exception as exc:
            logger.error(
                "Celery task failed for actor %s: %s", actor_id, exc, exc_info=True
            )
            raise self.retry(exc=exc)

    return generate_actor_image


# Instantiate the task only if Celery is available
if celery_app is not None:
    generate_actor_image = _make_celery_task(celery_app)
else:
    # Fallback no-op function when Celery is not installed
    def generate_actor_image(actor_id: str) -> str | None:  # type: ignore[misc]
        """Fallback when Celery is not installed — calls generate_image_for_actor directly."""
        logger.warning("Celery not available; running image generation synchronously")
        from shared.db import get_engine
        from sqlalchemy import text as _text
        import json as _json

        engine = get_engine()
        with engine.connect() as conn:
            row = conn.execute(
                _text("SELECT row_to_json(t) FROM threat_actors t WHERE id = :id"),
                {"id": actor_id},
            ).fetchone()
        if not row:
            return None
        actor_dict = _json.loads(row[0]) if isinstance(row[0], str) else row[0]
        image_path = generate_image_for_actor(actor_dict)
        if image_path:
            _update_actor_image_url(engine, actor_id, image_path)
        return image_path


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python worker.py <actor_id>")
        sys.exit(1)

    _actor_id = sys.argv[1]

    _api_key = _get_openai_key()
    if not _api_key:
        logger.warning("OPENAI_API_KEY is not set — image generation will be skipped")

    # Run synchronously when invoked directly (no Celery broker needed)
    from shared.db import get_engine
    from sqlalchemy import text as _text
    import json as _json

    _engine = get_engine()
    with _engine.connect() as _conn:
        _row = _conn.execute(
            _text("SELECT row_to_json(t) FROM threat_actors t WHERE id = :id"),
            {"id": _actor_id},
        ).fetchone()

    if not _row:
        logger.error("Actor '%s' not found in database", _actor_id)
        sys.exit(1)

    _actor_dict = _json.loads(_row[0]) if isinstance(_row[0], str) else _row[0]
    _result = generate_image_for_actor(_actor_dict)
    if _result:
        _update_actor_image_url(_engine, _actor_id, _result)
        logger.info("Done — image saved to %s", _result)
    else:
        logger.warning("Image generation skipped or failed for %s", _actor_id)
