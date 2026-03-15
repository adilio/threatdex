"""
Rarity classification logic for ThreatDex actors.

Provides:
- compute_rarity()       — derive card rarity tier from level + sophistication
- compute_threat_level() — derive 1–10 score from available signals
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_SOPHISTICATION_SCORES: dict[str, int] = {
    "Nation-State Elite": 5,
    "Very High": 4,
    "High": 3,
    "Medium": 2,
    "Low": 1,
}

_VALID_SOPHISTICATION = set(_SOPHISTICATION_SCORES.keys())

# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def compute_rarity(
    threat_level: int,
    sophistication: str,
    sources_count: int,
) -> str:
    """Return the rarity tier for an actor card.

    Rules (evaluated in order — first match wins):
    - MYTHIC:    threat_level >= 9  AND sophistication == "Nation-State Elite"
    - LEGENDARY: threat_level >= 7  AND sophistication in {"Nation-State Elite", "Very High"}
    - EPIC:      threat_level >= 5  AND sophistication in {"Very High", "High"}
    - RARE:      everything else

    A small bonus is applied when the actor is corroborated by multiple
    independent sources (sources_count >= 3 bumps the effective level by 1).

    Parameters
    ----------
    threat_level:
        Integer 1–10.
    sophistication:
        One of the five valid sophistication strings.
    sources_count:
        Number of distinct source attributions for this actor.

    Returns
    -------
    str
        One of "MYTHIC", "LEGENDARY", "EPIC", "RARE".
    """
    effective_level = threat_level
    if sources_count >= 3:
        effective_level = min(10, effective_level + 1)

    if (
        effective_level >= 9
        and sophistication == "Nation-State Elite"
    ):
        return "MYTHIC"

    if effective_level >= 7 and sophistication in {
        "Nation-State Elite",
        "Very High",
    }:
        return "LEGENDARY"

    if effective_level >= 5 and sophistication in {"Very High", "High"}:
        return "EPIC"

    return "RARE"


def compute_threat_level(
    sophistication: str,
    ttps_count: int,
    campaigns_count: int,
) -> int:
    """Derive a 1–10 threat level score from available intelligence signals.

    Scoring formula:
    - Base score from sophistication tier (1–5)
    - +1 for every 5 distinct TTPs observed (capped at +3)
    - +1 for every 2 confirmed campaigns (capped at +2)
    - Final result is clamped to [1, 10]

    Parameters
    ----------
    sophistication:
        One of the five valid sophistication strings.
    ttps_count:
        Number of distinct TTP (technique) usages attributed to the actor.
    campaigns_count:
        Number of confirmed campaigns attributed to the actor.

    Returns
    -------
    int
        Integer threat level in [1, 10].
    """
    base = _SOPHISTICATION_SCORES.get(sophistication, 1)

    ttp_bonus = min(3, ttps_count // 5)
    campaign_bonus = min(2, campaigns_count // 2)

    score = base + ttp_bonus + campaign_bonus
    return max(1, min(10, score))
