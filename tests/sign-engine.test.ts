import { describe, expect, it } from "vitest";
import { SIGN_BANK } from "../src/core/sign-bank.ts";
import { buildLearnedProfile, recognizeHands, recognizeSign, scoreSign } from "../src/core/sign-engine.ts";
import type { HandMetrics, TrainingExample } from "../src/core/types.ts";
import { createDefaultResearcherProfile } from "../src/core/research-profile.ts";
import { assertEvidencePolicy, EVIDENCE_POLICY } from "../src/core/evidence-policy.ts";

const bslOne: HandMetrics = [
  { state: "ambiguous", angle1: 163, angle2: 173, straightness: 0.985, reach: 0.06 },
  { state: "extended", angle1: 176, angle2: 178, straightness: 1, reach: 1.32 },
  { state: "folded", angle1: 32, angle2: 163, straightness: 0.23, reach: 0.75 },
  { state: "folded", angle1: 27, angle2: 168, straightness: 0.21, reach: 0.68 },
  { state: "folded", angle1: 31, angle2: 168, straightness: 0.23, reach: 0.7 }
];

const confusingGrab: HandMetrics = [
  { state: "extended", angle1: 166, angle2: 174, straightness: 0.985, reach: 0.43 },
  { state: "extended", angle1: 169, angle2: 173, straightness: 0.995, reach: 1.23 },
  { state: "ambiguous", angle1: 152, angle2: 104, straightness: 0.81, reach: 1.08 },
  { state: "ambiguous", angle1: 121, angle2: 85, straightness: 0.58, reach: 0.96 },
  { state: "folded", angle1: 123, angle2: 88, straightness: 0.55, reach: 0.93 }
];

const thumbOutOne: HandMetrics = [
  { state: "extended", angle1: 168, angle2: 174, straightness: 0.98, reach: 0.48 },
  { state: "extended", angle1: 176, angle2: 178, straightness: 1, reach: 1.32 },
  { state: "folded", angle1: 32, angle2: 163, straightness: 0.23, reach: 0.75 },
  { state: "folded", angle1: 27, angle2: 168, straightness: 0.21, reach: 0.68 },
  { state: "folded", angle1: 31, angle2: 168, straightness: 0.23, reach: 0.7 }
];

const openHand: HandMetrics = [
  { state: "extended", angle1: 168, angle2: 174, straightness: 0.97, reach: 0.38 },
  { state: "extended", angle1: 176, angle2: 178, straightness: 0.99, reach: 1.32 },
  { state: "extended", angle1: 175, angle2: 177, straightness: 0.99, reach: 1.28 },
  { state: "extended", angle1: 174, angle2: 176, straightness: 0.98, reach: 1.23 },
  { state: "extended", angle1: 171, angle2: 174, straightness: 0.97, reach: 1.18 }
];

const bslNineFromCalibration: HandMetrics = [
  { state: "ambiguous", angle1: 159, angle2: 177, straightness: 0.99, reach: -0.56 },
  { state: "extended", angle1: 177, angle2: 178, straightness: 1, reach: 1.41 },
  { state: "extended", angle1: 176, angle2: 178, straightness: 1, reach: 1.45 },
  { state: "extended", angle1: 177, angle2: 179, straightness: 1, reach: 1.42 },
  { state: "extended", angle1: 176, angle2: 179, straightness: 1, reach: 1.35 }
];

const bslFourNeighbor: HandMetrics = [
  { state: "folded", angle1: 95, angle2: 118, straightness: 0.68, reach: 0.04 },
  { state: "extended", angle1: 174, angle2: 178, straightness: 0.99, reach: 1.36 },
  { state: "extended", angle1: 174, angle2: 178, straightness: 0.99, reach: 1.4 },
  { state: "extended", angle1: 173, angle2: 177, straightness: 0.98, reach: 1.35 },
  { state: "extended", angle1: 171, angle2: 176, straightness: 0.97, reach: 1.27 }
];

