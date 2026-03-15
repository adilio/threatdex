"""Tests for OpenCTI connector — normalise_node, fetch_intrusion_sets, run_sync."""

from __future__ import annotations

import importlib.util
import os
import sys
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Path setup — load sync.py under a unique module name (hyphenated directory)
# ---------------------------------------------------------------------------

_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_WORKER_DIR = os.path.dirname(_TESTS_DIR)        # workers/opencti-sync/
_WORKERS_ROOT = os.path.dirname(_WORKER_DIR)     # workers/

if _WORKERS_ROOT not in sys.path:
    sys.path.insert(0, _WORKERS_ROOT)

_spec = importlib.util.spec_from_file_location(
    "opencti_sync_module",
    os.path.join(_WORKER_DIR, "sync.py"),
)
_opencti_sync = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
sys.modules["opencti_sync_module"] = _opencti_sync
_spec.loader.exec_module(_opencti_sync)  # type: ignore[union-attr]

_extract_motivation = _opencti_sync._extract_motivation
_extract_sophistication = _opencti_sync._extract_sophistication
_extract_country_from_labels = _opencti_sync._extract_country_from_labels
_year_from_iso = _opencti_sync._year_from_iso
_to_slug = _opencti_sync._to_slug
normalise_node = _opencti_sync.normalise_node
fetch_intrusion_sets = _opencti_sync.fetch_intrusion_sets
run_sync = _opencti_sync.run_sync


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------


def _make_node(overrides: dict | None = None) -> dict:
    """Return a minimal OpenCTI IntrusionSet node dict."""
    base = {
        "id": "octi-123",
        "name": "Lazarus Group",
        "description": "North Korean state-sponsored threat actor.",
        "aliases": ["Hidden Cobra", "ZINC"],
        "first_seen": "2009-01-01T00:00:00Z",
        "last_seen": "2024-01-01T00:00:00Z",
        "primary_motivation": "espionage",
        "secondary_motivations": ["financial"],
        "sophistication": "advanced",
        "goals": [],
        "resource_level": "government",
        "objectLabel": {
            "edges": [{"node": {"value": "north korea"}}]
        },
        "killChainPhases": [],
    }
    if overrides:
        base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# _to_slug
# ---------------------------------------------------------------------------


def test_to_slug_basic():
    assert _to_slug("Lazarus Group") == "lazarus-group"


def test_to_slug_uppercase():
    assert _to_slug("APT29") == "apt29"


def test_to_slug_special_chars():
    assert _to_slug("Hidden.Cobra!") == "hidden-cobra"


# ---------------------------------------------------------------------------
# _year_from_iso
# ---------------------------------------------------------------------------


def test_year_from_iso_standard():
    assert _year_from_iso("2009-01-01T00:00:00Z") == "2009"


def test_year_from_iso_none():
    assert _year_from_iso(None) is None


def test_year_from_iso_short():
    assert _year_from_iso("200") is None


# ---------------------------------------------------------------------------
# _extract_country_from_labels
# ---------------------------------------------------------------------------


def test_extract_country_known_label():
    country, code = _extract_country_from_labels(["north korea"])
    assert country == "north korea"
    assert code == "KP"


def test_extract_country_russia():
    country, code = _extract_country_from_labels(["russia"])
    assert code == "RU"


def test_extract_country_no_match():
    country, code = _extract_country_from_labels(["unknown_land"])
    assert country is None
    assert code is None


def test_extract_country_empty_labels():
    country, code = _extract_country_from_labels([])
    assert country is None


# ---------------------------------------------------------------------------
# _extract_motivation
# ---------------------------------------------------------------------------


def test_extract_motivation_espionage():
    result = _extract_motivation("espionage", [])
    assert "espionage" in result


def test_extract_motivation_coercive_maps_to_espionage():
    result = _extract_motivation("coercive", [])
    assert "espionage" in result


