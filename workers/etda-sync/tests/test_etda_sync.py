"""
Unit tests for the ETDA APT groups scraper.

All network calls are mocked so these tests run offline and in CI.
"""

from __future__ import annotations

import sys
import os

import pytest

# ---------------------------------------------------------------------------
# Path setup
# The worker directory name ("etda-sync") contains a hyphen and cannot be
# imported as a Python package directly. We load sync.py explicitly via
# importlib to give it a unique module name, avoiding collisions when all
# test suites are collected in the same pytest session.
# ---------------------------------------------------------------------------
import importlib.util

_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_WORKER_DIR = os.path.dirname(_TESTS_DIR)
_WORKERS_ROOT = os.path.dirname(_WORKER_DIR)

if _WORKERS_ROOT not in sys.path:
    sys.path.insert(0, _WORKERS_ROOT)

_spec = importlib.util.spec_from_file_location(
    "etda_sync_module",
    os.path.join(_WORKER_DIR, "sync.py"),
)
_etda_sync = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
sys.modules["etda_sync_module"] = _etda_sync
_spec.loader.exec_module(_etda_sync)  # type: ignore[union-attr]

_map_motivation = _etda_sync._map_motivation
_parse_techniques = _etda_sync._parse_techniques
_parse_year = _etda_sync._parse_year
parse_actor_page = _etda_sync.parse_actor_page
parse_group_list = _etda_sync.parse_group_list

from shared.models import ThreatActorData  # noqa: E402

# ---------------------------------------------------------------------------
# Sample HTML fixtures
# ---------------------------------------------------------------------------

SAMPLE_LIST_HTML = """
<!DOCTYPE html>
<html>
<head><title>APT Groups | ETDA</title></head>
<body>
<table>
  <tr>
    <td><a href="/cgi-bin/showcard.cgi?g=APT28">APT28</a></td>
    <td>Russia</td>
  </tr>
  <tr>
    <td><a href="/cgi-bin/showcard.cgi?g=Lazarus+Group">Lazarus Group</a></td>
    <td>North Korea</td>
  </tr>
  <tr>
    <td><a href="/cgi-bin/showcard.cgi?g=APT41">APT41</a></td>
    <td>China</td>
  </tr>
  <tr>
    <!-- Not a showcard link — should be ignored -->
    <td><a href="/about">About</a></td>
  </tr>
</table>
</body>
</html>
"""

SAMPLE_CARD_HTML_FULL = """
<!DOCTYPE html>
<html>
<head><title>APT28 | ETDA APT Groups</title></head>
<body>
<h1>APT28</h1>
<p>
  APT28 is a sophisticated, state-sponsored threat group attributed to Russia's GRU.
  It has been active since at least 2004 and targets government, military, and
  defence organizations worldwide. The group is also known as Fancy Bear and Sofacy.
</p>

<div class="field">
  <span class="label">Aliases:</span> Fancy Bear, Sofacy, STRONTIUM, Pawn Storm
</div>

<div class="field">
  <span class="label">Country:</span> Russia
</div>

<div class="field">
  <span class="label">Motivation:</span> Espionage, Intelligence gathering
</div>

<div class="field">
  <span class="label">First seen:</span> 2004
</div>

<div class="field">
  <span class="label">Last seen:</span> 2023
</div>

<div class="field">
  <span class="label">Target sector:</span> Government, Military, Defence, Energy
</div>

<div class="field">
  <span class="label">Tools:</span> X-Agent, Sofacy, LoJax, Zebrocy
</div>

<div class="technique">
  Techniques used: T1566, T1059.001, T1071.001, T1003
</div>
</body>
</html>
"""

SAMPLE_CARD_HTML_MINIMAL = """
<!DOCTYPE html>
<html>
<head><title>Unknown Group | ETDA APT Groups</title></head>
<body>
<h1>Unknown Group</h1>
<p>This group has limited public information available.</p>
</body>
</html>
"""

