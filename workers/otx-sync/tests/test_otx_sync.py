"""
Unit tests for the AlienVault OTX connector.

All network calls are mocked so these tests run offline and in CI.
"""

from __future__ import annotations

import os
import sys
from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Path setup
# The worker directory name ("otx-sync") contains a hyphen and cannot be
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
    "otx_sync_module",
    os.path.join(_WORKER_DIR, "sync.py"),
)
_otx_sync = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
sys.modules["otx_sync_module"] = _otx_sync
_spec.loader.exec_module(_otx_sync)  # type: ignore[union-attr]

_clean_pulse_name = _otx_sync._clean_pulse_name
_extract_year = _otx_sync._extract_year
_get_api_key = _otx_sync._get_api_key
_indicators_to_tools = _otx_sync._indicators_to_tools
_is_threat_actor_pulse = _otx_sync._is_threat_actor_pulse
_map_attack_ids = _otx_sync._map_attack_ids
main = _otx_sync.main
parse_pulse = _otx_sync.parse_pulse

from shared.models import ThreatActorData  # noqa: E402

# ---------------------------------------------------------------------------
# Sample data fixtures
# ---------------------------------------------------------------------------

SAMPLE_PULSE_APT28: dict = {
    "id": "abc123",
    "name": "APT28 - Fancy Bear Intelligence Gathering",
    "description": (
        "APT28 (Fancy Bear) is a Russian state-sponsored threat actor "
        "conducting espionage operations against government and military targets."
    ),
    "tags": ["apt", "russia", "espionage", "threat-actor", "apt28"],
    "indicators": [
        {"type": "hostname", "indicator": "c2.example.ru"},
        {"type": "domain", "indicator": "malicious.ru"},
        {"type": "IPv4", "indicator": "1.2.3.4"},  # should not appear in tools
        {"type": "URL", "indicator": "http://drop.example.com/payload"},
    ],
    "attack_ids": [
        {"id": "T1566", "display_name": "Phishing", "tactic": "initial-access"},
        {"id": "T1059", "display_name": "Command and Scripting Interpreter", "tactic": "execution"},
    ],
    "created": "2022-03-15T10:00:00Z",
    "modified": "2023-09-01T08:30:00Z",
}

SAMPLE_PULSE_LAZARUS: dict = {
    "id": "def456",
    "name": "Lazarus Group: Financial Operations",
    "description": "North Korean Lazarus Group conducting financial cyber attacks.",
    "tags": ["apt", "lazarus", "financial", "threat-actor", "north-korea"],
    "indicators": [],
    "attack_ids": [],
    "created": "2021-01-10T00:00:00Z",
    "modified": "2023-06-20T00:00:00Z",
}

SAMPLE_PULSE_NOT_ACTOR: dict = {
    "id": "ghi789",
    "name": "Malicious IP List January 2024",
    "description": "Collection of malicious IP addresses.",
    "tags": ["malicious-ips", "blocklist"],
    "indicators": [],
    "attack_ids": [],
    "created": "2024-01-05T00:00:00Z",
    "modified": "2024-01-05T00:00:00Z",
}

SAMPLE_PULSE_EMPTY: dict = {
    "id": "jkl012",
    "name": "",
    "description": "",
    "tags": ["apt"],
    "indicators": [],
    "attack_ids": [],
    "created": "",
    "modified": "",
}


# ---------------------------------------------------------------------------
# Test: graceful skip when OTX_API_KEY is missing
# ---------------------------------------------------------------------------


