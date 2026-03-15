/**
 * Playwright smoke tests for the ThreatDex home page.
 *
 * These tests verify the core UI structure and interactions of the main
 * card grid page. They run against a live Next.js server (started by the
 * webServer config or an external process in CI).
 *
 * Because the API backend may not be running in e2e mode, we test the static
 * shell (navigation, search bar, filter panel) and graceful empty-state
 * rendering rather than live data.
 */

import { test, expect } from "@playwright/test";

test.describe("Home page — static shell smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept API calls so tests are backend-independent
    await page.route("**/api/actors**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "apt28",
              canonicalName: "APT28",
              aliases: ["Fancy Bear"],
              mitreId: "G0007",
              country: "Russia",
              countryCode: "RU",
              motivation: ["espionage"],
              threatLevel: 9,
              sophistication: "Nation-State Elite",
              firstSeen: "2004",
              lastSeen: "2024",
              sectors: ["Government"],
              geographies: ["Europe"],
              tools: ["Mimikatz"],
              ttps: [],
              campaigns: [],
              description: "GRU-linked threat actor.",
              tagline: "Russia's cyber spear.",
              rarity: "MYTHIC",
              sources: [],
              tlp: "WHITE",
              lastUpdated: "2026-01-01T00:00:00Z",
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        }),
      });
    });

    await page.goto("/");
  });

  test("page title contains ThreatDex", async ({ page }) => {
    await expect(page).toHaveTitle(/ThreatDex/i);
  });

  test("navigation bar is visible", async ({ page }) => {
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("logo link is present", async ({ page }) => {
    await expect(page.getByRole("link", { name: /threatdex home/i })).toBeVisible();
  });

  test("search bar is rendered", async ({ page }) => {
    const searchInput = page.getByRole("searchbox");
    await expect(searchInput).toBeVisible();
  });

  test("search input has correct placeholder", async ({ page }) => {
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test("filter panel renders motivation buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: /espionage/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /financial/i })).toBeVisible();
  });

  test("actor card appears after API response", async ({ page }) => {
    // Wait for the card grid to load
    await expect(page.getByText("APT28")).toBeVisible({ timeout: 10_000 });
  });

  test("View Details link points to actor detail page", async ({ page }) => {
    await page.waitForSelector('[href="/actors/apt28"]', { timeout: 10_000 });
    const link = page.locator('[href="/actors/apt28"]').first();
    await expect(link).toBeVisible();
  });

  test("searching updates URL with query param", async ({ page }) => {
    const searchInput = page.getByRole("searchbox");
    await searchInput.fill("Lazarus");
    await searchInput.press("Enter");
    await expect(page).toHaveURL(/q=Lazarus/);
  });

  test("rarity filter select is rendered", async ({ page }) => {
    await expect(page.getByRole("combobox", { name: /filter by rarity/i })).toBeVisible();
  });

  test("BETA badge is visible in nav", async ({ page }) => {
    await expect(page.getByText("BETA")).toBeVisible();
  });
});
