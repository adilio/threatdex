import { describe, it, expect } from "vitest"
import { computeThreatLevel, computeRarity } from "../../workers/shared/rarity"

describe("computeThreatLevel", () => {
  it("returns higher level for nation-state elite actors", () => {
    const level = computeThreatLevel({
      sophistication: "Nation-State Elite",
      ttpsCount: 50,
      campaignsCount: 10,
    })
    expect(level).toBeGreaterThanOrEqual(8)
  })

  it("returns lower level for low sophistication actors", () => {
    const level = computeThreatLevel({
      sophistication: "Low",
      ttpsCount: 2,
      campaignsCount: 0,
    })
    expect(level).toBeLessThanOrEqual(4)
  })
})

describe("computeRarity", () => {
  it("assigns MYTHIC to highest threat level actors", () => {
    const rarity = computeRarity({
      threatLevel: 10,
      sophistication: "Nation-State Elite",
      sourcesCount: 3,
    })
    expect(rarity).toBe("MYTHIC")
  })

  it("assigns RARE to low threat level actors", () => {
    const rarity = computeRarity({
      threatLevel: 2,
      sophistication: "Low",
      sourcesCount: 1,
    })
    expect(rarity).toBe("RARE")
  })
})
