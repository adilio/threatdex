"""
ETDA APT Groups scraper.

Scrapes https://apt.etda.or.th/cgi-bin/listgroups.cgi for the list of groups
and https://apt.etda.or.th/cgi-bin/showcard.cgi?g={name} for details.

The ETDA Thailand APT Groups database is a publicly accessible resource that
catalogues threat actor groups. This worker fetches the group list, then
retrieves the detail card for each group to build a ThreatActorData record.

Usage:
    python -m etda_sync.sync
    python sync.py
"""

from __future__ import annotations

import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests
from bs4 import BeautifulSoup
from slugify import slugify

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
_WORKERS_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKERS_ROOT not in sys.path:
    sys.path.insert(0, _WORKERS_ROOT)

from shared.db import get_engine, log_sync_complete, log_sync_error, log_sync_start, upsert_actor  # noqa: E402
from shared.dedup import find_matching_actor, merge_actors  # noqa: E402
from shared.models import SourceAttribution, ThreatActorData, TTPUsage  # noqa: E402
from shared.rarity import compute_rarity, compute_threat_level  # noqa: E402

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ETDA_BASE_URL = "https://apt.etda.or.th"
LIST_URL = f"{ETDA_BASE_URL}/cgi-bin/listgroups.cgi"
CARD_URL_TEMPLATE = f"{ETDA_BASE_URL}/cgi-bin/showcard.cgi?g={{group}}"

REQUEST_DELAY_SECONDS = 0.5  # polite crawl delay

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Country code lookup (subset sufficient for known APT origins)
# ---------------------------------------------------------------------------

_COUNTRY_CODES: dict[str, str] = {
    "china": "CN",
    "russia": "RU",
    "iran": "IR",
    "north korea": "KP",
    "vietnam": "VN",
    "india": "IN",
    "pakistan": "PK",
    "turkey": "TR",
    "israel": "IL",
    "united states": "US",
    "usa": "US",
    "united kingdom": "GB",
    "uk": "GB",
    "south korea": "KR",
    "ukraine": "UA",
    "bangladesh": "BD",
    "nigeria": "NG",
    "brazil": "BR",
    "unknown": "",
}

_MOTIVATION_KEYWORDS: dict[str, str] = {
    "espionage": "espionage",
    "intelligence": "espionage",
    "information theft": "espionage",
    "financial": "financial",
    "fraud": "financial",
    "banking": "financial",
    "sabotage": "sabotage",
    "disruption": "sabotage",
    "destruction": "sabotage",
    "hacktivism": "hacktivism",
    "ideology": "hacktivism",
    "military": "military",
    "defense": "military",
}


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _get(url: str, session: requests.Session, timeout: int = 30) -> requests.Response | None:
    """Perform a GET request and return the response, or None on error."""
    try:
        response = session.get(url, timeout=timeout)
        response.raise_for_status()
        return response
    except requests.RequestException as exc:
        logger.warning("HTTP error fetching %s: %s", url, exc)
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def _country_code(country_name: str) -> str:
    """Return the ISO 3166-1 alpha-2 code for a country name."""
    return _COUNTRY_CODES.get(country_name.lower().strip(), "")


def _map_motivation(text: str) -> list[str]:
    """Extract ThreatDex motivation enum values from free-form text."""
    lower = text.lower()
    found: list[str] = []
    for keyword, motivation in _MOTIVATION_KEYWORDS.items():
        if keyword in lower and motivation not in found:
            found.append(motivation)
    return found or ["espionage"]


def _parse_year(text: str) -> str | None:
    """Extract a 4-digit year from arbitrary text."""
    match = re.search(r"\b(19|20)\d{2}\b", text)
    return match.group(0) if match else None


def _parse_techniques(text: str) -> list[TTPUsage]:
    """Extract MITRE technique references (T1234 or T1234.001) from text."""
    ttps: list[TTPUsage] = []
    seen: set[str] = set()
    for match in re.finditer(r"\bT\d{4}(?:\.\d{3})?\b", text):
        tid = match.group(0)
        if tid not in seen:
            seen.add(tid)
            ttps.append(
                TTPUsage(
                    technique_id=tid,
                    technique_name="",  # name lookup requires MITRE bundle
                    tactic="",
                )
            )
    return ttps


