"""
Unit tests for the MITRE ATT&CK ingestion worker.

All network calls are mocked so these tests run offline and in CI.
"""

from __future__ import annotations

import json
import sys
import os
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Path setup — allow importing the worker and shared packages from tests/
# ---------------------------------------------------------------------------
_WORKERS_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _WORKERS_ROOT not in sys.path:
    sys.path.insert(0, _WORKERS_ROOT)

from mitre_sync.sync import (  # type: ignore[import]
    _index_bundle,
    _map_motivation,
    _map_sophistication,
    _slugify_actor,
    fetch_stix_bundle,
    parse_intrusion_set,
)
from shared.models import ThreatActorData

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_INTRUSION_SET: dict = {
    "type": "intrusion-set",
    "id": "intrusion-set--c1aab4c9-4c30-4c8b-8c4b-6b3a2e7ecd2a",
    "name": "APT28",
    "description": (
        "APT28 is a Russian threat group attributed to the GRU. "
        "It has operated since at least 2004."
    ),
    "aliases": ["Fancy Bear", "Sofacy", "STRONTIUM"],
    "labels": ["russia", "espionage"],
    "external_references": [
        {
            "source_name": "mitre-attack",
            "external_id": "G0007",
            "url": "https://attack.mitre.org/groups/G0007",
        }
    ],
    "created": "2017-05-31T21:31:48.859Z",
    "modified": "2023-10-04T18:01:00.432Z",
    "x_mitre_aliases": ["Fancy Bear", "Sofacy", "STRONTIUM"],
}

SAMPLE_ATTACK_PATTERN: dict = {
    "type": "attack-pattern",
    "id": "attack-pattern--a1234",
    "name": "Spearphishing Attachment",
    "external_references": [
        {"source_name": "mitre-attack", "external_id": "T1566.001"}
    ],
    "kill_chain_phases": [{"kill_chain_name": "mitre-attack", "phase_name": "initial-access"}],
}

SAMPLE_TOOL: dict = {
    "type": "tool",
    "id": "tool--b5678",
    "name": "Mimikatz",
}

SAMPLE_CAMPAIGN: dict = {
    "type": "campaign",
    "id": "campaign--c9012",
    "name": "Operation Pawn Storm",
    "description": "Targeted government and military organizations.",
    "first_seen": "2014-01-01T00:00:00Z",
    "created": "2017-06-01T00:00:00Z",
}

SAMPLE_USES_TTP_REL: dict = {
    "type": "relationship",
    "id": "relationship--r1",
    "relationship_type": "uses",
    "source_ref": "intrusion-set--c1aab4c9-4c30-4c8b-8c4b-6b3a2e7ecd2a",
    "target_ref": "attack-pattern--a1234",
}

SAMPLE_USES_TOOL_REL: dict = {
    "type": "relationship",
    "id": "relationship--r2",
    "relationship_type": "uses",
    "source_ref": "intrusion-set--c1aab4c9-4c30-4c8b-8c4b-6b3a2e7ecd2a",
    "target_ref": "tool--b5678",
}

SAMPLE_ATTRIBUTED_TO_REL: dict = {
    "type": "relationship",
    "id": "relationship--r3",
    "relationship_type": "attributed-to",
    "source_ref": "campaign--c9012",
    "target_ref": "intrusion-set--c1aab4c9-4c30-4c8b-8c4b-6b3a2e7ecd2a",
}

STIX_OBJECTS = [
    SAMPLE_INTRUSION_SET,
    SAMPLE_ATTACK_PATTERN,
    SAMPLE_TOOL,
    SAMPLE_CAMPAIGN,
    SAMPLE_USES_TTP_REL,
    SAMPLE_USES_TOOL_REL,
    SAMPLE_ATTRIBUTED_TO_REL,
]


# ---------------------------------------------------------------------------
# Test: slugify logic
# ---------------------------------------------------------------------------


class TestSlugify:
    def test_basic_slug(self) -> None:
        assert _slugify_actor("APT28") == "apt28"

    def test_slug_with_spaces(self) -> None:
        assert _slugify_actor("Fancy Bear") == "fancy-bear"

    def test_slug_with_special_chars(self) -> None:
        assert _slugify_actor("Lazarus Group (North Korea)") == "lazarus-group-north-korea"

    def test_slug_lowercase(self) -> None:
        result = _slugify_actor("COZY BEAR")
        assert result == result.lower()


# ---------------------------------------------------------------------------
# Test: motivation mapping
# ---------------------------------------------------------------------------


class TestMotivationMapping:
    def test_espionage_variants(self) -> None:
        assert "espionage" in _map_motivation(["espionage"])
        assert "espionage" in _map_motivation(["cyber espionage"])
        assert "espionage" in _map_motivation(["state-sponsored"])

    def test_financial(self) -> None:
        assert "financial" in _map_motivation(["financial gain"])

    def test_sabotage(self) -> None:
        assert "sabotage" in _map_motivation(["destruction"])

    def test_hacktivism(self) -> None:
        assert "hacktivism" in _map_motivation(["hacktivism"])

    def test_military(self) -> None:
        assert "military" in _map_motivation(["military advantage"])

    def test_empty_defaults_to_espionage(self) -> None:
        result = _map_motivation([])
        assert result == ["espionage"]

    def test_case_insensitive(self) -> None:
        assert "espionage" in _map_motivation(["ESPIONAGE"])

    def test_deduplication(self) -> None:
        result = _map_motivation(["espionage", "cyber espionage"])
        assert result.count("espionage") == 1


