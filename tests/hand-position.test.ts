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

function orientedHand(angle: number): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const radians = angle * Math.PI / 180;
  const direction = { x: Math.sin(radians), y: -Math.cos(radians) };
  const lateral = { x: -direction.y, y: direction.x };
  const wrist = { x: 0.5, y: 0.5, z: 0 };
  const center = { x: wrist.x + direction.x * 0.28, y: wrist.y + direction.y * 0.28, z: 0 };
  landmarks[0] = wrist;
  landmarks[5] = { x: center.x + lateral.x * 0.12, y: center.y + lateral.y * 0.12, z: 0 };
  landmarks[9] = { x: center.x + lateral.x * 0.04, y: center.y + lateral.y * 0.04, z: 0 };
  landmarks[13] = { x: center.x - lateral.x * 0.04, y: center.y - lateral.y * 0.04, z: 0 };
  landmarks[17] = { x: center.x - lateral.x * 0.12, y: center.y - lateral.y * 0.12, z: 0 };
  return landmarks;
}

describe("cardinal hand direction", () => {
  it.each([0, -90, 90, 180] as const)("snaps the complete palm frame to %i degrees", (expected) => {
    expect(snapHandAngle(orientedHand(expected))).toBe(expected);
  });

  it("snaps intermediate directions to the nearest requested angle", () => {
    expect(snapHandAngle(orientedHand(30))).toBe(0);
    expect(snapHandAngle(orientedHand(70))).toBe(90);
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
    expect(getHandPosition(hand({ x: 0.5, y: 0.3 }), "Right")).toMatchObject({
      angle: 0,
      facing: "front",
      handedness: "right"
    });
  });
});
