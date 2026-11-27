import { describe, expect, it } from "vitest";
import { faceRegionFromEyes, getDistanceGuidance, handOverlapsFace } from "../src/core/spatial-safety.ts";
import type { Landmark } from "../src/core/types.ts";

function hand(span: number, center = { x: 0.5, y: 0.5 }): Landmark[] {
  const points = Array.from({ length: 21 }, () => ({ ...center, z: 0 }));
  points[5] = { x: center.x - span / 2, y: center.y, z: 0 };
  points[17] = { x: center.x + span / 2, y: center.y, z: 0 };
  return points;
}

function face(): Landmark[] {
  const points = Array.from({ length: 264 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  points[33] = { x: 0.4, y: 0.42, z: 0 };
  points[263] = { x: 0.6, y: 0.42, z: 0 };
  return points;
}

describe("camera spatial safeguards", () => {
  it("classifies palm distance and allows a useful middle range", () => {
    expect(getDistanceGuidance([hand(0.04)])).toBe("move-closer");
    expect(getDistanceGuidance([hand(0.08)])).toBeNull();
    expect(getDistanceGuidance([hand(0.18)])).toBeNull();
    expect(getDistanceGuidance([hand(0.4)])).toBe("move-back");
  });

  it.each([
    [8, 0.5, 0.2], [0, 0.5, 0.8], [4, 0.2, 0.5], [20, 0.8, 0.5],
    [12, -0.05, 0.5], [16, 1.05, 0.5], [0, 0.5, 1.1]
  ])("warns before or after landmark %i crosses an edge", (index, x, y) => {
    const points = hand(0.12);
    points[index] = { x, y, z: 0 };
    expect(getDistanceGuidance([points])).toBe("move-back");
  });

  it("keeps the inner safe area clear of warnings", () => {
    const points = hand(0.12);
    points[8] = { x: 0.5, y: 0.21, z: 0 };
    points[0] = { x: 0.5, y: 0.7, z: 0 };
    expect(getDistanceGuidance([points])).toBeNull();
  });

  it("uses the visible crop rather than the source video's edges", () => {
    const points = hand(0.12);
    points[8] = { x: 0.3, y: 0.5, z: 0 };
    expect(getDistanceGuidance([points])).toBeNull();
    expect(getDistanceGuidance([points], {}, {
      width: 600, height: 600,
      videoBounds: { x: -200, y: 0, width: 1000, height: 600 }
    })).toBe("move-back");
  });

  it("prioritizes framing over moving closer, including the second hand", () => {
    const offscreen = hand(0.04, { x: 0.85, y: 0.5 });
    expect(getDistanceGuidance([offscreen])).toBe("move-back");
    expect(getDistanceGuidance([hand(0.12), offscreen])).toBe("move-back");
    expect(getDistanceGuidance([])).toBeNull();
  });

  it("warns when a centred hand occupies too much of the frame", () => {
    const points = hand(0.12);
    points[8] = { x: 0.5, y: 0.23, z: 0 };
    points[0] = { x: 0.5, y: 0.77, z: 0 };
    expect(getDistanceGuidance([points])).toBe("move-back");
  });

  it("uses both eye landmarks to establish a face exclusion region", () => {
    const region = faceRegionFromEyes(face());
    expect(region?.left).toBeCloseTo(0.32);
    expect(region?.right).toBeCloseTo(0.68);
    expect(handOverlapsFace(hand(0.12), face())).toBe(true);
    expect(handOverlapsFace(hand(0.12, { x: 0.85, y: 0.8 }), face())).toBe(false);
  });
});
