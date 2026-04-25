/**
 * Image prompt builder for ThreatDex actor cards.
 *
 * Principles:
 * - No text in the artwork (card UI overlays the name)
 * - No "card" framing (rarity foil is CSS, not part of image)
 * - Concrete environments instead of generic "country aesthetic"
 * - Subject motifs derived from real signals (tools, targets, TTPs)
 * - Rarity-appropriate accent colors
 */

type PromptProfile = {
  motif: string
  signals: string
  environment: string
  paletteAccent: string
}

// Rarity color accents for visual distinction
const RARITY_ACCENT: Record<string, string> = {
  MYTHIC: "molten gold and electric yellow",
  LEGENDARY: "vibrant magenta and pink",
  EPIC: "deep violet and indigo",
  RARE: "cool electric blue",
}

// Actor-specific overrides for high-value targets
// These provide distinctive imagery that generic derivation can't achieve
const ACTOR_OVERRIDES: Record<string, Partial<PromptProfile>> = {
  sandworm: {
    motif: "colossal armored worm rising through a crystallized circuit-board landscape",
    signals: "destructive intrusion against industrial control systems and power grids",
    environment: "frost-covered substation interior, red fault indicators glowing through ice",
  },
  lazarus: {
    motif: "vault door cracked open onto cascading currency and stolen credentials",
    signals: "financial intrusion, cryptocurrency theft, espionage against banks",
    environment: "neon-lit underground server room with monitor reflections",
  },
  apt28: {
    motif: "satellite uplink array bristling with antenna arrays under a steel sky",
    signals: "military intelligence, spear-phishing, credential theft",
    environment: "open-plan signals intelligence floor, map walls, midnight blue light",
  },
  apt29: {
    motif: "diplomatic archive of glass tablets dissolving into mist",
    signals: "quiet long-dwell intrusion against governments and think tanks",
    environment: "vaulted records room, soft beams of light through dust",
  },
  cozybear: {
    motif: "massive bear figure composed of data streams and ice crystals",
    signals: "espionage against diplomatic targets, credential harvesting",
    environment: "snowbound government facility interior at night",
  },
  fancybear: {
    motif: "figure in formal military dress with a bear head mask made of circuitry",
    signals: "military espionage, political interference",
    environment: "grand government hall with digital surveillance screens",
  },
}

/**
 * Tools → motif mapping for automatic derivation.
 */
function deriveMotifFromTools(tools: string[]): string {
  const toolMotifs: Record<string, string> = {
    cobaltstrike: "command-and-control beacon spider",
    mimikatz: "shattered glass ledger of credentials",
    powershell: "glowing blue command prompt tendrils",
    metasploit: "exploit payload launch visualization",
    ransomware: "encrypted lock overlay with countdown timer",
    cobalt: "cobalt-blue cybersecurity shield breach",
  }

  for (const tool of tools) {
    const lower = tool.toLowerCase()
    for (const [key, motif] of Object.entries(toolMotifs)) {
      if (lower.includes(key)) {
        return motif
      }
    }
  }

  return "abstract cyber threat visualization"
}

/**
 * Motivations → signals mapping.
 */
function deriveSignalsFromMotivation(motivations: string[]): string {
  const primary = motivations[0] ?? "espionage"

  const signalsMap: Record<string, string> = {
    espionage: "clandestine intelligence gathering and data exfiltration",
    financial: "illicit financial gain, fraud, or theft",
    sabotage: "destructive attacks and operational disruption",
    hacktivism: "ideologically motivated disruption and publicity",
    military: "state-sponsored military operations and warfare",
  }

  return signalsMap[primary] ?? signalsMap.espionage
}

/**
 * Country → environment mapping.
 * Uses concrete architectural/industrial cues rather than stereotypes.
 */
function deriveEnvironmentFromCountry(
  country: string | undefined,
  sophistication: string
): string {
  const countryEnv: Record<string, string> = {
    russia: "brutalist government building interior, heavy concrete",
    china: "glass-and-steel high-rise data center at night",
    iran: "desert oilfield control room with industrial equipment",
    "north korea": "underground bunker with military communications gear",
    "united states": "modern open-plan tech office with floor-to-ceiling windows",
    "united kingdom": "victorian-era government building with modern server racks",
    israel: "circular security operations center with monitor walls",
    vietnam: "tropical data center with humidity control systems",
    india: "modern tech hub building with vibrant exterior lighting",
  }

  if (country && countryEnv[country.toLowerCase()]) {
    return countryEnv[country.toLowerCase()]
  }

  // Fallback based on sophistication
  if (sophistication === "Nation-State Elite" || sophistication === "Very High") {
    return "high-tech underground operations center"
  }
  if (sophistication === "High") {
    return "dimly lit server room with rack-mounted equipment"
  }
  return "makeshift workspace with scattered computer equipment"
}

/**
 * Build the complete prompt profile for an actor.
 */
export function buildPromptProfile(
  actor: Record<string, unknown>
): PromptProfile {
  const id = String(actor.id ?? "").toLowerCase()
  const override = ACTOR_OVERRIDES[id]

  const rarity = (actor.rarity as string) ?? "RARE"
  const sophistication = (actor.sophistication as string) ?? "Medium"
  const country = actor.country as string | undefined
  const motivations = (actor.motivation as string[]) ?? []
  const tools = (actor.tools as string[]) ?? []

  // Use override if available, otherwise derive
  const motif = override?.motif ?? deriveMotifFromTools(tools)
  const signals = override?.signals ?? deriveSignalsFromMotivation(motivations)
  const environment = override?.environment ?? deriveEnvironmentFromCountry(country, sophistication)
  const paletteAccent = RARITY_ACCENT[rarity] ?? RARITY_ACCENT.RARE

  return { motif, signals, environment, paletteAccent }
}

/**
 * Build the final image prompt from a profile.
 */
export function buildImagePrompt(actor: Record<string, unknown>): string {
  const p = buildPromptProfile(actor)

  return [
    "Cinematic threat-intelligence dossier illustration.",
    "No text, no words, no logos, no UI, no watermark, no card frame.",
    `Subject: ${p.motif}.`,
    `Signals: ${p.signals}.`,
    `Environment: ${p.environment}.`,
    "Composition: centered subject, strong silhouette, designed to fit a 280x140 card crop.",
    `Palette: dark navy base (#00123F) with ${p.paletteAccent} highlights.`,
    "Style: realistic materials, sharp lighting, polished editorial cyber-illustration.",
    "Avoid: hooded hacker cliché, code rain, flags, stereotypes, any letters or numbers.",
  ].join(" ")
}
