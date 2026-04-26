import { describe, expect, it } from "vitest"
import { buildImagePrompt, buildPromptProfile } from "../../workers/image-prompts"

const topActors = [
  { id: "teampcp", canonical_name: "TeamPCP", country: "Unknown", motivation: ["financial", "sabotage"], sophistication: "High", rarity: "LEGENDARY" },
  { id: "oilrig", canonical_name: "OilRig", country: "Iran", motivation: ["espionage"], sophistication: "Low", rarity: "RARE" },
  { id: "magic-hound", canonical_name: "Magic Hound", country: "Iran", motivation: ["espionage"], sophistication: "Low", rarity: "RARE" },
  { id: "patchwork", canonical_name: "Patchwork", country: "India", motivation: ["espionage"], sophistication: "Low", rarity: "RARE" },
  { id: "taidoor", canonical_name: "Taidoor", motivation: ["espionage"], sophistication: "Low", rarity: "RARE" },
  { id: "neodymium", canonical_name: "NEODYMIUM", country: "Turkey", motivation: ["espionage"], sophistication: "Low", rarity: "RARE" },
  { id: "moafee", canonical_name: "Moafee", country: "China", motivation: ["espionage"], sophistication: "Low", rarity: "RARE" },
  { id: "apt16", canonical_name: "APT16", country: "China", motivation: ["espionage"], sophistication: "Low", rarity: "RARE" },
  { id: "scarlet-mimic", canonical_name: "Scarlet Mimic", country: "China", motivation: ["espionage"], sophistication: "Low", rarity: "RARE" },
  { id: "applejeus", canonical_name: "AppleJeus", country: "North Korea", motivation: ["espionage"], sophistication: "High", rarity: "RARE" },
]

describe("image prompt diversity", () => {
  it("gives current top actors distinct visual subjects and signatures", () => {
    const profiles = topActors.map((actor) => buildPromptProfile(actor))

    expect(new Set(profiles.map((profile) => profile.subject)).size).toBe(topActors.length)
    expect(new Set(profiles.map((profile) => profile.signature)).size).toBe(topActors.length)
    expect(profiles.some((profile) => profile.subject.includes("menacing cyber entity"))).toBe(false)
  })

  it("does not let aliases override explicit actor visual briefs", () => {
    const oilRig = buildPromptProfile({
      id: "oilrig",
      canonical_name: "OilRig",
      aliases: ["Helix Kitten"],
      country: "Iran",
      motivation: ["espionage"],
      sophistication: "Low",
      rarity: "RARE",
    })

    expect(oilRig.subject).toContain("drilling rig")
    expect(oilRig.signature).toContain("drill head")
  })

  it("asks for origin flag colors as abstract visual accents", () => {
    const prompt = buildImagePrompt({
      id: "apt41",
      canonical_name: "APT41",
      country: "China",
      motivation: ["espionage"],
      sophistication: "High",
      rarity: "MYTHIC",
    })

    expect(prompt).toContain("China origin palette inspired by its national flag colors")
    expect(prompt).toContain("abstract light bands")
    expect(prompt).toContain("no literal flag")
  })
})