def test_extract_motivation_financial():
    result = _extract_motivation("financial", [])
    assert "financial" in result


def test_extract_motivation_secondary():
    result = _extract_motivation("espionage", ["financial"])
    assert "espionage" in result
    assert "financial" in result


def test_extract_motivation_defaults_to_espionage():
    result = _extract_motivation(None, [])
    assert result == ["espionage"]


def test_extract_motivation_deduplicates():
    result = _extract_motivation("espionage", ["espionage"])
    assert result.count("espionage") == 1


def test_extract_motivation_ideology_maps_to_hacktivism():
    result = _extract_motivation("ideology", [])
    assert "hacktivism" in result


# ---------------------------------------------------------------------------
# _extract_sophistication
# ---------------------------------------------------------------------------


def test_extract_sophistication_advanced():
    assert _extract_sophistication("advanced") == "Nation-State Elite"


def test_extract_sophistication_innovative():
    assert _extract_sophistication("innovative") == "Nation-State Elite"


def test_extract_sophistication_expert():
    assert _extract_sophistication("expert") == "Very High"


def test_extract_sophistication_practitioner():
    assert _extract_sophistication("practitioner") == "High"


def test_extract_sophistication_opportunistic():
    assert _extract_sophistication("opportunistic") == "Low"


def test_extract_sophistication_none():
    assert _extract_sophistication(None) == "Low"


def test_extract_sophistication_unknown():
    assert _extract_sophistication("unknown") == "Medium"


# ---------------------------------------------------------------------------
# normalise_node
# ---------------------------------------------------------------------------


def test_normalise_node_returns_actor():
    actor = normalise_node(_make_node())
    assert actor is not None


def test_normalise_node_id_is_slug():
    actor = normalise_node(_make_node())
    assert actor.id == "lazarus-group"


def test_normalise_node_canonical_name():
    actor = normalise_node(_make_node())
    assert actor.canonical_name == "Lazarus Group"


def test_normalise_node_description():
    actor = normalise_node(_make_node())
    assert "North Korean" in actor.description


def test_normalise_node_aliases():
    actor = normalise_node(_make_node())
    assert "Hidden Cobra" in actor.aliases
    assert "ZINC" in actor.aliases


def test_normalise_node_country_from_labels():
    actor = normalise_node(_make_node())
    assert actor.country == "north korea"
    assert actor.country_code == "KP"


def test_normalise_node_motivation():
    actor = normalise_node(_make_node())
    assert "espionage" in actor.motivation


def test_normalise_node_secondary_motivation():
    actor = normalise_node(_make_node())
    assert "financial" in actor.motivation


def test_normalise_node_sophistication():
    actor = normalise_node(_make_node())
    assert actor.sophistication == "Nation-State Elite"


def test_normalise_node_first_seen():
    actor = normalise_node(_make_node())
    assert actor.first_seen == "2009"


def test_normalise_node_last_seen():
    actor = normalise_node(_make_node())
    assert actor.last_seen == "2024"


def test_normalise_node_source_is_opencti():
    actor = normalise_node(_make_node())
    assert len(actor.sources) == 1
    assert actor.sources[0].source == "opencti"


def test_normalise_node_source_id():
    actor = normalise_node(_make_node())
    assert actor.sources[0].source_id == "octi-123"


def test_normalise_node_threat_level_in_range():
    actor = normalise_node(_make_node())
    assert 1 <= actor.threat_level <= 10


def test_normalise_node_valid_rarity():
    actor = normalise_node(_make_node())
    assert actor.rarity in {"MYTHIC", "LEGENDARY", "EPIC", "RARE"}


def test_normalise_node_tlp_white():
    actor = normalise_node(_make_node())
    assert actor.tlp == "WHITE"


def test_normalise_node_missing_name_returns_none():
    actor = normalise_node({"id": "x", "description": "desc"})
    assert actor is None


