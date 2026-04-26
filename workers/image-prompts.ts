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
  composition: string
  palette: string
  signature: string
}

const VISUAL_CONCEPTS: Record<string, string> = {
  bear: "a massive cybernetic bear with glowing circuit-board fur",
  wolf: "a sleek cybernetic wolf with neon-lit eyes",
  hound: "a lean cybernetic hound tracking glowing packet trails across the floor",
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

const FALLBACK_SUBJECTS = [
  "a faceless glass humanoid assembled from intrusion graphs and fractured endpoint telemetry",
  "a floating command artifact made of black ceramic plates, fiber optics, and encrypted shards",
  "a masked signal operator silhouette holding a prism of stolen credentials",
  "a hovering malware reliquary with rotating sensor arrays and glowing containment rings",
  "a cybernetic sentinel built from server blades, cracked tablets, and cable tendons",
  "a spectral reconnaissance drone with layered translucent armor and watchful optics",
  "a dark crystalline intelligence core unfolding into angular limbs",
  "a compact intrusion automaton with tool modules orbiting its shoulders",
] as const

const COMPOSITIONS = [
  "tight bust portrait, three-quarter turn, strong silhouette, no full-body pose",
  "low-angle full-body figure, one foreground artifact, large negative space behind",
  "environment-first scene with the subject emerging from a console reflection",
  "centered artifact totem with smaller threat silhouette behind it",
  "asymmetric diagonal composition, subject entering from the left, bright rim light on the right",
  "top-down command-table composition with the entity rising from mapped network paths",
] as const

const PALETTES = [
  "petrol blue, signal cyan, bone white, and small warning-red accents",
  "charcoal black, oxidized copper, pale green terminal glow, and amber highlights",
  "deep indigo, cold silver, ultraviolet haze, and sharp cyan edge lights",
  "graphite gray, desaturated teal, hot magenta sparks, and cream monitor glow",
  "midnight navy, tarnished gold, smoke violet, and precise ice-blue scan lines",
  "black glass, muted crimson, dusty orange, and sterile white diagnostic light",
] as const

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
  teampcp: {
    subject: "a cloud supply-chain phantom shaped from container cubes, CI/CD pipeline rails, package-lock fragments, and stolen API keys",
    energy: "gold theft particles colliding with red sabotage sparks around broken build runners",
    environment: "cloud control plane war room with Kubernetes nodes, registry vaults, and exposed service dashboards",
    composition: "wide hero silhouette stepping out of a fractured software pipeline, strong diagonal motion",
    palette: "black glass, cloud white, hot magenta, container blue, and small hazard-yellow secret tokens",
    signature: "visible container blocks, package cubes, and build-runner rails; no feline features",
  },
  oilrig: {
    subject: "a rusted industrial drilling rig transformed into a cybernetic espionage tower, with antenna masts and oil-slick cables",
    energy: "quiet blue surveillance beams mixed with petroleum-black data streams",
    environment: "desert refinery control room overlooking pumpjacks and pipeline telemetry screens",
    composition: "towering vertical machine silhouette, viewed from below, no animal anatomy",
    palette: "sandstone, crude-oil black, oxidized steel, teal monitor glow, and restrained Iranian color accents",
    signature: "drill head, pipeline valves, refinery gauges, and black oil-slick cabling",
  },
  "magic-hound": {
    subject: "a mythic tracking hound made of Persian mosaic glass, phishing lures, and glowing proxy tunnels",
    energy: "cold espionage light around decoy news pages, credential hooks, and tunnel endpoints",
    environment: "moonlit archive courtyard merging into a covert proxy server room",
    composition: "fast side-profile pursuit pose with packet trails sweeping behind",
    palette: "lapis blue, desert gold, black velvet, turquoise glass, and faint crimson warning lights",
    signature: "hound silhouette, mosaic tile armor, and lure documents caught in motion",
  },
  patchwork: {
    subject: "a stitched intelligence cloak assembled from mismatched document fragments, AutoIt scripts, and remote-access modules",
    energy: "subtle blue espionage threads sewing stolen files into a moving patchwork pattern",
    environment: "crowded analyst desk with decoy PDFs, regional maps, and tangled laptop cables",
    composition: "fabric-like figure unfurling across the frame, no insect anatomy",
    palette: "saffron, deep teal, paper white, charcoal, and cool electric-blue thread",
    signature: "stitched panels, decoy documents, and patch seams glowing like circuits",
  },
  taidoor: {
    subject: "a sealed black courier capsule unfolding into a minimalist remote-access implant",
    energy: "thin blue command channels pulsing from a hidden persistence core",
    environment: "bare operations bench with an isolated workstation and forensic evidence trays",
    composition: "artifact-first close-up, capsule centered, small humanoid shadow reflected in metal",
    palette: "matte black, medical white, cool cyan, muted steel, and tiny red status LEDs",
    signature: "compact implant capsule, evidence labels without readable text, and surgical lighting",
  },
  neodymium: {
    subject: "a rare-earth magnetic specter pulling browser windows, exploit fragments, and memory shards into orbit",
    energy: "pale violet espionage magnetism bending network lines into a tight spiral",
    environment: "dark research lab with magnet coils, proxy servers, and suspended glass panels",
    composition: "circular magnetic vortex composition with the entity at the center",
    palette: "gunmetal, violet, electric blue, pale nickel, and small Turkish red glints",
    signature: "magnet rings, metallic dust, and browser exploit shards in orbit",
  },
  moafee: {
    subject: "a quiet poison-ivy vine system crawling through glass server racks, each leaf a tiny surveillance sensor",
    energy: "low-intensity blue espionage glow hidden under green botanical circuitry",
    environment: "high-rise data center greenhouse at night with cable trellises and fogged glass",
    composition: "macro close-up of vines overtaking hardware, entity face barely visible in reflections",
    palette: "jade green, smoky black, cold cyan, glass gray, and restrained Chinese red accents",
    signature: "poison ivy leaves, rack cables as vines, and hidden sensor eyes",
  },
  apt16: {
    subject: "a numbered porcelain chess sentinel guarding a stack of media dossiers and beacon implants",
    energy: "precise blue espionage beams arranged like a strategic board position",
    environment: "glass media archive with floating broadcast panels and locked file cabinets",
    composition: "chess-piece silhouette in the foreground, dossier stacks receding into depth",
    palette: "porcelain white, ink black, neon cyan, lacquer red, and cool newsroom gray",
    signature: "chessboard geometry, dossier folders, and broadcast-panel reflections",
  },
  "scarlet-mimic": {
    subject: "a red mirror-mask impersonator wearing layered mobile-device screens and copied access badges",
    energy: "scarlet deception waves mixed with cold blue surveillance pinpoints",
    environment: "dark mobile forensics lab filled with suspended phone screens and mirrored glass",
    composition: "mask close-up split by reflections, many small device screens around it",
    palette: "scarlet red, obsidian, cold cyan, silver mirror, and desaturated jade",
    signature: "mirror mask, duplicated silhouettes, mobile screens, and fake badge shapes",
  },
  applejeus: {
    subject: "a counterfeit trading terminal blooming into a polished malware idol with cryptocurrency ledgers behind it",
    energy: "cold North Korean espionage light mixed with gold financial-theft particles",
    environment: "underground bunker trading desk with market graphs, build artifacts, and sealed vault doors",
    composition: "terminal-as-totem in front, spectral operator silhouette behind glass",
    palette: "deep bunker green, black, icy blue, tarnished gold, and restrained red-white-blue origin accents",
    signature: "trading terminal, crypto ledger fragments, supply-chain build artifacts, and vault door",
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

  return FALLBACK_SUBJECTS[stableIndex(name, FALLBACK_SUBJECTS.length)]
}

function stableIndex(seed: string, modulo: number): number {
  let hash = 0
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash % modulo
}

function countryAccent(country: string | undefined): string {
  if (!country || country === "Unknown") return "no national symbols, only abstract cyber materials"
  return `${country} origin palette inspired by its national flag colors, used clearly as abstract light bands, armor accents, rim glow, and environmental reflections; no literal flag, no emblem, no text`
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
  const seed = `${id}:${name}`

  return {
    subject: override?.subject ?? extractVisualConcept(name, aliases),
    energy: override?.energy ?? MOTIVATION_ENERGY[motivations[0]] ?? MOTIVATION_ENERGY.espionage,
    environment: override?.environment ?? deriveEnvironment(country, sophistication),
    rarityAura: override?.rarityAura ?? RARITY_AURA[rarity] ?? RARITY_AURA.RARE,
    countryAccent: override?.countryAccent ?? countryAccent(country),
    composition: override?.composition ?? COMPOSITIONS[stableIndex(seed, COMPOSITIONS.length)],
    palette: override?.palette ?? PALETTES[stableIndex(`${seed}:palette`, PALETTES.length)],
    signature:
      override?.signature ??
      `distinct visual signature derived from the name ${name}; avoid reusing generic cyber creature silhouettes`,
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
    `Visual signature: ${p.signature}.`,
    `Rarity treatment: ${p.rarityAura}.`,
    `Composition: ${p.composition}; readable at small size, designed for a 280x140 card crop.`,
    `Palette: ${p.palette}; avoid default blue-purple cyberpunk sameness.`,
    "Style: ultra-detailed digital art, realistic materials, dramatic lighting, polished editorial finish.",
    "Avoid: hooded hacker cliché, code rain, literal flags, seals, stereotypes, letters, numbers, readable text.",
  ].join(" ")
}