class TestApiKeyCheck:
    def test_get_api_key_returns_none_when_unset(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("OTX_API_KEY", raising=False)
        assert _get_api_key() is None

    def test_get_api_key_returns_value_when_set(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OTX_API_KEY", "test_key_12345")
        assert _get_api_key() == "test_key_12345"

    def test_main_skips_gracefully_without_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """main() must not raise an exception when OTX_API_KEY is absent."""
        monkeypatch.delenv("OTX_API_KEY", raising=False)
        # Should return silently, not raise
        main()

    def test_main_skips_without_db_connection(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Verify no DB call is made when the key is absent."""
        monkeypatch.delenv("OTX_API_KEY", raising=False)
        with patch("otx_sync_module.get_engine") as mock_engine:
            main()
            mock_engine.assert_not_called()


# ---------------------------------------------------------------------------
# Test: _is_threat_actor_pulse
# ---------------------------------------------------------------------------


class TestIsThreatActorPulse:
    def test_apt_tagged_pulse_is_threat_actor(self) -> None:
        assert _is_threat_actor_pulse(SAMPLE_PULSE_APT28) is True

    def test_threat_actor_tagged_pulse(self) -> None:
        assert _is_threat_actor_pulse(SAMPLE_PULSE_LAZARUS) is True

    def test_non_actor_pulse(self) -> None:
        assert _is_threat_actor_pulse(SAMPLE_PULSE_NOT_ACTOR) is False

    def test_empty_tags(self) -> None:
        assert _is_threat_actor_pulse({"tags": []}) is False


# ---------------------------------------------------------------------------
# Test: _clean_pulse_name
# ---------------------------------------------------------------------------


class TestCleanPulseName:
    def test_removes_trailing_campaign(self) -> None:
        assert "APT28" in _clean_pulse_name("APT28 - Campaign 2023")

    def test_removes_threat_actor_prefix(self) -> None:
        result = _clean_pulse_name("Threat Actor: Lazarus Group")
        assert "Lazarus Group" in result
        assert "Threat Actor" not in result

    def test_preserves_plain_name(self) -> None:
        assert _clean_pulse_name("Fancy Bear") == "Fancy Bear"

    def test_strips_whitespace(self) -> None:
        assert _clean_pulse_name("  APT28  ") == "APT28"


# ---------------------------------------------------------------------------
# Test: _extract_year
# ---------------------------------------------------------------------------


class TestExtractYear:
    def test_iso_timestamp(self) -> None:
        assert _extract_year("2022-03-15T10:00:00Z") == "2022"

    def test_none_returns_none(self) -> None:
        assert _extract_year(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert _extract_year("") is None


# ---------------------------------------------------------------------------
# Test: _map_attack_ids
# ---------------------------------------------------------------------------


class TestMapAttackIds:
    def test_maps_technique_ids(self) -> None:
        attack_ids = [
            {"id": "T1566", "display_name": "Phishing", "tactic": "initial-access"},
            {"id": "T1059", "display_name": "Command Interpreter", "tactic": "execution"},
        ]
        ttps = _map_attack_ids(attack_ids)
        ids = [t.technique_id for t in ttps]
        assert "T1566" in ids
        assert "T1059" in ids

    def test_deduplicates(self) -> None:
        attack_ids = [
            {"id": "T1566", "display_name": "Phishing", "tactic": "initial-access"},
            {"id": "T1566", "display_name": "Phishing duplicate", "tactic": "initial-access"},
        ]
        ttps = _map_attack_ids(attack_ids)
        assert len(ttps) == 1

    def test_empty_list(self) -> None:
        assert _map_attack_ids([]) == []


# ---------------------------------------------------------------------------
# Test: _indicators_to_tools
# ---------------------------------------------------------------------------


class TestIndicatorsToTools:
    def test_extracts_hostnames_and_domains(self) -> None:
        indicators = [
            {"type": "hostname", "indicator": "evil.example.com"},
            {"type": "domain", "indicator": "c2.malicious.net"},
            {"type": "IPv4", "indicator": "192.168.1.1"},
        ]
        tools = _indicators_to_tools(indicators)
        assert "evil.example.com" in tools
        assert "c2.malicious.net" in tools
        assert "192.168.1.1" not in tools

    def test_deduplicates(self) -> None:
        indicators = [
            {"type": "hostname", "indicator": "same.example.com"},
            {"type": "hostname", "indicator": "same.example.com"},
        ]
        tools = _indicators_to_tools(indicators)
        assert tools.count("same.example.com") == 1

    def test_empty_indicators(self) -> None:
        assert _indicators_to_tools([]) == []


# ---------------------------------------------------------------------------
# Test: parse_pulse
# ---------------------------------------------------------------------------


class TestParsePulse:
    def test_returns_threat_actor_data(self) -> None:
        result = parse_pulse(SAMPLE_PULSE_APT28)
        assert isinstance(result, ThreatActorData)

    def test_canonical_name_cleaned(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        assert "APT28" in actor.canonical_name

    def test_slug_id(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        assert actor.id == actor.id.lower()
        assert " " not in actor.id

    def test_description_populated(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        assert len(actor.description) > 0

    def test_ttps_extracted(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        ids = [t.technique_id for t in actor.ttps]
        assert "T1566" in ids

    def test_tools_extracted(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        assert "c2.example.ru" in actor.tools or "malicious.ru" in actor.tools

    def test_motivation_espionage(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        assert "espionage" in actor.motivation

    def test_motivation_financial(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_LAZARUS)
        assert actor is not None
        assert "financial" in actor.motivation

    def test_campaigns_has_one_entry(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        assert len(actor.campaigns) == 1

    def test_source_attribution(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        assert len(actor.sources) == 1
        src = actor.sources[0]
        assert src.source == "otx"
        assert src.source_id == "abc123"
        assert "otx.alienvault.com" in (src.url or "")

    def test_rarity_set(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        assert actor.rarity in ("MYTHIC", "LEGENDARY", "EPIC", "RARE")

    def test_tlp_white(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        assert actor.tlp == "WHITE"

    def test_empty_name_returns_none(self) -> None:
        result = parse_pulse(SAMPLE_PULSE_EMPTY)
        assert result is None

    def test_first_seen_year(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        assert actor.first_seen == "2022"

    def test_last_seen_year(self) -> None:
        actor = parse_pulse(SAMPLE_PULSE_APT28)
        assert actor is not None
        assert actor.last_seen == "2023"