def test_normalise_node_empty_aliases():
    node = _make_node({"aliases": None})
    actor = normalise_node(node)
    assert actor is not None
    assert actor.aliases == []


def test_normalise_node_no_labels():
    node = _make_node({"objectLabel": {"edges": []}})
    actor = normalise_node(node)
    assert actor is not None
    assert actor.country is None


# ---------------------------------------------------------------------------
# fetch_intrusion_sets
# ---------------------------------------------------------------------------


def test_fetch_returns_empty_when_no_url():
    result = fetch_intrusion_sets("", "key")
    assert result == []


def test_fetch_returns_empty_when_request_fails():
    with patch.object(_opencti_sync, "_requests") as mock_req:
        mock_req.post.side_effect = Exception("Network error")
        result = fetch_intrusion_sets("https://opencti.test", "key")
    assert result == []


def _make_graphql_response(nodes: list[dict], has_next: bool = False) -> dict:
    return {
        "data": {
            "intrusionSets": {
                "pageInfo": {"hasNextPage": has_next, "endCursor": None},
                "edges": [{"node": n} for n in nodes],
            }
        }
    }


def test_fetch_parses_single_page():
    node = _make_node()
    mock_resp = MagicMock()
    mock_resp.json.return_value = _make_graphql_response([node])
    mock_resp.raise_for_status = MagicMock()

    with patch.object(_opencti_sync, "_requests") as mock_req:
        mock_req.post.return_value = mock_resp
        result = fetch_intrusion_sets("https://opencti.test", "key")

    assert len(result) == 1


def test_fetch_handles_graphql_errors():
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"errors": [{"message": "Permission denied"}]}
    mock_resp.raise_for_status = MagicMock()

    with patch.object(_opencti_sync, "_requests") as mock_req:
        mock_req.post.return_value = mock_resp
        result = fetch_intrusion_sets("https://opencti.test", "key")

    assert result == []


def test_fetch_paginates_multiple_pages():
    node1 = _make_node({"id": "n1", "name": "Actor1"})
    node2 = _make_node({"id": "n2", "name": "Actor2"})

    page1_resp = MagicMock()
    page1_resp.raise_for_status = MagicMock()
    page1_resp.json.return_value = {
        "data": {
            "intrusionSets": {
                "pageInfo": {"hasNextPage": True, "endCursor": "cursor1"},
                "edges": [{"node": node1}],
            }
        }
    }

    page2_resp = MagicMock()
    page2_resp.raise_for_status = MagicMock()
    page2_resp.json.return_value = {
        "data": {
            "intrusionSets": {
                "pageInfo": {"hasNextPage": False, "endCursor": None},
                "edges": [{"node": node2}],
            }
        }
    }

    with patch.object(_opencti_sync, "_requests") as mock_req:
        mock_req.post.side_effect = [page1_resp, page2_resp]
        result = fetch_intrusion_sets("https://opencti.test", "key")

    assert len(result) == 2


# ---------------------------------------------------------------------------
# run_sync
# ---------------------------------------------------------------------------


def test_run_sync_skips_no_url():
    count = run_sync(None, opencti_url="", api_key="key")
    assert count == 0


def test_run_sync_skips_no_api_key():
    count = run_sync(None, opencti_url="https://opencti.test", api_key="")
    assert count == 0


def test_run_sync_returns_actor_count_without_engine():
    node = _make_node()
    mock_resp = MagicMock()
    mock_resp.json.return_value = _make_graphql_response([node])
    mock_resp.raise_for_status = MagicMock()

    with patch.object(_opencti_sync, "_requests") as mock_req:
        mock_req.post.return_value = mock_resp
        count = run_sync(None, opencti_url="https://opencti.test", api_key="key")

    assert count == 1


def test_run_sync_returns_zero_when_no_nodes():
    with patch.object(_opencti_sync, "fetch_intrusion_sets", return_value=[]):
        count = run_sync(None, opencti_url="https://opencti.test", api_key="key")
    assert count == 0
