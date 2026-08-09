import { describe, expect, it } from "vitest";
import { classifyHandFacing, getHandPosition, mirrorCardinalAngle, snapHandAngle } from "../src/core/hand-position.ts";
import type { Landmark } from "../src/core/types.ts";

function hand(middleBase: Landmark, indexBase: Landmark = { x: 0.62, y: 0.35 }, pinkyBase: Landmark = { x: 0.38, y: 0.35 }): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  landmarks[0] = { x: 0.5, y: 0.7, z: 0 };
  landmarks[5] = indexBase;
  landmarks[9] = middleBase;
  landmarks[17] = pinkyBase;
  return landmarks;
}

describe("cardinal hand direction", () => {
  it.each([
    [{ x: 0.5, y: 0.3 }, 0],
    [{ x: 0.25, y: 0.7 }, -90],
    [{ x: 0.75, y: 0.7 }, 90],
    [{ x: 0.5, y: 0.9 }, 180]
  ] as const)("snaps the wrist axis to %i degrees", (middleBase, expected) => {
    expect(snapHandAngle(hand(middleBase))).toBe(expected);
  });

  it("snaps intermediate directions to the nearest requested angle", () => {
    expect(snapHandAngle(hand({ x: 0.6, y: 0.35 }))).toBe(0);
    expect(snapHandAngle(hand({ x: 0.7, y: 0.55 }))).toBe(90);
  });

  it("flips horizontal angles for the mirrored webcam display", () => {
    expect(mirrorCardinalAngle(-90)).toBe(90);
    expect(mirrorCardinalAngle(90)).toBe(-90);
    expect(mirrorCardinalAngle(0)).toBe(0);
    expect(mirrorCardinalAngle(180)).toBe(180);
  });
});

describe("front and back classification", () => {
  it("uses handedness and palm winding together", () => {
    const rightPalm = hand({ x: 0.5, y: 0.3 });
    const leftPalm = hand({ x: 0.5, y: 0.3 }, { x: 0.38, y: 0.35 }, { x: 0.62, y: 0.35 });
    expect(classifyHandFacing(rightPalm, "Right")).toBe("front");
    expect(classifyHandFacing(rightPalm, "Left")).toBe("back");
    expect(classifyHandFacing(leftPalm, "Left")).toBe("front");
  });

  it("does not guess when the palm is edge-on or handedness is missing", () => {
    const edgeOn = hand({ x: 0.5, y: 0.3 }, { x: 0.48, y: 0.35 }, { x: 0.49, y: 0.525 });
    expect(classifyHandFacing(edgeOn, "Right")).toBe("unknown");
    expect(classifyHandFacing(hand({ x: 0.5, y: 0.3 }))).toBe("unknown");
  });

  it("returns one complete reading", () => {
    expect(getHandPosition(hand({ x: 0.5, y: 0.3 }), "Right")).toEqual({
      angle: 0,
      facing: "front",
      handedness: "right"
    });
  });
});