SAMPLE_CARD_HTML_NO_HEADING = """
<!DOCTYPE html>
<html>
<head><title>MysteryAPT | ETDA APT Groups</title></head>
<body>
<p>A threat actor operating in the financial sector. Active since 2019. Uses banking trojans.</p>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Test: parse_group_list
# ---------------------------------------------------------------------------


class TestParseGroupList:
    def test_returns_list_of_strings(self) -> None:
        result = parse_group_list(SAMPLE_LIST_HTML)
        assert isinstance(result, list)
        assert all(isinstance(s, str) for s in result)

    def test_extracts_known_groups(self) -> None:
        result = parse_group_list(SAMPLE_LIST_HTML)
        assert "APT28" in result
        assert "Lazarus+Group" in result
        assert "APT41" in result

    def test_ignores_non_showcard_links(self) -> None:
        result = parse_group_list(SAMPLE_LIST_HTML)
        assert "about" not in result
        assert "/about" not in result

    def test_no_duplicates(self) -> None:
        duplicate_html = SAMPLE_LIST_HTML.replace(
            "</table>",
            '<tr><td><a href="/cgi-bin/showcard.cgi?g=APT28">APT28 again</a></td></tr></table>',
        )
        result = parse_group_list(duplicate_html)
        assert result.count("APT28") == 1

    def test_empty_page_returns_empty_list(self) -> None:
        assert parse_group_list("<html><body></body></html>") == []

    def test_count(self) -> None:
        result = parse_group_list(SAMPLE_LIST_HTML)
        assert len(result) == 3


# ---------------------------------------------------------------------------
# Test: parse_actor_page — full data page
# ---------------------------------------------------------------------------


class TestParseActorPageFull:
    def _parse(self) -> ThreatActorData:
        result = parse_actor_page(SAMPLE_CARD_HTML_FULL, "APT28")
        assert result is not None
        return result

    def test_returns_threat_actor_data(self) -> None:
        assert isinstance(self._parse(), ThreatActorData)

    def test_canonical_name(self) -> None:
        actor = self._parse()
        assert actor.canonical_name == "APT28"

    def test_slug_id(self) -> None:
        actor = self._parse()
        assert actor.id == "apt28"

    def test_description_populated(self) -> None:
        actor = self._parse()
        assert len(actor.description) > 10
        assert "APT28" in actor.description or "state-sponsored" in actor.description

    def test_country_russia(self) -> None:
        actor = self._parse()
        assert actor.country is not None
        assert "russia" in actor.country.lower() or actor.country_code == "RU"

    def test_motivation_includes_espionage(self) -> None:
        actor = self._parse()
        assert "espionage" in actor.motivation

    def test_first_seen(self) -> None:
        actor = self._parse()
        assert actor.first_seen == "2004"

    def test_last_seen(self) -> None:
        actor = self._parse()
        assert actor.last_seen == "2023"

    def test_tools_extracted(self) -> None:
        actor = self._parse()
        assert len(actor.tools) > 0
        assert any("agent" in t.lower() or "sofacy" in t.lower() for t in actor.tools)

    def test_ttps_extracted(self) -> None:
        actor = self._parse()
        technique_ids = [t.technique_id for t in actor.ttps]
        assert "T1566" in technique_ids
        assert "T1059.001" in technique_ids

    def test_source_attribution(self) -> None:
        actor = self._parse()
        assert len(actor.sources) == 1
        assert actor.sources[0].source == "etda"
        assert actor.sources[0].source_id == "APT28"

    def test_rarity_set(self) -> None:
        actor = self._parse()
        assert actor.rarity in ("MYTHIC", "LEGENDARY", "EPIC", "RARE")

    def test_tlp_white(self) -> None:
        actor = self._parse()
        assert actor.tlp == "WHITE"


# ---------------------------------------------------------------------------
# Test: parse_actor_page — minimal data page
# ---------------------------------------------------------------------------


class TestParseActorPageMinimal:
    def test_minimal_page_does_not_crash(self) -> None:
        result = parse_actor_page(SAMPLE_CARD_HTML_MINIMAL, "Unknown+Group")
        assert result is not None

    def test_minimal_has_defaults(self) -> None:
        actor = parse_actor_page(SAMPLE_CARD_HTML_MINIMAL, "Unknown+Group")
        assert actor is not None
        assert actor.canonical_name != ""
        assert actor.rarity in ("MYTHIC", "LEGENDARY", "EPIC", "RARE")
        assert actor.tlp == "WHITE"

    def test_title_fallback_for_name(self) -> None:
        actor = parse_actor_page(SAMPLE_CARD_HTML_NO_HEADING, "MysteryAPT")
        assert actor is not None
        assert actor.canonical_name != ""


# ---------------------------------------------------------------------------
# Test: helper functions
# ---------------------------------------------------------------------------


class TestHelpers:
    def test_map_motivation_espionage(self) -> None:
        assert "espionage" in _map_motivation("intelligence gathering and espionage")

    def test_map_motivation_financial(self) -> None:
        assert "financial" in _map_motivation("motivated by financial gain and fraud")

    def test_map_motivation_defaults_espionage(self) -> None:
        result = _map_motivation("unknown motivations")
        assert result == ["espionage"]

    def test_map_motivation_multiple(self) -> None:
        result = _map_motivation("espionage and sabotage and disruption")
        assert "espionage" in result
        assert "sabotage" in result

    def test_parse_year_finds_year(self) -> None:
        assert _parse_year("Active since 2014") == "2014"

    def test_parse_year_returns_none(self) -> None:
        assert _parse_year("No year here") is None

    def test_parse_year_picks_first(self) -> None:
        assert _parse_year("2004 to 2023") == "2004"

    def test_parse_techniques_basic(self) -> None:
        ttps = _parse_techniques("Uses T1566 and T1059.001 for initial access.")
        ids = [t.technique_id for t in ttps]
        assert "T1566" in ids
        assert "T1059.001" in ids

    def test_parse_techniques_no_duplicates(self) -> None:
        ttps = _parse_techniques("T1566 T1566 T1059")
        ids = [t.technique_id for t in ttps]
        assert ids.count("T1566") == 1

    def test_parse_techniques_empty_text(self) -> None:
        assert _parse_techniques("no techniques here") == []
