"""
Unit tests for the image-gen worker's prompt builder and related utilities.

These tests verify the prompt generation logic without making any OpenAI
API calls or requiring a database connection.
"""

from __future__ import annotations

import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Path setup
# The worker directory name ("image-gen") contains a hyphen and cannot be
# imported as a Python package directly. We load worker.py explicitly via
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
    "image_gen_module",
    os.path.join(_WORKER_DIR, "worker.py"),
)
_image_gen = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
sys.modules["image_gen_module"] = _image_gen
_spec.loader.exec_module(_image_gen)  # type: ignore[union-attr]

_RARITY_STYLE = _image_gen._RARITY_STYLE
_SOPHISTICATION_DESCRIPTORS = _image_gen._SOPHISTICATION_DESCRIPTORS
build_image_prompt = _image_gen.build_image_prompt
generate_image_for_actor = _image_gen.generate_image_for_actor

# ---------------------------------------------------------------------------
# Sample actor data fixtures
# ---------------------------------------------------------------------------

FULL_ACTOR: dict = {
    "id": "apt28",
    "canonical_name": "APT28",
    "country": "Russia",
    "sophistication": "Nation-State Elite",
    "motivation": ["espionage", "military"],
    "tools": ["X-Agent", "Sofacy", "Zebrocy"],
    "rarity": "MYTHIC",
    "description": "Russian GRU-linked advanced persistent threat.",
    "threat_level": 9,
}

MINIMAL_ACTOR: dict = {
    "id": "unknown-apt",
    "canonical_name": "",
}

NO_COUNTRY_ACTOR: dict = {
    "id": "apt-nocountry",
    "canonical_name": "Mystery APT",
    "country": None,
    "sophistication": "High",
    "motivation": ["financial"],
    "tools": [],
    "rarity": "EPIC",
}

FINANCIAL_ACTOR: dict = {
    "id": "lazarus",
    "canonical_name": "Lazarus Group",
    "country": "North Korea",
    "sophistication": "Very High",
    "motivation": ["financial", "sabotage"],
    "tools": ["BLINDINGCAN", "HOPLIGHT"],
    "rarity": "LEGENDARY",
}


# ---------------------------------------------------------------------------
# Test: build_image_prompt
# ---------------------------------------------------------------------------


class TestBuildImagePrompt:
    def test_returns_string(self) -> None:
        result = build_image_prompt(FULL_ACTOR)
        assert isinstance(result, str)

    def test_non_empty(self) -> None:
        result = build_image_prompt(FULL_ACTOR)
        assert len(result) > 20

    def test_contains_actor_name(self) -> None:
        result = build_image_prompt(FULL_ACTOR)
        assert "APT28" in result

    def test_contains_country_name(self) -> None:
        result = build_image_prompt(FULL_ACTOR)
        assert "Russia" in result

    def test_contains_sophistication_descriptor(self) -> None:
        result = build_image_prompt(FULL_ACTOR)
        soph_desc = _SOPHISTICATION_DESCRIPTORS["Nation-State Elite"]
        # Check at least part of the descriptor appears
        assert any(word in result for word in soph_desc.split())

    def test_contains_rarity_style(self) -> None:
        result = build_image_prompt(FULL_ACTOR)
        rarity_keywords = _RARITY_STYLE["MYTHIC"].split(",")[0].strip().split()
        assert any(kw.lower() in result.lower() for kw in rarity_keywords)

    def test_contains_tool_names(self) -> None:
        result = build_image_prompt(FULL_ACTOR)
        assert "X-Agent" in result or "Sofacy" in result

    def test_tool_list_limited_to_three(self) -> None:
        actor = dict(FULL_ACTOR)
        actor["tools"] = ["Tool1", "Tool2", "Tool3", "Tool4", "Tool5"]
        result = build_image_prompt(actor)
        # Only first three should appear
        assert "Tool1" in result
        assert "Tool4" not in result
        assert "Tool5" not in result

    def test_no_country_does_not_crash(self) -> None:
        result = build_image_prompt(NO_COUNTRY_ACTOR)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_no_country_omits_country_reference(self) -> None:
        result = build_image_prompt(NO_COUNTRY_ACTOR)
        # Should not contain "None" literally
        assert "None" not in result

    def test_minimal_actor_does_not_crash(self) -> None:
        """Prompt builder must not raise even with nearly empty input."""
        result = build_image_prompt(MINIMAL_ACTOR)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_minimal_actor_uses_id_as_fallback(self) -> None:
        result = build_image_prompt(MINIMAL_ACTOR)
        assert "unknown-apt" in result

    def test_financial_motivation_referenced(self) -> None:
        result = build_image_prompt(FINANCIAL_ACTOR)
        # "financially motivated" or similar should appear
        assert "financial" in result.lower()

    def test_legendary_rarity_style(self) -> None:
        result = build_image_prompt(FINANCIAL_ACTOR)
        assert "legendary" in result.lower() or "golden" in result.lower()

    def test_base_style_present(self) -> None:
        result = build_image_prompt(FULL_ACTOR)
        assert "cyberpunk" in result.lower()
        assert "navy" in result.lower() or "#00123F" in result

    def test_different_actors_produce_different_prompts(self) -> None:
        prompt_apt28 = build_image_prompt(FULL_ACTOR)
        prompt_lazarus = build_image_prompt(FINANCIAL_ACTOR)
        assert prompt_apt28 != prompt_lazarus

    def test_empty_motivation_list_does_not_crash(self) -> None:
        actor = dict(FULL_ACTOR)
        actor["motivation"] = []
        result = build_image_prompt(actor)
        assert isinstance(result, str)

    def test_empty_tools_does_not_crash(self) -> None:
        actor = dict(FULL_ACTOR)
        actor["tools"] = []
        result = build_image_prompt(actor)
        assert isinstance(result, str)


