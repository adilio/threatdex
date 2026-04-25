/**
 * Image prompt builder for ThreatDex actor cards.
 *
 * Blends the earlier creature/card identity prompts with the newer dossier
 * composition rules. Actor names and aliases drive distinctive visual subjects,
 * while origin country colors are folded into armor/material accents.
 */

type PromptProfile = {
  subject: string
  energy: string
  environment: string
  rarityAura: string
  countryAccent: string
}

const VISUAL_CONCEPTS: Record<string, string> = {
  bear: "a massive cybernetic bear with glowing circuit-board fur",
  wolf: "a sleek cybernetic wolf with neon-lit eyes",
  fox: "a cunning cybernetic fox wreathed in digital fire",
  snake: "a coiling cybernetic snake made of fiber optic cables",
  viper: "a venomous cybernetic viper dripping neon toxin",
  cobra: "a hooded cybernetic cobra with a luminous crest",
  panda: "a cybernetic giant panda with glowing armor markings",
  tiger: "a cybernetic tiger crackling with electric energy",
  dragon: "a vast cybernetic dragon with wings made of satellite arrays",
  dragonfly: "a giant cybernetic dragonfly with iridescent data wings",
  cat: "a sleek cybernetic cat with holographic eyes",
  kitten: "a small but menacing cybernetic feline with oversized neon claws",
  ant: "a giant cybernetic ant with circuit-board mandibles",
  moth: "a cybernetic moth with luminous wing patterns made of data",
  worm: "a massive segmented worm made of interlocking circuit boards",
  spider: "a multi-eyed cybernetic spider spinning webs of data",
  hawk: "a razor-winged cybernetic hawk diving through digital clouds",
  eagle: "a cybernetic eagle with wings made of satellite dishes",
  falcon: "a cybernetic falcon with laser-sight eyes",
  rhino: "an armored cybernetic rhinoceros with a glowing horn",
  typhoon: "a swirling typhoon entity made of data and lightning",
  storm: "a living storm entity crackling with digital electricity",
  thunder: "a towering figure forged from digital thunder and lightning",
  volt: "a creature crackling with electric neon energy",
  lightning: "a figure made of pure digital lightning",
  hurricane: "a roaring hurricane entity made of swirling code and debris",
  tornado: "a tornado entity of spinning code and fractured data",
  fire: "a flaming digital entity wreathed in neon fire",
  frost: "an ice-covered digital entity radiating cold blue light",
  shadow: "a faceless shadow entity made of pure darkness and corrupted data",
  ghost: "a translucent ghost entity flickering with corrupted data",
  phantom: "a phantom entity phasing through layers of encrypted glass",
  sandworm: "a colossal desert worm surfacing through a sea of circuit boards",
  lazarus: "a skeletal figure rising from digital ashes, wrapped in resurrection code",
  sphinx: "a cybernetic sphinx guarding encrypted secrets",
  titan: "a colossal titan made of stacked server racks",
  golem: "a stone golem carved from circuit boards and server metal",
  scorpion: "a cybernetic scorpion with a glowing stinger tail",
  hydra: "a multi-headed cybernetic hydra, each head a different attack vector",
  leviathan: "a sea-serpent leviathan made of submerged cables and dark water",
  mustang: "a wild cybernetic horse with a mane of electric sparks",
  kimsuky: "a spectral entity wearing a traditional mask with glowing eyes",
  turla: "a cybernetic snake coiled around a globe of data",
  gallium: "a liquid metal entity flowing like molten circuitry",
}

const ACTOR_OVERRIDES: Record<string, Partial<PromptProfile>> = {
  sandworm: {
    subject: "a colossal armored sandworm breaking through a frozen electrical substation floor, body made of black circuit plates",
    energy: "destructive red fault energy and cold military-blue sparks",
    environment: "industrial control room with cracked gauges, transformer coils, and ice on steel",
  },
  apt28: {
    subject: "a razor-winged cybernetic bear-eagle hybrid perched on a satellite uplink array",
    energy: "military intelligence energy, spear-phishing lures, and credential shards orbiting it",
    environment: "open-plan signals intelligence floor with map walls and midnight blue light",
  },
  apt29: {
    subject: "a mist-wrapped cybernetic bear made of frosted glass and diplomatic archive tablets",
    energy: "quiet long-dwell espionage, pale blue exfiltration threads, and soft violet haze",
    environment: "vaulted records room with dust beams and sealed evidence cases",
  },
  lazarus: {
    subject: "a skeletal cybernetic figure rising from digital ashes beside a cracked vault door",
    energy: "gold financial-theft particles mixed with cold espionage light",
    environment: "neon-lit underground server room with reflected monitor glow",
  },
  "lazarus-group": {
    subject: "a skeletal cybernetic figure rising from digital ashes beside a cracked vault door",
    energy: "gold financial-theft particles mixed with cold espionage light",
    environment: "neon-lit underground server room with reflected monitor glow",
  },
  "volt-typhoon": {
    subject: "a storm giant made of power-grid cables and blue lightning, half-hidden behind cloud walls",
    energy: "quiet pre-positioning against critical infrastructure and electrical disruption",
    environment: "coastal utility control center under heavy rain and emergency lights",
  },
}

