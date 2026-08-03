export type DigitState = "extended" | "folded" | "ambiguous";

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export interface DigitMetrics {
  state: DigitState;
  angle1: number;
  angle2: number;
  straightness: number;
  reach: number;
}

export type HandMetrics = [DigitMetrics, DigitMetrics, DigitMetrics, DigitMetrics, DigitMetrics];

export interface SignRule {
  feature: string;
  min: number;
  max: number;
  weight: number;
  foundation: boolean;
  positiveMedian?: number;
  negativeMedian?: number | null;
  negativeMin?: number | null;
  negativeMax?: number | null;
}

export interface SignDefinition {
  id: string;
  label: string;
  shortLabel: string;
  category: "number" | "letter" | "word";
  recognitionType: "static" | "motion" | "two-hand-motion" | "body-context";
  hands: 1 | 2;
  promptAsset: string;
  statePattern: DigitState[];
  baseRules: SignRule[];
  status: "provisional" | "evidence-seeded" | "established";
  minimumScore: number;
  minimumMargin: number;
}

export interface TrainingExample {
  id?: number;
  signId: string;
  kind: "positive" | "negative";
  recordedAt: string;
  frames: HandMetrics[];
  researcherId?: string;
  sessionId?: string;
  appVersion?: string;
  handedness?: "left" | "right" | "unknown";
}

export interface ResearcherProfile {
  id: string;
  scope: "personal-local";
  displayName: string;
  dominantHand: "left" | "right" | "unknown";
  signingHand: "left" | "right" | "either" | "unknown";
  createdAt: string;
  updatedAt: string;
}

export interface LearnedProfile {
  signId: string;
  schemaVersion: 1;
  updatedAt: string;
  evidence: {
    positiveClips: number;
    negativeClips: number;
    positiveFrames: number;
    negativeFrames: number;
    maturity: "provisional" | "established";
  };
  rules: SignRule[];
}

export interface RecognitionCandidate {
  sign: SignDefinition;
  score: number;
}
