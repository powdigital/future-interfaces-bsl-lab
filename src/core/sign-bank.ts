import type { DigitState, SignDefinition, SignRule, TrainingPrompt } from "./types.ts";

export const SIGN_BANK_VERSION = 1;

const correctPrompts: TrainingPrompt[] = [
  { id: "natural", title: "Natural position", instruction: "Make the sign naturally with your right hand facing the camera." },
  { id: "near", title: "Slightly closer", instruction: "Make the same sign a little closer to the camera." },
  { id: "far", title: "Slightly farther", instruction: "Move a little farther back while keeping the sign clear." },
  { id: "left-angle", title: "Turn slightly left", instruction: "Rotate your wrist slightly left without changing the sign." },
  { id: "right-angle", title: "Turn slightly right", instruction: "Rotate your wrist slightly right without changing the sign." }
];

const incorrectPrompts: Record<number, TrainingPrompt[]> = {
  1: [
    { id: "grab", title: "Closed grab", instruction: "Make a closed grabbing or claw-like pose that must not count as 1." },
    { id: "thumb-out", title: "Thumb extended", instruction: "Extend the index finger and thumb together. This must not count as 1." },
    { id: "bent-index", title: "Bent index", instruction: "Keep the other fingers closed but bend the index halfway." }
  ],
  2: [
    { id: "number-1", title: "Neighboring number 1", instruction: "Sign number 1 clearly. It must not count as 2." },
    { id: "number-3", title: "Neighboring number 3", instruction: "Sign number 3 clearly. It must not count as 2." },
    { id: "bent-pair", title: "Bent finger pair", instruction: "Raise index and middle fingers but bend them halfway." }
  ],
  3: [
    { id: "number-2", title: "Neighboring number 2", instruction: "Sign number 2 clearly. It must not count as 3." },
    { id: "number-4", title: "Neighboring number 4", instruction: "Sign number 4 clearly. It must not count as 3." },
    { id: "thumb-out", title: "Three plus thumb", instruction: "Raise the first three fingers and extend the thumb." }
  ],
  4: [
    { id: "number-3", title: "Neighboring number 3", instruction: "Sign number 3 clearly. It must not count as 4." },
    { id: "number-5", title: "Neighboring number 5", instruction: "Open the thumb to sign number 5 clearly." },
    { id: "partial-pinky", title: "Partly folded pinky", instruction: "Raise four fingers but leave the pinky partly folded." }
  ],
  5: [
    { id: "number-4", title: "Neighboring number 4", instruction: "Fold the thumb across to sign number 4 clearly." },
    { id: "bent-thumb", title: "Partly open thumb", instruction: "Open all fingers but keep the thumb only halfway extended." },
    { id: "relaxed-open", title: "Relaxed open hand", instruction: "Show a relaxed, partly curled open hand rather than a clear 5." }
  ]
};

function number(value: number, statePattern: DigitState[], baseRules: SignRule[] = []): SignDefinition {
  return {
    id: `bsl-number-${value}`,
    label: `Number ${value}`,
    shortLabel: String(value),
    category: "number",
    recognitionType: "static",
    hands: 1,
    promptAsset: `/BSL_diagram_overlays/bsl${value}.png`,
    statePattern,
    baseRules,
    status: value === 1 ? "evidence-seeded" : "provisional",
    minimumScore: value === 1 ? 0.76 : 0.82,
    minimumMargin: 0.06,
    trainingProtocol: {
      correct: correctPrompts,
      incorrect: incorrectPrompts[value]
    }
  };
}

export const SIGN_BANK: SignDefinition[] = [
  number(1, ["folded", "extended", "folded", "folded", "folded"], [
    { feature: "index.angle1", min: 160, max: 180, weight: 2, foundation: true },
    { feature: "index.angle2", min: 160, max: 180, weight: 2, foundation: true },
    { feature: "index.straightness", min: 0.9, max: 1.02, weight: 2, foundation: true },
    { feature: "index.reach", min: 1.2, max: 1.45, weight: 3, foundation: true },
    { feature: "middle.angle1", min: 0, max: 85, weight: 4, foundation: true },
    { feature: "middle.straightness", min: 0, max: 0.55, weight: 3, foundation: true },
    { feature: "middle.reach", min: 0.45, max: 0.92, weight: 3, foundation: true },
    { feature: "ring.angle1", min: 0, max: 70, weight: 4, foundation: true },
    { feature: "ring.straightness", min: 0, max: 0.5, weight: 3, foundation: true },
    { feature: "ring.reach", min: 0.4, max: 0.82, weight: 3, foundation: true },
    { feature: "pinky.angle1", min: 0, max: 75, weight: 4, foundation: true },
    { feature: "pinky.straightness", min: 0, max: 0.55, weight: 3, foundation: true },
    { feature: "pinky.reach", min: 0.4, max: 0.84, weight: 3, foundation: true },
    { feature: "thumb.reach", min: -0.35, max: 0.35, weight: 1, foundation: false }
  ]),
  number(2, ["folded", "extended", "extended", "folded", "folded"]),
  number(3, ["folded", "extended", "extended", "extended", "folded"]),
  number(4, ["folded", "extended", "extended", "extended", "extended"]),
  number(5, ["extended", "extended", "extended", "extended", "extended"])
];

export function getSign(signId: string): SignDefinition | null {
  return SIGN_BANK.find((sign) => sign.id === signId) || null;
}
