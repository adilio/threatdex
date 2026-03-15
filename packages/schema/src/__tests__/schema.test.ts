import { describe, it, expect } from "vitest"
import {
  ThreatActorSchema,
  TTPUsageSchema,
  CampaignSchema,
  SourceAttributionSchema,
  getRarityColor,
  getRarityGlowClass,
  getThreatLevelLabel,
  getSophisticationScore,
  type ThreatActor,
} from "../index"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validTTPUsage = {
  techniqueId: "T1566",
  techniqueName: "Phishing",
  tactic: "Initial Access",
}

const validCampaign = {
  name: "Operation Dragon Fire",
  year: "2023",
  description: "Targeted financial institutions in Southeast Asia.",
}

const validSource = {
  source: "mitre" as const,
  sourceId: "G0007",
  fetchedAt: "2024-01-15T00:00:00.000Z",
  url: "https://attack.mitre.org/groups/G0007/",
}

const validActor: ThreatActor = {
  id: "apt28",
  canonicalName: "APT28",
  aliases: ["Fancy Bear", "Sofacy", "STRONTIUM"],
  mitreId: "G0007",
  country: "Russia",
  countryCode: "RU",
  motivation: ["espionage", "sabotage"],
  threatLevel: 9,
  sophistication: "Nation-State Elite",
  firstSeen: "2004",
  lastSeen: "2024",
  sectors: ["Government", "Defense", "Energy"],
  geographies: ["Europe", "United States", "Middle East"],
  tools: ["X-Agent", "X-Tunnel", "Zebrocy"],
  ttps: [validTTPUsage],
  campaigns: [validCampaign],
  description:
    "APT28 is a threat group attributed to Russia's General Staff Main Intelligence Directorate (GRU).",
  tagline: "Russia's premier cyber espionage unit.",
  rarity: "MYTHIC",
  imageUrl: "https://cdn.threatdex.io/actors/apt28.png",
  imagePrompt:
    "A shadowy figure in front of the Kremlin with glowing blue cyber networks",
  sources: [validSource],
  tlp: "WHITE",
  lastUpdated: "2024-01-15T00:00:00.000Z",
}

// ---------------------------------------------------------------------------
// ThreatActorSchema
// ---------------------------------------------------------------------------

