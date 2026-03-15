/**
 * Playwright smoke tests for the ThreatDex actor detail page (/actors/[id]).
 *
 * Intercepts API calls so tests run without a live backend.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared actor fixture
// ---------------------------------------------------------------------------

const MOCK_ACTOR = {
  id: "apt29",
  canonicalName: "APT29",
  aliases: ["Cozy Bear", "The Dukes"],
  mitreId: "G0016",
  country: "Russia",
  countryCode: "RU",
  motivation: ["espionage"],
  threatLevel: 9,
  sophistication: "Nation-State Elite",
  firstSeen: "2008",
  lastSeen: "2024",
  sectors: ["Government", "Think Tanks"],
  geographies: ["North America", "Europe"],
  tools: ["MiniDuke", "CosmicDuke"],
  ttps: [
    {
      techniqueId: "T1566",
      techniqueName: "Phishing",
      tactic: "Initial Access",
    },
    {
      techniqueId: "T1195",
      techniqueName: "Supply Chain Compromise",
      tactic: "Initial Access",
    },
  ],
  campaigns: [
    {
      name: "SolarWinds SUNBURST",
      year: "2020",
      description:
        "Supply chain attack targeting government and enterprise networks worldwide.",
    },
  ],
  description:
    "APT29 is attributed to Russia's Foreign Intelligence Service (SVR). Known for long-term stealthy access and sophisticated tradecraft.",
  tagline: "Silence is the weapon of choice.",
  rarity: "MYTHIC",
  imageUrl: null,
  sources: [
    {
      source: "mitre",
      sourceId: "G0016",
      fetchedAt: "2026-01-01T00:00:00Z",
      url: "https://attack.mitre.org/groups/G0016/",
    },
  ],
  tlp: "WHITE",
  lastUpdated: "2026-01-01T00:00:00Z",
};

test.describe("Actor detail page — smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept the actor detail API call
    await page.route("**/api/actors/apt29", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ACTOR),
      });
    });

    await page.goto("/actors/apt29");
  });

  test("page contains actor canonical name", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /APT29/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("page title contains actor name and ThreatDex", async ({ page }) => {
    await expect(page).toHaveTitle(/APT29.*ThreatDex|ThreatDex.*APT29/i, {
      timeout: 10_000,
    });
  });

  test("back navigation link is present", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /back to all actors/i }),
    ).toBeVisible();
  });

  test("MITRE ID link is shown", async ({ page }) => {
    await expect(page.getByText("G0016")).toBeVisible();
  });

  test("actor tagline is displayed", async ({ page }) => {
    await expect(page.getByText(/silence is the weapon/i)).toBeVisible();
  });

  test("aliases are displayed", async ({ page }) => {
    await expect(page.getByText(/Cozy Bear/)).toBeVisible();
    await expect(page.getByText(/The Dukes/)).toBeVisible();
  });

  test("origin country is shown", async ({ page }) => {
    await expect(page.getByText(/Russia/)).toBeVisible();
  });

  test("threat level is displayed", async ({ page }) => {
    // The stats grid shows the threat level number
    await expect(page.getByText("9")).toBeVisible();
  });

  test("TLP classification is shown", async ({ page }) => {
    await expect(page.getByText(/TLP:WHITE/)).toBeVisible();
  });

  test("motivation tags are shown", async ({ page }) => {
    await expect(
      page.getByText("espionage", { exact: false }),
    ).toBeVisible();
  });

  test("description is rendered", async ({ page }) => {
    await expect(page.getByText(/Foreign Intelligence Service/)).toBeVisible();
  });

  test("target sectors are shown", async ({ page }) => {
    await expect(page.getByText(/Government/)).toBeVisible();
  });

  test("TTPs section is rendered", async ({ page }) => {
    await expect(page.getByText("T1566")).toBeVisible();
  });

  test("campaigns section is rendered", async ({ page }) => {
    await expect(page.getByText("SolarWinds SUNBURST")).toBeVisible();
  });

  test("sources section is rendered", async ({ page }) => {
    await expect(page.getByText(/MITRE ATT&CK/)).toBeVisible();
  });

  test("card flip button is accessible", async ({ page }) => {
    // The card flip button should be present
    const flipBtn = page.getByRole("button", { name: /show card back/i });
    await expect(flipBtn).toBeVisible();
  });

  test("404 page is shown for unknown actor", async ({ page }) => {
    await page.route("**/api/actors/unknown-actor", async (route) => {
      await route.fulfill({ status: 404, body: '{"detail":"Not found"}' });
    });

    await page.goto("/actors/unknown-actor");
    // Next.js shows a 404 page
    await expect(page.getByText(/404|not found/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
