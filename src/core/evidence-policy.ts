import type { TrainingExample } from "./types.ts";

export const EVIDENCE_POLICY = {
  format: "hand-landmarks-and-metrics-v1",
  storesLandmarks: true,
  storesDerivedMetrics: true,
  storesVideo: false,
  storesAudio: false,
  storesImages: false
} as const;

export function assertEvidencePolicy(example: TrainingExample, allowLegacy = false): void {
  if (!allowLegacy && example.evidenceFormat !== EVIDENCE_POLICY.format) {
    throw new Error("Training example does not declare the current evidence format");
  }
  if (example.containsVideo !== undefined && example.containsVideo !== false) {
    throw new Error("Raw video is prohibited by the personal-lab evidence policy");
  }
  if (example.containsAudio !== undefined && example.containsAudio !== false) {
    throw new Error("Raw audio is prohibited by the personal-lab evidence policy");
  }
  if (example.landmarkFrames && example.landmarkFrames.length !== example.frames.length) {
    throw new Error("Landmark and measurement frame counts must match");
  }
}
