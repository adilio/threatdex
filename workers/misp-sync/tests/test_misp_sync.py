"""Tests for MISP connector — normalise_cluster, fetch_threat_actor_clusters, run_sync."""

from __future__ import annotations

import importlib.util
import os
import sys
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Path setup — load sync.py under a unique module name (hyphenated directory)
# ---------------------------------------------------------------------------

_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_WORKER_DIR = os.path.dirname(_TESTS_DIR)      # workers/misp-sync/
_WORKERS_ROOT = os.path.dirname(_WORKER_DIR)   # workers/

if _WORKERS_ROOT not in sys.path:
    sys.path.insert(0, _WORKERS_ROOT)

_spec = importlib.util.spec_from_file_location(
    "misp_sync_module",
    os.path.join(_WORKER_DIR, "sync.py"),
)
_misp_sync = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
sys.modules["misp_sync_module"] = _misp_sync
_spec.loader.exec_module(_misp_sync)  # type: ignore[union-attr]

_extract_country = _misp_sync._extract_country
_extract_motivation = _misp_sync._extract_motivation
_extract_sophistication = _misp_sync._extract_sophistication
_extract_sectors = _misp_sync._extract_sectors
_extract_aliases = _misp_sync._extract_aliases
_to_slug = _misp_sync._to_slug
normalise_cluster = _misp_sync.normalise_cluster
fetch_threat_actor_clusters = _misp_sync.fetch_threat_actor_clusters
run_sync = _misp_sync.run_sync


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------


def _make_cluster(overrides: dict | None = None) -> dict:
    """Return a minimal MISP threat-actor galaxy cluster dict."""
    base = {
        "uuid": "abc123",
        "value": "APT28",
        "description": "Russia's GRU-linked threat actor.",
        "meta": {
            "country": "Russia",
            "synonyms": ["Fancy Bear", "Sofacy"],
            "sophistication": "advanced",
            "cfr-target-category": ["Government", "Defence"],
            "cfr-suspected-victims-objectives": ["espionage"],
            "first-seen": "2004-01-01",
            "last-seen": "2024-01-01",
        },
    }
    if overrides:
        base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# _to_slug
# ---------------------------------------------------------------------------


def test_to_slug_basic():
    assert _to_slug("APT 28") == "apt-28"


def test_to_slug_special_chars():
    assert _to_slug("Fancy.Bear!") == "fancy-bear"


def test_to_slug_multiple_spaces():
    assert _to_slug("Lazarus  Group") == "lazarus-group"


# ---------------------------------------------------------------------------
# _extract_country
# ---------------------------------------------------------------------------


def test_extract_country_known():
    country, code = _extract_country({"country": "Russia"})
    assert country == "Russia"
    assert code == "RU"


def test_extract_country_china():
    country, code = _extract_country({"country": "China"})
    assert code == "CN"


def test_extract_country_unknown():
    country, code = _extract_country({"country": "Atlantis"})
    assert country == "Atlantis"
    assert code is None


def test_extract_country_missing():
    country, code = _extract_country({})
    assert country is None
    assert code is None


def test_extract_country_origin_country_key():
    country, code = _extract_country({"origin-country": "Iran"})
    assert country == "Iran"
    assert code == "IR"


# ---------------------------------------------------------------------------
# _extract_motivation
# ---------------------------------------------------------------------------


def test_extract_motivation_espionage():
    result = _extract_motivation({"cfr-suspected-victims-objectives": ["espionage"]})
    assert "espionage" in result


def test_extract_motivation_financial():
    result = _extract_motivation({"motivation": ["financial"]})
    assert "financial" in result


def test_extract_motivation_intelligence_maps_to_espionage():
    result = _extract_motivation({"cfr-suspected-victims-objectives": ["intelligence gathering"]})
    assert "espionage" in result


def test_extract_motivation_defaults_to_espionage():
    result = _extract_motivation({})
    assert result == ["espionage"]