# ---------------------------------------------------------------------------
# Test: sophistication mapping
# ---------------------------------------------------------------------------


class TestSophisticationMapping:
    def test_expert_maps_to_very_high(self) -> None:
        assert _map_sophistication("expert") == "Very High"

    def test_innovator_maps_to_nation_state(self) -> None:
        assert _map_sophistication("innovator") == "Nation-State Elite"

    def test_none_defaults_to_high(self) -> None:
        assert _map_sophistication(None) == "High"

    def test_unknown_value_defaults_to_high(self) -> None:
        assert _map_sophistication("unknown-tier") == "High"

    def test_advanced(self) -> None:
        assert _map_sophistication("advanced") == "High"

    def test_intermediate(self) -> None:
        assert _map_sophistication("intermediate") == "Medium"


# ---------------------------------------------------------------------------
# Test: parse_intrusion_set
# ---------------------------------------------------------------------------


class TestParseIntrusionSet:
    def _build_indexes(self) -> tuple:
        return _index_bundle(STIX_OBJECTS)

    def test_returns_threat_actor_data(self) -> None:
        by_id, intrusion_sets, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert isinstance(actor, ThreatActorData)

    def test_canonical_name(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert actor.canonical_name == "APT28"

    def test_slug_id(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert actor.id == "apt28"

    def test_mitre_id_extracted(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert actor.mitre_id == "G0007"

    def test_aliases_populated(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert "Fancy Bear" in actor.aliases
        assert "Sofacy" in actor.aliases
        assert "APT28" not in actor.aliases  # canonical name excluded

    def test_description_non_empty(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert len(actor.description) > 0

    def test_ttps_extracted(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert len(actor.ttps) == 1
        assert actor.ttps[0].technique_id == "T1566.001"
        assert actor.ttps[0].tactic == "initial-access"

    def test_tools_extracted(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert "Mimikatz" in actor.tools

    def test_campaigns_extracted(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert len(actor.campaigns) == 1
        assert actor.campaigns[0].name == "Operation Pawn Storm"

    def test_country_inferred_from_labels(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert actor.country == "Russia"
        assert actor.country_code == "RU"

    def test_source_attribution(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert len(actor.sources) == 1
        assert actor.sources[0].source == "mitre"
        assert actor.sources[0].source_id == "G0007"

    def test_rarity_set(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert actor.rarity in ("MYTHIC", "LEGENDARY", "EPIC", "RARE")

    def test_tlp_is_white(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert actor.tlp == "WHITE"

    def test_first_seen_year(self) -> None:
        by_id, _, rels_by_source, rels_by_target = self._build_indexes()
        actor = parse_intrusion_set(
            SAMPLE_INTRUSION_SET, by_id, rels_by_source, rels_by_target
        )
        assert actor.first_seen == "2017"


# ---------------------------------------------------------------------------
# Test: fetch_stix_bundle with mocked HTTP
# ---------------------------------------------------------------------------


class TestFetchStixBundle:
    def test_fetch_parses_json(self) -> None:
        mock_bundle = {"type": "bundle", "objects": []}
        mock_response = MagicMock()
        mock_response.json.return_value = mock_bundle
        mock_response.raise_for_status.return_value = None

        with patch("mitre_sync.sync.requests.get", return_value=mock_response) as mock_get:
            result = fetch_stix_bundle("https://example.com/bundle.json")

        mock_get.assert_called_once_with("https://example.com/bundle.json", timeout=120)
        assert result == mock_bundle

    def test_fetch_raises_on_http_error(self) -> None:
        import requests as req

        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = req.HTTPError("404")

        with patch("mitre_sync.sync.requests.get", return_value=mock_response):
            with pytest.raises(req.HTTPError):
                fetch_stix_bundle("https://example.com/bundle.json")


# ---------------------------------------------------------------------------
# Test: index_bundle
# ---------------------------------------------------------------------------


class TestIndexBundle:
    def test_index_finds_intrusion_sets(self) -> None:
        _, intrusion_sets, _, _ = _index_bundle(STIX_OBJECTS)
        assert len(intrusion_sets) == 1
        assert intrusion_sets[0]["name"] == "APT28"

    def test_index_by_id(self) -> None:
        by_id, _, _, _ = _index_bundle(STIX_OBJECTS)
        assert "intrusion-set--c1aab4c9-4c30-4c8b-8c4b-6b3a2e7ecd2a" in by_id

    def test_rels_by_source(self) -> None:
        _, _, rels_by_source, _ = _index_bundle(STIX_OBJECTS)
        src_id = "intrusion-set--c1aab4c9-4c30-4c8b-8c4b-6b3a2e7ecd2a"
        assert src_id in rels_by_source
        # uses-TTP and uses-tool relationships
        assert len(rels_by_source[src_id]) == 2

    def test_rels_by_target(self) -> None:
        _, _, _, rels_by_target = _index_bundle(STIX_OBJECTS)
        tgt_id = "intrusion-set--c1aab4c9-4c30-4c8b-8c4b-6b3a2e7ecd2a"
        assert tgt_id in rels_by_target
        # attributed-to relationship
        assert len(rels_by_target[tgt_id]) == 1
