import type { DigitState, SignDefinition, SignRule, TrainingPrompt } from "./types.ts";

export const SIGN_BANK_VERSION = 2;

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
  ],
  6: [
    { id: "number-5", title: "Neighboring number 5", instruction: "Sign number 5 clearly. It must not count as 6." },
    { id: "number-7", title: "Neighboring number 7", instruction: "Sign number 7 clearly. It must not count as 6." },
    { id: "bent-thumb", title: "Bent thumb", instruction: "Keep the fingers folded but leave the thumb only partly extended." }
  ],
  7: [
    { id: "number-6", title: "Neighboring number 6", instruction: "Sign number 6 clearly. It must not count as 7." },
    { id: "number-8", title: "Neighboring number 8", instruction: "Sign number 8 clearly. It must not count as 7." },
    { id: "bent-index", title: "Bent index", instruction: "Extend the thumb but leave the index finger partly bent." }
  ],
  8: [
    { id: "number-7", title: "Neighboring number 7", instruction: "Sign number 7 clearly. It must not count as 8." },
    { id: "number-9", title: "Neighboring number 9", instruction: "Sign number 9 clearly. It must not count as 8." },
    { id: "bent-middle", title: "Bent middle finger", instruction: "Extend the thumb and index but leave the middle finger partly bent." }
  ],
  9: [
    { id: "number-8", title: "Neighboring number 8", instruction: "Sign number 8 clearly. It must not count as 9." },
    { id: "number-10", title: "Neighboring number 10", instruction: "Sign number 10 clearly. It must not count as 9." },
    { id: "bent-ring", title: "Bent ring finger", instruction: "Extend the thumb, index, and middle fingers but leave the ring finger partly bent." }
  ],
  10: [
    { id: "number-9", title: "Neighboring number 9", instruction: "Sign number 9 clearly. It must not count as 10." },
    { id: "number-5", title: "One open hand", instruction: "Show one open hand only. It must not count as 10." },
    { id: "uneven-pair", title: "Uneven open pair", instruction: "Show two hands, but keep one hand partly folded." }
  ]
};

function number(value: number, statePattern: DigitState[], baseRules: SignRule[] = [], hands: 1 | 2 = 1): SignDefinition {
  return {
    id: `bsl-number-${value}`,
    label: `Number ${value}`,
    shortLabel: String(value),
    category: "number",
    recognitionType: "static",
    hands,
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
  number(5, ["extended", "extended", "extended", "extended", "extended"]),
  number(6, ["extended", "folded", "folded", "folded", "folded"]),
  number(7, ["extended", "extended", "folded", "folded", "folded"]),
  number(8, ["extended", "extended", "extended", "folded", "folded"]),
  number(9, ["extended", "extended", "extended", "extended", "folded"]),
  number(10, ["extended", "extended", "extended", "extended", "extended"], [], 2)
];

export function getSign(signId: string): SignDefinition | null {
  return SIGN_BANK.find((sign) => sign.id === signId) || null;
}
