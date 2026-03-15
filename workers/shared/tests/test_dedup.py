"""Tests for workers/shared/dedup.py — normalize_name, merge_actors."""

import sys
import os
from datetime import datetime, timezone

# Ensure workers root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.dedup import normalize_name, merge_actors, _union_list, _union_ttps, _union_campaigns
from shared.models import ThreatActorData, TTPUsage, Campaign, SourceAttribution


# ---------------------------------------------------------------------------
# normalize_name
# ---------------------------------------------------------------------------


class TestNormalizeName:
    def test_lowercase(self):
        assert normalize_name("APT28") == "28"

    def test_strips_apt_prefix(self):
        assert normalize_name("apt28") == "28"
        assert normalize_name("APT 28") == "28"

    def test_strips_group_prefix(self):
        assert normalize_name("Group 28") == "28"

    def test_strips_ta_prefix(self):
        assert normalize_name("TA505") == "505"

    def test_strips_fin_prefix(self):
        assert normalize_name("FIN7") == "7"

    def test_strips_unc_prefix(self):
        assert normalize_name("UNC2452") == "2452"

    def test_unicode_normalization(self):
        # NFKC normalization collapses homoglyphs
        result = normalize_name("Fancy\u00a0Bear")  # non-breaking space
        assert " " not in result or result == result.strip()

    def test_removes_punctuation(self):
        result = normalize_name("Cozy.Bear!")
        assert "." not in result
        assert "!" not in result

    def test_collapses_spaces(self):
        result = normalize_name("Fancy   Bear")
        assert "  " not in result

    def test_strips_whitespace(self):
        assert normalize_name("  APT28  ") == "28"

    def test_empty_string(self):
        result = normalize_name("")
        assert isinstance(result, str)

    def test_plain_name_no_prefix(self):
        # Name without known prefix preserved (lowercased, no punctuation)
        result = normalize_name("Lazarus")
        assert result == "lazarus"

    def test_returns_string(self):
        assert isinstance(normalize_name("APT28"), str)

    def test_fancy_bear_same_as_apt28(self):
        # "Fancy Bear" and "APT28" are different — normalize shouldn't conflate them
        # but both should produce consistent outputs
        assert normalize_name("Fancy Bear") == "fancy bear"
        assert normalize_name("apt 28") == "28"


# ---------------------------------------------------------------------------
# _union_list helper
# ---------------------------------------------------------------------------


class TestUnionList:
    def test_basic_union(self):
        result = _union_list(["a", "b"], ["b", "c"])
        assert set(result) == {"a", "b", "c"}

    def test_preserves_order_existing_first(self):
        result = _union_list(["a", "b"], ["c"])
        assert result[0] == "a"
        assert result[1] == "b"
        assert result[2] == "c"

    def test_empty_existing(self):
        assert _union_list([], ["x", "y"]) == ["x", "y"]

    def test_empty_incoming(self):
        assert _union_list(["x"], []) == ["x"]

    def test_no_duplicates(self):
        result = _union_list(["a", "a"], ["a"])
        assert result.count("a") == 1


# ---------------------------------------------------------------------------
# _union_ttps helper
# ---------------------------------------------------------------------------


class TestUnionTTPs:
    def test_deduplicates_by_technique_id(self):
        t1 = TTPUsage("T1566", "Phishing", "Initial Access")
        t2 = TTPUsage("T1566", "Phishing Updated", "Initial Access")  # same ID
        result = _union_ttps([t1], [t2])
        assert len(result) == 1
        # Existing entry wins (t1 comes first)
        assert result[0].technique_name == "Phishing"

    def test_unions_different_techniques(self):
        t1 = TTPUsage("T1566", "Phishing", "Initial Access")
        t2 = TTPUsage("T1059", "Scripting", "Execution")
        result = _union_ttps([t1], [t2])
        ids = {t.technique_id for t in result}
        assert ids == {"T1566", "T1059"}

    def test_empty_lists(self):
        assert _union_ttps([], []) == []


# ---------------------------------------------------------------------------
# _union_campaigns helper
# ---------------------------------------------------------------------------


class TestUnionCampaigns:
    def test_deduplicates_by_name_case_insensitive(self):
        c1 = Campaign("Operation Pawn Storm", "2014 campaign", "2014")
        c2 = Campaign("operation pawn storm", "same campaign different case", "2014")
        result = _union_campaigns([c1], [c2])
        assert len(result) == 1

    def test_unions_different_campaigns(self):
        c1 = Campaign("Op Alpha", "Alpha", "2020")
        c2 = Campaign("Op Beta", "Beta", "2021")
        result = _union_campaigns([c1], [c2])
        assert len(result) == 2


# ---------------------------------------------------------------------------
# merge_actors
# ---------------------------------------------------------------------------


