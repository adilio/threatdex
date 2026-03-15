// Re-export all types and schemas from the shared schema package
export type {
  ThreatActor,
  TTPUsage,
  Campaign,
  SourceAttribution,
  Motivation,
  Sophistication,
  Rarity,
  TLP,
  SourceName,
  PaginatedResponse,
} from "@threatdex/schema";

export {
  ThreatActorSchema,
  TTPUsageSchema,
  CampaignSchema,
  SourceAttributionSchema,
  MotivationSchema,
  SophisticationSchema,
  RaritySchema,
  TLPSchema,
  SourceNameSchema,
  PaginatedResponseSchema,
  BRAND_COLORS,
  getRarityColor,
  getRarityGlowClass,
  getThreatLevelLabel,
  getSophisticationScore,
} from "@threatdex/schema";
