import { test, expect } from "@playwright/test"

test("home page loads", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByText("ThreatDex")).toBeVisible()
  await expect(page.getByPlaceholder(/search/i)).toBeVisible()
})
