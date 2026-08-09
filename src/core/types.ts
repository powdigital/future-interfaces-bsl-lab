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

export interface HandOrientationMetrics {
  roll: number;
  signedAngle?: number;
  cardinalAngle?: -90 | 0 | 90 | 180;
  confidence?: number;
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
  separation?: number;
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
  trainingProtocol: {
    correct: TrainingPrompt[];
    incorrect: TrainingPrompt[];
  };
  motion?: {
    cycleCount: 1;
    detector: "pinch-cycle" | "horizontal-cycle" | "vertical-cycle" | "two-hand-horizontal-cycle";
    status: "active" | "training-required";
    durationMs: { min: number; max: number };
  };
}

export interface TrainingPrompt {
  id: string;
  title: string;
  instruction: string;
}

export interface TrainingExample {
  id?: number;
  signId: string;
  kind: "positive" | "negative";
  recordedAt: string;
  frames: HandMetrics[];
  landmarkFrames?: Landmark[][];
  evidenceFormat?: "hand-landmarks-and-metrics-v1";
  containsVideo?: false;
  containsAudio?: false;
  researcherId?: string;
  sessionId?: string;
  appVersion?: string;
  handedness?: "left" | "right" | "unknown";
  protocolStepId?: string;
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
  schemaVersion: 2 | 3;
  updatedAt: string;
  evidence: {
    positiveClips: number;
    negativeClips: number;
    positiveFrames: number;
    negativeFrames: number;
    maturity: "provisional" | "established";
  };
  learnedStatePattern?: DigitState[];
  stateConfidence?: number[];
  rules: SignRule[];
}

export interface RecognitionCandidate {
  sign: SignDefinition;
  score: number;
}