def _clean_text(tag: Any) -> str:
    """Return stripped inner text from a BS4 tag, or empty string."""
    if tag is None:
        return ""
    return tag.get_text(separator=" ", strip=True)


# ---------------------------------------------------------------------------
# Public parsing functions
# ---------------------------------------------------------------------------


def parse_group_list(html: str) -> list[str]:
    """Extract the list of group name identifiers from the ETDA groups list page.

    The page renders an HTML table where each row contains a link to
    ``showcard.cgi?g=<GroupName>``. This function returns the ``<GroupName>``
    values so that the caller can build the card URLs.

    Parameters
    ----------
    html:
        Raw HTML of the ``listgroups.cgi`` response.

    Returns
    -------
    list[str]
        Group name identifiers (URL-encoded names as used in the ETDA URLs).
    """
    soup = BeautifulSoup(html, "html.parser")
    group_names: list[str] = []

    for a_tag in soup.find_all("a", href=True):
        href: str = a_tag["href"]
        match = re.search(r"showcard\.cgi\?g=([^&\"]+)", href)
        if match:
            name = match.group(1).strip()
            if name and name not in group_names:
                group_names.append(name)

    logger.info("Parsed %d group names from list page", len(group_names))
    return group_names


def parse_actor_page(html: str, group_name: str) -> ThreatActorData | None:
    """Parse a single ETDA showcard page into a ThreatActorData record.

    Parameters
    ----------
    html:
        Raw HTML of the ``showcard.cgi?g=<GroupName>`` response.
    group_name:
        The group identifier as used in the ETDA URL (used as fallback name).

    Returns
    -------
    ThreatActorData | None
        Parsed actor, or None if the page could not be parsed.
    """
    soup = BeautifulSoup(html, "html.parser")

    # ----------------------------------------------------------------
    # Extract canonical name from the page title or a prominent heading
    # ----------------------------------------------------------------
    canonical_name: str = group_name.replace("+", " ").replace("%20", " ").strip()

    title_tag = soup.find("title")
    if title_tag:
        title_text = _clean_text(title_tag)
        # ETDA titles are like "APT28 | ETDA APT"
        if "|" in title_text:
            canonical_name = title_text.split("|")[0].strip()
        elif title_text:
            canonical_name = title_text.strip()

    # Also check for h1/h2 headings
    for heading_tag in soup.find_all(["h1", "h2"]):
        text = _clean_text(heading_tag)
        if text and len(text) < 80:
            canonical_name = text
            break

    if not canonical_name:
        logger.warning("Could not determine canonical name for group %s", group_name)
        return None

    # ----------------------------------------------------------------
    # Extract all visible text for field inference
    # ----------------------------------------------------------------
    full_text = soup.get_text(separator="\n", strip=True)

    # ----------------------------------------------------------------
    # Aliases
    # ----------------------------------------------------------------
    aliases: list[str] = []
    alias_label_re = re.compile(r"alias(?:es)?[:\s]+(.+)", re.IGNORECASE)
    for line in full_text.splitlines():
        m = alias_label_re.search(line)
        if m:
            raw_aliases = re.split(r"[,;/]", m.group(1))
            for a in raw_aliases:
                a = a.strip().strip('"').strip("'")
                if a and a.lower() != canonical_name.lower() and a not in aliases:
                    aliases.append(a)
            break

    # Also look for an "Also known as" pattern
    aka_re = re.compile(r"also\s+known\s+as[:\s]+(.+)", re.IGNORECASE)
    for line in full_text.splitlines():
        m = aka_re.search(line)
        if m:
            for a in re.split(r"[,;/]", m.group(1)):
                a = a.strip()
                if a and a.lower() != canonical_name.lower() and a not in aliases:
                    aliases.append(a)

    # ----------------------------------------------------------------
    # Country
    # ----------------------------------------------------------------
    country: str | None = None
    country_code_val: str | None = None
    country_re = re.compile(r"(?:country|origin|nation|sponsored\s+by)[:\s]+([^\n,;]+)", re.IGNORECASE)
    for line in full_text.splitlines():
        m = country_re.search(line)
        if m:
            raw_country = m.group(1).strip().rstrip(".")
            country = raw_country
            code = _country_code(raw_country)
            country_code_val = code if code else None
            break

    # Fallback: scan for known country names in the full text
    if not country:
        text_lower = full_text.lower()
        for country_name, code in _COUNTRY_CODES.items():
            if country_name in text_lower and country_name != "unknown":
                country = country_name.title()
                country_code_val = code if code else None
                break

    # ----------------------------------------------------------------
    # Motivation
    # ----------------------------------------------------------------
    motivation = _map_motivation(full_text)

    # ----------------------------------------------------------------
    # Description — first substantial paragraph
    # ----------------------------------------------------------------
    description = ""
    for p_tag in soup.find_all("p"):
        text = _clean_text(p_tag)
        if len(text) > 40:
            description = text
            break
    if not description:
        # Fall back to first 500 chars of body text
        description = full_text[:500].strip()

    # ----------------------------------------------------------------
    # First / last seen years
    # ----------------------------------------------------------------
    first_seen: str | None = None
    last_seen: str | None = None

    first_seen_re = re.compile(r"(?:first\s+seen|active\s+since|since)[:\s]*(.{0,30})", re.IGNORECASE)
    last_seen_re = re.compile(r"(?:last\s+seen|last\s+active)[:\s]*(.{0,30})", re.IGNORECASE)

    lines = full_text.splitlines()
    for i, line in enumerate(lines):
        # Try same-line match first, then next-line fallback for label/value split
        if not first_seen:
            m = first_seen_re.search(line)
            if m:
                candidate = m.group(1).strip()
                first_seen = _parse_year(candidate) or (
                    _parse_year(lines[i + 1]) if i + 1 < len(lines) else None
                )
        if not last_seen:
            m = last_seen_re.search(line)
            if m:
                candidate = m.group(1).strip()
                last_seen = _parse_year(candidate) or (
                    _parse_year(lines[i + 1]) if i + 1 < len(lines) else None
                )

    # ----------------------------------------------------------------
    # Sectors
    # ----------------------------------------------------------------
    sectors: list[str] = []
    sector_re = re.compile(r"(?:target(?:ed)?\s+sector|industry|vertical)[:\s]+([^\n.]+)", re.IGNORECASE)
    for line in full_text.splitlines():
        m = sector_re.search(line)
        if m:
            for s in re.split(r"[,;]", m.group(1)):
                s = s.strip()
                if s and s not in sectors:
                    sectors.append(s)
            break

    # ----------------------------------------------------------------
    # Tools (look for a "Tools" or "Malware" section)
    # ----------------------------------------------------------------
    tools: list[str] = []
    tools_label_re = re.compile(r"^(?:tools?|malware|backdoor):?\s*$", re.IGNORECASE)
    tools_inline_re = re.compile(r"(?:tools?|malware|backdoor)[:\s]+([^\n.]+)", re.IGNORECASE)
    tool_lines = full_text.splitlines()
    for i, line in enumerate(tool_lines):
        # Inline pattern: "Tools: X-Agent, Sofacy"
        m = tools_inline_re.search(line)
        if m and m.group(1).strip():
            for t in re.split(r"[,;]", m.group(1)):
                t = t.strip()
                if t and t not in tools:
                    tools.append(t)
            continue
        # Label-only line followed by values on next line
        if tools_label_re.match(line.strip()) and i + 1 < len(tool_lines):
            for t in re.split(r"[,;]", tool_lines[i + 1]):
                t = t.strip()
                if t and t not in tools:
                    tools.append(t)

    # ----------------------------------------------------------------
    # TTPs from technique references in the page text
    # ----------------------------------------------------------------
    ttps = _parse_techniques(full_text)

    # ----------------------------------------------------------------
    # Sophistication (infer from description / labels)
    # ----------------------------------------------------------------
    sophistication = "Medium"
    soph_keywords = {
        "nation-state": "Nation-State Elite",
        "nation state": "Nation-State Elite",
        "state-sponsored": "Nation-State Elite",
        "advanced persistent": "Very High",
        "apt": "High",
        "sophisticated": "High",
        "basic": "Low",
        "script kiddie": "Low",
    }
    desc_lower = description.lower()
    for kw, tier in soph_keywords.items():
        if kw in desc_lower:
            sophistication = tier
            break

    # ----------------------------------------------------------------
    # Threat level + rarity
    # ----------------------------------------------------------------
    threat_level = compute_threat_level(
        sophistication=sophistication,
        ttps_count=len(ttps),
        campaigns_count=0,
    )
    source_url = CARD_URL_TEMPLATE.format(group=group_name)
    sources = [
        SourceAttribution(
            source="etda",
            source_id=group_name,
            fetched_at=_now_iso(),
            url=source_url,
        )
    ]
    rarity = compute_rarity(
        threat_level=threat_level,
        sophistication=sophistication,
        sources_count=len(sources),
    )

    return ThreatActorData(
        id=slugify(canonical_name, separator="-", lowercase=True),
        canonical_name=canonical_name,
        aliases=aliases,
        country=country,
        country_code=country_code_val,
        motivation=motivation,
        threat_level=threat_level,
        sophistication=sophistication,
        first_seen=first_seen,
        last_seen=last_seen,
        sectors=sectors,
        geographies=[],
        tools=tools,
        ttps=ttps,
        campaigns=[],
        description=description,
        rarity=rarity,
        sources=sources,
        tlp="WHITE",
        last_updated=_now_iso(),
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """Scrape the ETDA APT groups website and upsert all actors into the DB."""
    engine = get_engine()
    log_id = log_sync_start(engine, "etda")
    records_synced = 0

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "ThreatDex-Sync/1.0 (threat intelligence aggregator; "
                "https://github.com/threatdex/threatdex)"
            )
        }
    )

    try:
        list_response = _get(LIST_URL, session)
        if list_response is None:
            raise RuntimeError(f"Failed to fetch group list from {LIST_URL}")

        group_names = parse_group_list(list_response.text)
        logger.info("Found %d groups to process", len(group_names))

        for group_name in group_names:
            time.sleep(REQUEST_DELAY_SECONDS)

            card_url = CARD_URL_TEMPLATE.format(group=group_name)
            card_response = _get(card_url, session)
            if card_response is None:
                logger.warning("Skipping group %s — failed to fetch card page", group_name)
                continue

            try:
                actor = parse_actor_page(card_response.text, group_name)
                if actor is None:
                    logger.warning("Skipping group %s — parse returned None", group_name)
                    continue

                existing_id = find_matching_actor(engine, actor)
                if existing_id and existing_id != actor.id:
                    from sqlalchemy import text as _text
                    import json as _json
                    with engine.connect() as conn:
                        row = conn.execute(
                            _text("SELECT row_to_json(t) FROM threat_actors t WHERE id = :id"),
                            {"id": existing_id},
                        ).fetchone()
                    if row:
                        existing_dict = _json.loads(row[0]) if isinstance(row[0], str) else row[0]
                        actor = merge_actors(existing_dict, actor)

                upsert_actor(engine, actor)
                records_synced += 1
                logger.debug("Upserted %s", actor.canonical_name)

            except Exception:
                logger.warning(
                    "Failed to process group %s — skipping",
                    group_name,
                    exc_info=True,
                )

        log_sync_complete(engine, log_id, records_synced)
        logger.info("ETDA sync complete — %d actors upserted", records_synced)

    except Exception as exc:
        log_sync_error(engine, log_id, str(exc))
        logger.error("ETDA sync failed: %s", exc, exc_info=True)
        raise


if __name__ == "__main__":
    main()