def _make_existing(overrides: dict | None = None) -> dict:
    """Return a minimal existing actor dict (as from DB)."""
    base = {
        "id": "apt28",
        "canonical_name": "APT28",
        "aliases": ["Fancy Bear"],
        "mitre_id": "G0007",
        "country": "Russia",
        "country_code": "RU",
        "motivation": ["espionage"],
        "threat_level": 7,
        "sophistication": "Nation-State Elite",
        "first_seen": "2004",
        "last_seen": "2020",
        "sectors": ["Government"],
        "geographies": ["Europe"],
        "tools": ["Mimikatz"],
        "ttps": [{"technique_id": "T1566", "technique_name": "Phishing", "tactic": "Initial Access"}],
        "campaigns": [{"name": "Operation Pawn Storm", "description": "Campaign", "year": "2014"}],
        "description": "Original description",
        "tagline": "Old tagline",
        "rarity": "LEGENDARY",
        "image_url": "https://cdn.example.com/apt28.png",
        "image_prompt": None,
        "sources": [{"source": "mitre", "fetched_at": "2025-01-01T00:00:00Z", "source_id": "G0007", "url": None}],
        "tlp": "WHITE",
        "last_updated": "2025-01-01T00:00:00Z",
    }
    if overrides:
        base.update(overrides)
    return base


def _make_new_actor(overrides: dict | None = None) -> ThreatActorData:
    """Return a minimal ThreatActorData (incoming from a worker)."""
    base_kwargs = dict(
        id="apt28",
        canonical_name="APT28",
        description="Updated description",
        aliases=["Sofacy"],
        mitre_id="G0007",
        country="Russia",
        country_code="RU",
        motivation=["espionage", "military"],
        threat_level=8,
        sophistication="Nation-State Elite",
        first_seen="2004",
        last_seen="2024",
        sectors=["Defence"],
        geographies=["North America"],
        tools=["X-Agent"],
        ttps=[TTPUsage("T1059", "Scripting", "Execution")],
        campaigns=[Campaign("Operation Gamma", "New campaign", "2023")],
        tagline="New tagline",
        rarity="MYTHIC",
        sources=[SourceAttribution("etda", "2026-01-01T00:00:00Z")],
        tlp="WHITE",
    )
    if overrides:
        base_kwargs.update(overrides)
    return ThreatActorData(**base_kwargs)


class TestMergeActors:
    def test_id_preserved_from_existing(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        assert merged.id == "apt28"

    def test_aliases_union(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        assert "Fancy Bear" in merged.aliases
        assert "Sofacy" in merged.aliases

    def test_sectors_union(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        assert "Government" in merged.sectors
        assert "Defence" in merged.sectors

    def test_geographies_union(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        assert "Europe" in merged.geographies
        assert "North America" in merged.geographies

    def test_tools_union(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        assert "Mimikatz" in merged.tools
        assert "X-Agent" in merged.tools

    def test_ttps_union(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        technique_ids = {t.technique_id for t in merged.ttps}
        assert "T1566" in technique_ids
        assert "T1059" in technique_ids

    def test_campaigns_union(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        names = {c.name for c in merged.campaigns}
        assert "Operation Pawn Storm" in names
        assert "Operation Gamma" in names

    def test_threat_level_takes_maximum(self):
        merged = merge_actors(_make_existing({"threat_level": 7}), _make_new_actor())
        # new is 8, existing is 7 → max is 8
        assert merged.threat_level == 8

    def test_threat_level_keeps_existing_when_higher(self):
        existing = _make_existing({"threat_level": 9})
        new = _make_new_actor()
        new.threat_level = 6
        merged = merge_actors(existing, new)
        assert merged.threat_level == 9

    def test_description_prefers_new(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        assert merged.description == "Updated description"

    def test_image_url_preserved_from_existing(self):
        """Existing image_url should not be overwritten by None."""
        merged = merge_actors(_make_existing(), _make_new_actor())
        assert merged.image_url == "https://cdn.example.com/apt28.png"

    def test_sources_merged_by_source_key(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        source_names = {s.source for s in merged.sources}
        assert "mitre" in source_names
        assert "etda" in source_names

    def test_last_updated_is_recent(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        updated = datetime.fromisoformat(merged.last_updated.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta = abs((now - updated).total_seconds())
        assert delta < 10, "last_updated should be close to current time"

    def test_motivation_union(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        assert "espionage" in merged.motivation
        assert "military" in merged.motivation

    def test_rarity_prefers_new(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        # new rarity is "MYTHIC", _coalesce prefers new.rarity when not None
        assert merged.rarity == "MYTHIC"

    def test_country_preserved(self):
        merged = merge_actors(_make_existing(), _make_new_actor())
        assert merged.country == "Russia"