def test_extract_motivation_deduplicates():
    result = _extract_motivation({"cfr-suspected-victims-objectives": ["espionage", "espionage"]})
    assert result.count("espionage") == 1


# ---------------------------------------------------------------------------
# _extract_sophistication
# ---------------------------------------------------------------------------


def test_extract_sophistication_advanced():
    assert _extract_sophistication({"sophistication": "advanced"}) == "Very High"


def test_extract_sophistication_nation():
    assert _extract_sophistication({"sophistication": "nation-state elite"}) == "Nation-State Elite"


def test_extract_sophistication_high():
    assert _extract_sophistication({"sophistication": "high"}) == "High"


def test_extract_sophistication_empty():
    assert _extract_sophistication({}) == "Low"


# ---------------------------------------------------------------------------
# _extract_sectors
# ---------------------------------------------------------------------------


def test_extract_sectors_list():
    result = _extract_sectors({"cfr-target-category": ["Government", "Finance"]})
    assert "Government" in result
    assert "Finance" in result


def test_extract_sectors_string():
    result = _extract_sectors({"cfr-target-category": "Energy"})
    assert "Energy" in result


def test_extract_sectors_empty():
    assert _extract_sectors({}) == []


# ---------------------------------------------------------------------------
# _extract_aliases
# ---------------------------------------------------------------------------


def test_extract_aliases_basic():
    aliases = _extract_aliases({"synonyms": ["Fancy Bear", "Sofacy"]}, "APT28")
    assert "Fancy Bear" in aliases
    assert "Sofacy" in aliases


def test_extract_aliases_excludes_cluster_value():
    aliases = _extract_aliases({"synonyms": ["APT28", "Fancy Bear"]}, "APT28")
    assert "APT28" not in aliases
    assert "Fancy Bear" in aliases


def test_extract_aliases_empty():
    assert _extract_aliases({}, "APT28") == []


# ---------------------------------------------------------------------------
# normalise_cluster
# ---------------------------------------------------------------------------


def test_normalise_cluster_returns_threat_actor_data():
    actor = normalise_cluster(_make_cluster())
    assert actor is not None


def test_normalise_cluster_id_is_slug():
    actor = normalise_cluster(_make_cluster())
    assert actor.id == "apt28"


def test_normalise_cluster_canonical_name():
    actor = normalise_cluster(_make_cluster())
    assert actor.canonical_name == "APT28"


def test_normalise_cluster_description():
    actor = normalise_cluster(_make_cluster())
    assert "GRU" in actor.description


def test_normalise_cluster_country():
    actor = normalise_cluster(_make_cluster())
    assert actor.country == "Russia"
    assert actor.country_code == "RU"


def test_normalise_cluster_aliases():
    actor = normalise_cluster(_make_cluster())
    assert "Fancy Bear" in actor.aliases
    assert "Sofacy" in actor.aliases


def test_normalise_cluster_motivation():
    actor = normalise_cluster(_make_cluster())
    assert "espionage" in actor.motivation


def test_normalise_cluster_sophistication():
    # The fixture has "advanced" which maps to "Very High"
    actor = normalise_cluster(_make_cluster())
    assert actor.sophistication == "Very High"


def test_normalise_cluster_sectors():
    actor = normalise_cluster(_make_cluster())
    assert "Government" in actor.sectors


def test_normalise_cluster_first_seen():
    actor = normalise_cluster(_make_cluster())
    assert actor.first_seen == "2004"


def test_normalise_cluster_last_seen():
    actor = normalise_cluster(_make_cluster())
    assert actor.last_seen == "2024"


def test_normalise_cluster_source_is_misp():
    actor = normalise_cluster(_make_cluster())
    assert len(actor.sources) == 1
    assert actor.sources[0].source == "misp"


def test_normalise_cluster_source_id_is_uuid():
    actor = normalise_cluster(_make_cluster())
    assert actor.sources[0].source_id == "abc123"