const foldedDigit = { state: "folded" as const, angle1: 70, angle2: 90, straightness: 0.5, reach: 0.75 };
const extendedDigit = { state: "extended" as const, angle1: 170, angle2: 175, straightness: 0.98, reach: 1.25 };
const ambiguousDigit = { state: "ambiguous" as const, angle1: 135, angle2: 140, straightness: 0.75, reach: 1 };

function metricsFor(states: HandMetrics[number]["state"][]): HandMetrics {
  return states.map((state) => ({
    ...(state === "extended" ? extendedDigit : state === "folded" ? foldedDigit : ambiguousDigit)
  })) as HandMetrics;
}

describe("seeded BSL number recognition", () => {
  it("recognises the recorded BSL 1 geometry", () => {
    const result = recognizeSign(SIGN_BANK, bslOne);
    expect(result.match?.sign.id).toBe("bsl-number-1");
    expect(result.match?.score).toBeGreaterThan(0.9);
  });

  it("rejects the confusing grab pose", () => {
    expect(recognizeSign(SIGN_BANK, confusingGrab).match).toBeNull();
  });

  it("recognises an open hand as number 5", () => {
    expect(recognizeSign(SIGN_BANK, openHand).match?.sign.id).toBe("bsl-number-5");
  });

  it.each([
    [6, ["extended", "folded", "folded", "folded", "folded"]],
    [7, ["extended", "extended", "folded", "folded", "folded"]],
    [8, ["extended", "extended", "extended", "folded", "folded"]]
  ] as const)("recognises the provisional state pattern for number %i", (number, states) => {
    expect(recognizeSign(SIGN_BANK, metricsFor([...states])).match?.sign.id).toBe(`bsl-number-${number}`);
  });

  it("recognises two open hands as number 10", () => {
    expect(recognizeHands(SIGN_BANK, [openHand, openHand]).match?.sign.id).toBe("bsl-number-10");
  });

  it("recognises the captured Number 9 geometry and separates it from Number 4", () => {
    expect(recognizeSign(SIGN_BANK, bslNineFromCalibration).match?.sign.id).toBe("bsl-number-9");
    expect(recognizeSign(SIGN_BANK, bslFourNeighbor).match?.sign.id).toBe("bsl-number-4");
  });
});

describe("guided number protocols", () => {
  it("provides five correct and three sign-specific incorrect steps for every number", () => {
    SIGN_BANK.forEach((sign) => {
      expect(sign.trainingProtocol.correct).toHaveLength(5);
      expect(sign.trainingProtocol.incorrect).toHaveLength(3);
      const ids = [...sign.trainingProtocol.correct, ...sign.trainingProtocol.incorrect].map((prompt) => prompt.id);
      expect(new Set(ids).size).toBe(8);
    });
  });
});

