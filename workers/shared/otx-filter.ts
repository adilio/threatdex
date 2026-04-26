/**
 * OTX actor-name filtering.
 *
 * OTX pulses are often article-shaped even when tagged with "apt" or
 * "threat-actor". Keep ingestion to names that look like actor aliases, not
 * report headlines.
 */

const ACTOR_CODE_RE =
  /^(?:apt(?:-?c)?[\s-]?\d+|ta[\s-]?\d+|fin[\s-]?\d+|unc[\s-]?\d+|uat[\s-]?\d+|storm[\s-]?\d+|g\d{4,}|grp[\s-]?\d+|lac[\s-]?\d+)$/i

const PROPER_ACTOR_RE =
  /^(?:[A-Z][A-Za-z0-9@]*(?:[-'][A-Za-z0-9@]+)?)(?:\s+(?:[A-Z][A-Za-z0-9@]*(?:[-'][A-Za-z0-9@]+)?)){0,3}$/

const CAMEL_ALIAS_RE = /^[A-Z][a-z]+(?:[A-Z][a-z0-9]+){1,3}$/

const SENTENCE_WORDS =
  /\b(a|an|and|as|by|for|from|in|inside|into|of|on|to|using|via|with|against|after|before|over|under|the|analysis|advisory|attack|attacks|backdoor|campaign|campaigns|chronology|delivers|deployed|detected|discovered|expands|exploitation|fake|implant|implants|infects|latest|leverages|malware|new|operation|phishing|reveals|targeted|targeting|targets|techniques|uncovers|unmasking|updated|uses)\b/i

const GENERIC_TAGS = new Set([
  "apt",
  "threat-actor",
  "threat actor",
  "intrusion-set",
  "intrusion set",
  "nation-state",
  "nation state",
  "malware",
  "phishing",
  "campaign",
])

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function isGenericOtxTag(tag: string): boolean {
  return GENERIC_TAGS.has(tag.trim().toLowerCase())
}

/**
 * Check if a string is plausible as a threat actor alias.
 */
export function looksLikeActorName(name: string): boolean {
  const trimmed = normalizeSpaces(name)
  if (trimmed.length < 2 || trimmed.length > 50) return false
  if (/[|:!?"]/.test(trimmed)) return false

  const wordCount = trimmed.split(/\s+/).length
  if (wordCount > 4) return false

  if (ACTOR_CODE_RE.test(trimmed)) return true
  if (CAMEL_ALIAS_RE.test(trimmed) && !SENTENCE_WORDS.test(trimmed)) return true

  if (SENTENCE_WORDS.test(trimmed)) return false
  return PROPER_ACTOR_RE.test(trimmed)
}

/**
 * Clean titles that are already actor names, without trying to infer a name
 * from a headline. Tags are the reliable place for aliases.
 */
export function cleanPulseName(name: string): string {
  return normalizeSpaces(
    name
      .replace(/\s*[-\u2013\u2014:]\s*(campaign|operation|activity|ioc|indicator).*$/i, "")
      .replace(/^(threat\s+actor|apt\s+group|group|actor)\s*:\s*/i, "")
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OtxNamePulse = Record<string, any>

/**
 * Extract a candidate actor name from OTX pulse metadata.
 *
 * Tags are checked first so real group enrichment is preserved. Title fallback
 * only accepts titles that are already clean actor aliases.
 */
export function extractActorCandidate(pulse: OtxNamePulse): string | null {
  const tags: string[] = ((pulse["tags"] ?? []) as string[])
    .map((tag) => normalizeSpaces(String(tag)))
    .filter(Boolean)

  for (const tag of tags) {
    if (!isGenericOtxTag(tag) && looksLikeActorName(tag)) return tag
  }

  const title = cleanPulseName(String(pulse["name"] ?? ""))
  return looksLikeActorName(title) ? title : null
}

/**
 * Conservative DB cleanup predicate for rows already polluted by old OTX syncs.
 */
export function isLikelyPollutedOtxActorName(name: string): boolean {
  return !looksLikeActorName(name)
}