const RARITY_AURA: Record<string, string> = {
  MYTHIC: "god-like chromatic shimmer with electric yellow highlights",
  LEGENDARY: "gold metallic aura with hot magenta edge light",
  EPIC: "violet holographic field with deep indigo rim light",
  RARE: "cool blue shimmer with crisp electric cyan edge light",
}

const MOTIVATION_ENERGY: Record<string, string> = {
  espionage: "radiating cold calculating blue intelligence light",
  financial: "surrounded by floating gold data-coins and fractured ledgers",
  sabotage: "destructive red energy crackling around damaged machinery",
  hacktivism: "chaotic multicolor signal bursts and torn broadcast static",
  military: "sharp militaristic green targeting beams and disciplined formation lines",
}

const COUNTRY_ENVIRONMENT: Record<string, string> = {
  russia: "brutalist government operations room with heavy concrete and winter light",
  china: "glass-and-steel high-rise data center at night",
  iran: "desert oilfield control room with industrial equipment",
  "north korea": "underground bunker with military communications gear",
  "united states": "modern open-plan technology command center",
  "united kingdom": "Victorian-era government building retrofitted with server racks",
  israel: "circular security operations center with monitor walls",
  vietnam: "humid tropical data center with condensation on glass",
  india: "modern technology hub with saturated night lighting",
}

function extractVisualConcept(name: string, aliases: string[]): string {
  const allNames = [name, ...aliases].join(" ").toLowerCase()
  const words = allNames.split(/[\s\-_]+/)

  for (const word of words) {
    if (VISUAL_CONCEPTS[word]) return VISUAL_CONCEPTS[word]
  }

  for (const [key, concept] of Object.entries(VISUAL_CONCEPTS)) {
    if (allNames.includes(key)) return concept
  }

  return `a menacing cyber entity inspired by the threat actor ${name}`
}

function countryAccent(country: string | undefined): string {
  if (!country || country === "Unknown") return "no national symbols, only abstract cyber materials"
  return `${country} national flag colors subtly integrated into armor plating, rim light, and energy trails; no actual flag, no emblem, no text`
}

function deriveEnvironment(country: string | undefined, sophistication: string): string {
  const mapped = country ? COUNTRY_ENVIRONMENT[country.toLowerCase()] : undefined
  if (mapped) return mapped
  if (sophistication === "Nation-State Elite" || sophistication === "Very High") {
    return "high-tech underground operations center"
  }
  if (sophistication === "High") return "dimly lit server room with rack-mounted equipment"
  return "makeshift cyber operations workspace with scattered hardware"
}

export function buildPromptProfile(actor: Record<string, unknown>): PromptProfile {
  const id = String(actor.id ?? "").toLowerCase()
  const name = String(actor.canonical_name ?? actor.id ?? "Unknown Actor")
  const aliases = (actor.aliases as string[] | undefined) ?? []
  const country = actor.country as string | undefined
  const rarity = (actor.rarity as string | undefined) ?? "RARE"
  const motivations = (actor.motivation as string[] | undefined) ?? ["espionage"]
  const sophistication = (actor.sophistication as string | undefined) ?? "Medium"
  const override = ACTOR_OVERRIDES[id]

  return {
    subject: override?.subject ?? extractVisualConcept(name, aliases),
    energy: override?.energy ?? MOTIVATION_ENERGY[motivations[0]] ?? MOTIVATION_ENERGY.espionage,
    environment: override?.environment ?? deriveEnvironment(country, sophistication),
    rarityAura: override?.rarityAura ?? RARITY_AURA[rarity] ?? RARITY_AURA.RARE,
    countryAccent: override?.countryAccent ?? countryAccent(country),
  }
}

export function buildImagePrompt(actor: Record<string, unknown>): string {
  const p = buildPromptProfile(actor)

  return [
    "Cinematic Pokédex-style cyber threat creature illustration for a trading-card hero image.",
    "No text, no words, no logos, no UI, no watermark, no card frame.",
    `Subject: ${p.subject}.`,
    `Energy and intent: ${p.energy}.`,
    `Origin treatment: ${p.countryAccent}.`,
    `Environment: ${p.environment}.`,
    `Rarity treatment: ${p.rarityAura}.`,
    "Composition: clean full-body or strong bust silhouette, centered, readable at small size, designed for a 280x140 card crop.",
    "Palette: dark navy base (#00123F), glowing circuit-board patterns, high-contrast neon accents.",
    "Style: ultra-detailed digital art, realistic materials, dramatic lighting, polished cyberpunk editorial finish.",
    "Avoid: hooded hacker cliché, code rain, literal flags, seals, stereotypes, letters, numbers, readable text.",
  ].join(" ")
}
