"""Tests for workers/shared/rarity.py — compute_rarity and compute_threat_level."""

import sys
import os

# Ensure workers root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.rarity import compute_rarity, compute_threat_level


# ---------------------------------------------------------------------------
# compute_rarity
# ---------------------------------------------------------------------------


class TestComputeRarity:
    def test_mythic_nation_state_elite_level_9(self):
        assert compute_rarity(9, "Nation-State Elite", 0) == "MYTHIC"

    def test_mythic_nation_state_elite_level_10(self):
        assert compute_rarity(10, "Nation-State Elite", 0) == "MYTHIC"

    def test_mythic_boosted_by_sources(self):
        # Level 8 + sources_count >= 3 → effective_level 9 → MYTHIC with Nation-State Elite
        assert compute_rarity(8, "Nation-State Elite", 3) == "MYTHIC"

    def test_legendary_nation_state_level_7(self):
        assert compute_rarity(7, "Nation-State Elite", 0) == "LEGENDARY"

    def test_legendary_very_high_level_7(self):
        assert compute_rarity(7, "Very High", 0) == "LEGENDARY"

    def test_legendary_very_high_level_8(self):
        assert compute_rarity(8, "Very High", 0) == "LEGENDARY"

    def test_epic_very_high_level_5(self):
        assert compute_rarity(5, "Very High", 0) == "EPIC"

    def test_epic_high_level_5(self):
        assert compute_rarity(5, "High", 0) == "EPIC"

    def test_epic_high_level_6(self):
        assert compute_rarity(6, "High", 0) == "EPIC"

    def test_rare_low_sophistication(self):
        assert compute_rarity(3, "Low", 0) == "RARE"

    def test_rare_medium_high_threat(self):
        # Medium sophistication cannot reach EPIC
        assert compute_rarity(7, "Medium", 0) == "RARE"

    def test_rare_high_soph_low_level(self):
        assert compute_rarity(4, "High", 0) == "RARE"

    def test_source_bonus_capped_at_10(self):
        # Level 10 + sources >= 3 → effective_level capped at 10, still MYTHIC
        assert compute_rarity(10, "Nation-State Elite", 5) == "MYTHIC"

    def test_no_source_bonus_below_3(self):
        # sources_count=2 should not boost level
        # Level 8 + High → LEGENDARY without boost; with boost (sources=2 < 3) still EPIC
        result = compute_rarity(6, "High", 2)
        assert result == "EPIC"

    def test_source_bonus_exactly_3(self):
        # sources_count exactly 3 should trigger the +1 bonus
        # Level 6 + Nation-State Elite + bonus → 7 → LEGENDARY
        assert compute_rarity(6, "Nation-State Elite", 3) == "LEGENDARY"

    def test_returns_string(self):
        result = compute_rarity(5, "High", 0)
        assert isinstance(result, str)

    def test_valid_return_values(self):
        valid = {"MYTHIC", "LEGENDARY", "EPIC", "RARE"}
        for level in range(1, 11):
            for soph in ["Low", "Medium", "High", "Very High", "Nation-State Elite"]:
                result = compute_rarity(level, soph, 0)
                assert result in valid, f"Unexpected rarity: {result}"


# ---------------------------------------------------------------------------
# compute_threat_level
# ---------------------------------------------------------------------------


class TestComputeThreatLevel:
    def test_base_nation_state_elite(self):
        # Base=5, no ttps/campaigns → 5
        assert compute_threat_level("Nation-State Elite", 0, 0) == 5

    def test_base_very_high(self):
        assert compute_threat_level("Very High", 0, 0) == 4

    def test_base_high(self):
        assert compute_threat_level("High", 0, 0) == 3

    def test_base_medium(self):
        assert compute_threat_level("Medium", 0, 0) == 2

    def test_base_low(self):
        assert compute_threat_level("Low", 0, 0) == 1

    def test_ttp_bonus_single(self):
        # 5 TTPs → +1 bonus
        assert compute_threat_level("Low", 5, 0) == 2

    def test_ttp_bonus_max(self):
        # 15+ TTPs → max +3 bonus
        assert compute_threat_level("Low", 15, 0) == 4

    def test_ttp_bonus_capped_at_3(self):
        # 30 TTPs → still only +3
        assert compute_threat_level("Low", 30, 0) == 4

    def test_campaign_bonus_single(self):
        # 2 campaigns → +1
        assert compute_threat_level("Low", 0, 2) == 2

    def test_campaign_bonus_max(self):
        # 4+ campaigns → max +2
        assert compute_threat_level("Low", 0, 4) == 3

    def test_campaign_bonus_capped_at_2(self):
        # 10 campaigns → still only +2
        assert compute_threat_level("Low", 0, 10) == 3

    def test_combined_bonus(self):
        # Nation-State Elite (5) + 10 ttps (+2) + 4 campaigns (+2) = 9
        assert compute_threat_level("Nation-State Elite", 10, 4) == 9

    def test_result_clamped_to_10(self):
        # Nation-State Elite (5) + max ttp bonus (3) + max campaign bonus (2) = 10
        assert compute_threat_level("Nation-State Elite", 20, 10) == 10

    def test_result_clamped_to_1(self):
        # Min score is 1 even with no TTPs
        assert compute_threat_level("Low", 0, 0) == 1

    def test_unknown_sophistication_defaults_to_base_1(self):
        # Unknown sophistication maps to base 1
        assert compute_threat_level("Unknown", 0, 0) == 1

    def test_returns_int(self):
        result = compute_threat_level("High", 5, 2)
        assert isinstance(result, int)

    def test_result_in_range(self):
        for soph in ["Low", "Medium", "High", "Very High", "Nation-State Elite"]:
            for ttps in [0, 5, 10, 20]:
                for cmp in [0, 2, 5]:
                    result = compute_threat_level(soph, ttps, cmp)
                    assert 1 <= result <= 10, f"Out of range: {result}"