describe("learned profiles", () => {
  it("keeps learned evidence separate and promotes sufficient evidence", () => {
    const examples: TrainingExample[] = [
      ...Array.from({ length: 5 }, (_, index) => ({
        signId: "bsl-number-1",
        kind: "positive" as const,
        recordedAt: `2026-08-03T12:00:0${index}.000Z`,
        frames: [bslOne],
        evidenceFormat: "hand-landmarks-and-metrics-v1" as const,
        containsVideo: false as const,
        containsAudio: false as const
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        signId: "bsl-number-1",
        kind: "negative" as const,
        recordedAt: `2026-08-03T12:01:0${index}.000Z`,
        frames: [confusingGrab],
        evidenceFormat: "hand-landmarks-and-metrics-v1" as const,
        containsVideo: false as const,
        containsAudio: false as const
      }))
    ];
    const profile = buildLearnedProfile("bsl-number-1", examples);
    expect(profile?.evidence.maturity).toBe("established");
    expect(profile?.schemaVersion).toBe(3);
    expect(profile?.learnedStatePattern).toEqual(["ambiguous", "extended", "folded", "folded", "folded"]);
    expect(profile?.rules.length).toBeGreaterThan(0);
    expect(profile?.rules.every((rule) => rule.foundation === false)).toBe(true);
    expect(profile?.rules.some((rule) => rule.negativeMedian !== null)).toBe(true);
  });

  it("keeps a trained thumb-out pose from matching Number 1", () => {
    const examples: TrainingExample[] = [
      ...Array.from({ length: 5 }, (_, index) => ({
        signId: "bsl-number-1",
        kind: "positive" as const,
        recordedAt: `2026-08-03T13:00:0${index}.000Z`,
        frames: [bslOne],
        evidenceFormat: "hand-landmarks-and-metrics-v1" as const,
        containsVideo: false as const,
        containsAudio: false as const
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        signId: "bsl-number-1",
        kind: "negative" as const,
        recordedAt: `2026-08-03T13:01:0${index}.000Z`,
        frames: [thumbOutOne],
        evidenceFormat: "hand-landmarks-and-metrics-v1" as const,
        containsVideo: false as const,
        containsAudio: false as const
      }))
    ];
    const profile = buildLearnedProfile("bsl-number-1", examples);
    const profiles = new Map(profile ? [[profile.signId, profile]] : []);
    expect(recognizeSign(SIGN_BANK, bslOne, profiles).match?.sign.id).toBe("bsl-number-1");
    expect(recognizeSign(SIGN_BANK, thumbOutOne, profiles).match?.sign.id).toBe("bsl-number-7");
  });

  it("lets established training override an incorrect provisional pattern", () => {
    const examples: TrainingExample[] = [
      ...Array.from({ length: 5 }, (_, index) => ({
        signId: "bsl-number-9",
        kind: "positive" as const,
        recordedAt: `2026-08-04T12:00:0${index}.000Z`,
        frames: [bslNineFromCalibration],
        evidenceFormat: "hand-landmarks-and-metrics-v1" as const,
        containsVideo: false as const,
        containsAudio: false as const
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        signId: "bsl-number-9",
        kind: "negative" as const,
        recordedAt: `2026-08-04T12:01:0${index}.000Z`,
        frames: [bslFourNeighbor],
        evidenceFormat: "hand-landmarks-and-metrics-v1" as const,
        containsVideo: false as const,
        containsAudio: false as const
      }))
    ];
    const profile = buildLearnedProfile("bsl-number-9", examples);
    const seededNine = SIGN_BANK.find((sign) => sign.id === "bsl-number-9");

    expect(profile?.learnedStatePattern).toEqual(["ambiguous", "extended", "extended", "extended", "extended"]);
    expect(profile?.stateConfidence).toEqual([1, 1, 1, 1, 1]);
    expect(profile?.evidence.maturity).toBe("established");
    expect(seededNine && profile ? scoreSign({
      ...seededNine,
      statePattern: ["extended", "extended", "extended", "extended", "folded"],
      baseRules: []
    }, bslNineFromCalibration, profile) : 0).toBeGreaterThan(0.9);
  });
});

describe("evidence policy", () => {
  it("allows landmarks and metrics without media", () => {
    expect(EVIDENCE_POLICY.storesLandmarks).toBe(true);
    expect(EVIDENCE_POLICY.storesVideo).toBe(false);
    expect(() => assertEvidencePolicy({
      signId: "bsl-number-1",
      kind: "positive",
      recordedAt: "2026-08-03T12:00:00.000Z",
      frames: [bslOne],
      landmarkFrames: [Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))],
      evidenceFormat: "hand-landmarks-and-metrics-v1",
      containsVideo: false,
      containsAudio: false
    })).not.toThrow();
  });

  it("rejects mismatched landmark and measurement frames", () => {
    expect(() => assertEvidencePolicy({
      signId: "bsl-number-1",
      kind: "positive",
      recordedAt: "2026-08-03T12:00:00.000Z",
      frames: [bslOne],
      landmarkFrames: [],
      evidenceFormat: "hand-landmarks-and-metrics-v1",
      containsVideo: false,
      containsAudio: false
    })).toThrow(/frame counts/i);
  });
});

describe("personal research profile", () => {
  it("starts local, private, and uses the researcher's stated right hand", () => {
    const profile = createDefaultResearcherProfile(new Date("2026-08-03T12:00:00.000Z"));
    expect(profile.id).toBe("local-primary");
    expect(profile.scope).toBe("personal-local");
    expect(profile.dominantHand).toBe("right");
    expect(profile.signingHand).toBe("right");
  });
});