def test_normalise_cluster_threat_level_in_range():
    actor = normalise_cluster(_make_cluster())
    assert 1 <= actor.threat_level <= 10


def test_normalise_cluster_valid_rarity():
    actor = normalise_cluster(_make_cluster())
    assert actor.rarity in {"MYTHIC", "LEGENDARY", "EPIC", "RARE"}


def test_normalise_cluster_tlp_white():
    actor = normalise_cluster(_make_cluster())
    assert actor.tlp == "WHITE"


def test_normalise_cluster_missing_value_returns_none():
    actor = normalise_cluster({"uuid": "x", "meta": {}})
    assert actor is None


def test_normalise_cluster_minimal_cluster():
    cluster = {"value": "Unknown Group", "description": "Unknown", "meta": {}}
    actor = normalise_cluster(cluster)
    assert actor is not None
    assert actor.canonical_name == "Unknown Group"


# ---------------------------------------------------------------------------
# fetch_threat_actor_clusters
# ---------------------------------------------------------------------------


def test_fetch_returns_empty_list_when_no_url():
    result = fetch_threat_actor_clusters("", "key123")
    assert result == []


def test_fetch_returns_empty_list_when_requests_fail():
    with patch.object(_misp_sync, "_requests") as mock_req:
        mock_req.get.side_effect = Exception("Connection refused")
        result = fetch_threat_actor_clusters("https://misp.test", "key")
    assert result == []


def test_fetch_parses_list_response():
    raw_cluster = _make_cluster()
    mock_resp = MagicMock()
    mock_resp.json.return_value = [raw_cluster]
    mock_resp.raise_for_status = MagicMock()

    with patch.object(_misp_sync, "_requests") as mock_req:
        mock_req.get.return_value = mock_resp
        result = fetch_threat_actor_clusters("https://misp.test", "key")

    assert len(result) == 1


def test_fetch_parses_dict_response_with_galaxy_cluster_key():
    raw_cluster = _make_cluster()
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"GalaxyCluster": [raw_cluster]}
    mock_resp.raise_for_status = MagicMock()

    with patch.object(_misp_sync, "_requests") as mock_req:
        mock_req.get.return_value = mock_resp
        result = fetch_threat_actor_clusters("https://misp.test", "key")

    assert len(result) == 1


def test_fetch_unwraps_nested_galaxy_cluster():
    raw_cluster = _make_cluster()
    wrapped = {"GalaxyCluster": raw_cluster}
    mock_resp = MagicMock()
    mock_resp.json.return_value = [wrapped]
    mock_resp.raise_for_status = MagicMock()

    with patch.object(_misp_sync, "_requests") as mock_req:
        mock_req.get.return_value = mock_resp
        result = fetch_threat_actor_clusters("https://misp.test", "key")

    assert len(result) == 1
    assert result[0] == raw_cluster


# ---------------------------------------------------------------------------
# run_sync
# ---------------------------------------------------------------------------


def test_run_sync_skips_if_no_url():
    count = run_sync(None, misp_url="", api_key="key")
    assert count == 0


def test_run_sync_skips_if_no_api_key():
    count = run_sync(None, misp_url="https://misp.test", api_key="")
    assert count == 0


def test_run_sync_returns_actor_count_without_engine():
    raw_cluster = _make_cluster()
    mock_resp = MagicMock()
    mock_resp.json.return_value = [raw_cluster]
    mock_resp.raise_for_status = MagicMock()

    with patch.object(_misp_sync, "_requests") as mock_req:
        mock_req.get.return_value = mock_resp
        count = run_sync(None, misp_url="https://misp.test", api_key="key")

    assert count == 1


def test_run_sync_returns_zero_when_no_clusters():
    with patch.object(_misp_sync, "fetch_threat_actor_clusters", return_value=[]):
        count = run_sync(None, misp_url="https://misp.test", api_key="key")
    assert count == 0
