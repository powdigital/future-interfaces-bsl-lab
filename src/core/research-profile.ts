import type { ResearcherProfile } from "./types.ts";

export const PRIMARY_RESEARCHER_ID = "local-primary";
export const APP_VERSION = "0.4.0";

export function createDefaultResearcherProfile(now = new Date()): ResearcherProfile {
  const timestamp = now.toISOString();
  return {
    id: PRIMARY_RESEARCHER_ID,
    scope: "personal-local",
    displayName: "Primary researcher",
    dominantHand: "right",
    signingHand: "right",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createSessionId(): string {
  return globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
