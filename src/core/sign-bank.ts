import type { DigitState, SignDefinition, SignRule } from "./types.ts";

export const SIGN_BANK_VERSION = 1;

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
    minimumMargin: 0.06
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