# ---------------------------------------------------------------------------
# Test: generate_image_for_actor — feature-flag behaviour
# ---------------------------------------------------------------------------


class TestGenerateImageForActor:
    def test_skips_gracefully_without_api_key(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Must return None (not raise) when OPENAI_API_KEY is absent."""
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        result = generate_image_for_actor(FULL_ACTOR)
        assert result is None

    def test_skips_gracefully_without_openai_library(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Must return None if openai is not importable."""
        monkeypatch.setenv("OPENAI_API_KEY", "fake-key")
        with patch("image_gen_module._OPENAI_AVAILABLE", False):
            result = generate_image_for_actor(FULL_ACTOR)
        assert result is None

    def test_no_exception_on_api_failure(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """API errors must be caught and return None rather than propagating."""
        monkeypatch.setenv("OPENAI_API_KEY", "fake-key")

        mock_openai = MagicMock()
        mock_openai.OpenAI.return_value.images.generate.side_effect = RuntimeError(
            "Simulated API error"
        )

        with patch("image_gen_module._OPENAI_AVAILABLE", True), \
             patch("image_gen_module._openai_module", mock_openai):
            result = generate_image_for_actor(FULL_ACTOR)

        assert result is None

    def test_returns_path_on_success(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: pytest.TempPathFactory
    ) -> None:
        """On success, must return a string path to the saved image."""
        monkeypatch.setenv("OPENAI_API_KEY", "fake-key")

        # Mock OpenAI response
        mock_image_data = MagicMock()
        mock_image_data.url = "https://example.com/image.png"
        mock_openai = MagicMock()
        mock_openai.OpenAI.return_value.images.generate.return_value.data = [mock_image_data]

        # Mock the HTTP download to write a fake PNG
        def fake_download(url: str, output_path) -> bool:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(b"\x89PNG\r\n\x1a\nfake")
            return True

        with patch("image_gen_module._OPENAI_AVAILABLE", True), \
             patch("image_gen_module._openai_module", mock_openai), \
             patch("image_gen_module._download_image", side_effect=fake_download), \
             patch("image_gen_module.IMAGE_OUTPUT_DIR", tmp_path):
            result = generate_image_for_actor(FULL_ACTOR)

        assert result is not None
        assert "apt28" in result
        assert result.endswith(".png")


# ---------------------------------------------------------------------------
# Test: prompt style consistency
# ---------------------------------------------------------------------------


class TestPromptStyleConsistency:
    """Verify all rarity tiers and sophistication levels produce valid prompts."""

    @pytest.mark.parametrize("rarity", ["MYTHIC", "LEGENDARY", "EPIC", "RARE"])
    def test_all_rarity_tiers(self, rarity: str) -> None:
        actor = dict(FULL_ACTOR)
        actor["rarity"] = rarity
        result = build_image_prompt(actor)
        assert isinstance(result, str)
        assert len(result) > 20

    @pytest.mark.parametrize(
        "sophistication",
        ["Low", "Medium", "High", "Very High", "Nation-State Elite"],
    )
    def test_all_sophistication_levels(self, sophistication: str) -> None:
        actor = dict(FULL_ACTOR)
        actor["sophistication"] = sophistication
        result = build_image_prompt(actor)
        assert isinstance(result, str)
        assert len(result) > 20

    @pytest.mark.parametrize(
        "motivation",
        ["espionage", "financial", "sabotage", "hacktivism", "military"],
    )
    def test_all_motivations(self, motivation: str) -> None:
        actor = dict(FULL_ACTOR)
        actor["motivation"] = [motivation]
        result = build_image_prompt(actor)
        assert isinstance(result, str)
        assert len(result) > 20