describe("ThreatActorSchema", () => {
  it("parses a valid ThreatActor successfully", () => {
    const result = ThreatActorSchema.safeParse(validActor)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe("apt28")
      expect(result.data.canonicalName).toBe("APT28")
      expect(result.data.rarity).toBe("MYTHIC")
    }
  })

  it("rejects threatLevel above 10", () => {
    const result = ThreatActorSchema.safeParse({ ...validActor, threatLevel: 11 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("threatLevel"))
      expect(issue).toBeDefined()
    }
  })

  it("rejects threatLevel below 1", () => {
    const result = ThreatActorSchema.safeParse({ ...validActor, threatLevel: 0 })
    expect(result.success).toBe(false)
  })

  it("rejects invalid motivation value", () => {
    const result = ThreatActorSchema.safeParse({
      ...validActor,
      motivation: ["cyber-warfare"],
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty motivation array", () => {
    const result = ThreatActorSchema.safeParse({ ...validActor, motivation: [] })
    expect(result.success).toBe(false)
  })

  it("rejects invalid rarity value", () => {
    const result = ThreatActorSchema.safeParse({ ...validActor, rarity: "COMMON" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid TLP value", () => {
    const result = ThreatActorSchema.safeParse({ ...validActor, tlp: "RED" })
    expect(result.success).toBe(false)
  })

  it("rejects malformed mitreId", () => {
    const result = ThreatActorSchema.safeParse({ ...validActor, mitreId: "APT28" })
    expect(result.success).toBe(false)
  })

  it("accepts actor without optional fields", () => {
    const minimal: ThreatActor = {
      id: "unknown-actor",
      canonicalName: "Unknown Actor",
      aliases: [],
      motivation: ["espionage"],
      threatLevel: 5,
      sophistication: "Medium",
      sectors: [],
      geographies: [],
      tools: [],
      ttps: [],
      campaigns: [],
      description: "An unknown threat actor.",
      rarity: "RARE",
      sources: [],
      tlp: "WHITE",
      lastUpdated: "2024-01-15T00:00:00.000Z",
    }
    const result = ThreatActorSchema.safeParse(minimal)
    expect(result.success).toBe(true)
  })

  it("rejects countryCode that is not 2 characters", () => {
    const result = ThreatActorSchema.safeParse({
      ...validActor,
      countryCode: "RUS",
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// TTPUsageSchema
// ---------------------------------------------------------------------------

describe("TTPUsageSchema", () => {
  it("parses a valid top-level technique", () => {
    const result = TTPUsageSchema.safeParse(validTTPUsage)
    expect(result.success).toBe(true)
  })

  it("parses a sub-technique id", () => {
    const result = TTPUsageSchema.safeParse({
      ...validTTPUsage,
      techniqueId: "T1566.001",
    })
    expect(result.success).toBe(true)
  })

  it("rejects an invalid techniqueId format", () => {
    const result = TTPUsageSchema.safeParse({ ...validTTPUsage, techniqueId: "TA0001" })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CampaignSchema
// ---------------------------------------------------------------------------

describe("CampaignSchema", () => {
  it("parses a valid campaign", () => {
    expect(CampaignSchema.safeParse(validCampaign).success).toBe(true)
  })

  it("rejects a campaign with an invalid year (not 4 digits)", () => {
    const result = CampaignSchema.safeParse({ ...validCampaign, year: "23" })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SourceAttributionSchema
// ---------------------------------------------------------------------------

describe("SourceAttributionSchema", () => {
  it("parses a valid source attribution", () => {
    expect(SourceAttributionSchema.safeParse(validSource).success).toBe(true)
  })

  it("rejects an unknown source name", () => {
    const result = SourceAttributionSchema.safeParse({
      ...validSource,
      source: "virustotal",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a malformed url", () => {
    const result = SourceAttributionSchema.safeParse({
      ...validSource,
      url: "not-a-url",
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe("getRarityColor", () => {
  it("returns surprising yellow for MYTHIC", () => {
    expect(getRarityColor("MYTHIC")).toBe("#FFFF00")
  })

  it("returns vibrant pink for LEGENDARY", () => {
    expect(getRarityColor("LEGENDARY")).toBe("#FF0BBE")
  })

  it("returns light sky blue for EPIC", () => {
    expect(getRarityColor("EPIC")).toBe("#978BFF")
  })

  it("returns sky blue for RARE", () => {
    expect(getRarityColor("RARE")).toBe("#6197FF")
  })
})

describe("getRarityGlowClass", () => {
  it("returns correct CSS class for each rarity", () => {
    expect(getRarityGlowClass("MYTHIC")).toBe("rarity-glow-mythic")
    expect(getRarityGlowClass("LEGENDARY")).toBe("rarity-glow-legendary")
    expect(getRarityGlowClass("EPIC")).toBe("rarity-glow-epic")
    expect(getRarityGlowClass("RARE")).toBe("rarity-glow-rare")
  })
})

describe("getThreatLevelLabel", () => {
  it("returns Low for 1–2", () => {
    expect(getThreatLevelLabel(1)).toBe("Low")
    expect(getThreatLevelLabel(2)).toBe("Low")
  })

  it("returns Medium for 3–4", () => {
    expect(getThreatLevelLabel(3)).toBe("Medium")
    expect(getThreatLevelLabel(4)).toBe("Medium")
  })

  it("returns High for 5–6", () => {
    expect(getThreatLevelLabel(5)).toBe("High")
    expect(getThreatLevelLabel(6)).toBe("High")
  })

  it("returns Critical for 7–8", () => {
    expect(getThreatLevelLabel(7)).toBe("Critical")
    expect(getThreatLevelLabel(8)).toBe("Critical")
  })

  it("returns Catastrophic for 9–10", () => {
    expect(getThreatLevelLabel(9)).toBe("Catastrophic")
    expect(getThreatLevelLabel(10)).toBe("Catastrophic")
  })
})

describe("getSophisticationScore", () => {
  it("returns 1 for Low", () => {
    expect(getSophisticationScore("Low")).toBe(1)
  })

  it("returns 2 for Medium", () => {
    expect(getSophisticationScore("Medium")).toBe(2)
  })

  it("returns 3 for High", () => {
    expect(getSophisticationScore("High")).toBe(3)
  })

  it("returns 4 for Very High", () => {
    expect(getSophisticationScore("Very High")).toBe(4)
  })

  it("returns 5 for Nation-State Elite", () => {
    expect(getSophisticationScore("Nation-State Elite")).toBe(5)
  })
})
