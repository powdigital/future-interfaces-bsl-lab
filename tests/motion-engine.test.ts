import { describe, expect, it } from "vitest";
import { SIGN_BANK, getSign } from "../src/core/sign-bank.ts";
import { createTargetMotion, motionStartMatches } from "../src/core/target-motion.ts";
import type { MotionObservation } from "../src/core/motion-engine.ts";
import type { DigitMetrics, DigitState, HandMetrics } from "../src/core/types.ts";

function digit(state: DigitState): DigitMetrics {
  if (state === "extended") return { state, angle1: 172, angle2: 176, straightness: .98, reach: 1.3 };
  if (state === "folded") return { state, angle1: 72, angle2: 95, straightness: .55, reach: .76 };
  return { state, angle1: 138, angle2: 148, straightness: .82, reach: 1.01 };
}
const pose = (number: number) => getSign(`bsl-number-${number}`)!.statePattern.map(digit) as HandMetrics;
function frame(timestamp: number, overrides: Partial<MotionObservation> = {}): MotionObservation {
  return { timestamp, indexPinchDistance: .8, middlePinchDistance: .9, palmAngle: 0,
    centerX: 0, centerY: 0, palmScale: 1, ...overrides };
}
function detector(number: number) { return createTargetMotion(getSign(`bsl-number-${number}`)!); }

describe("target-only motion detectors", () => {
  it("accepts 11 with a naturally curling index and an unrestricted thumb", () => {
    const d = detector(11), h = pose(11);
    expect(motionStartMatches(getSign("bsl-number-11")!, frame(0), h)).toBe(true);
    d.update(frame(0), h);
    const closed = [...h] as HandMetrics;
    closed[0] = digit("folded"); closed[1] = digit("folded");
    d.update(frame(200, { indexPinchDistance: .28 }), closed);
    expect(d.update(frame(300, { indexPinchDistance: .28 }), closed).complete).toBe(true);
  });
  it("rejects a held closed pinch without seeing the opening", () => {
    const d = detector(11);
    for (let t = 0; t < 3000; t += 100) expect(d.update(frame(t, { indexPinchDistance: .2 }), pose(11)).complete).toBe(false);
  });
  it("does not accept extra extended fingers during an 11 pinch", () => {
    const d = detector(11);
    d.update(frame(0), pose(11));
    for (let t = 100; t <= 600; t += 100) expect(d.update(frame(t, { indexPinchDistance: .2 }), pose(12)).complete).toBe(false);
  });
  it("requires two separate closures for 20, never an 11 held longer", () => {
    const d = detector(20), h = pose(20);
    d.update(frame(0), h);
    for (let t = 100; t <= 900; t += 100) expect(d.update(frame(t, { indexPinchDistance: .25 }), h).complete).toBe(false);
    d.update(frame(1000), h);
    d.update(frame(1100, { indexPinchDistance: .25 }), h);
    expect(d.update(frame(1200, { indexPinchDistance: .25 }), h).complete).toBe(true);
  });
  it("requires both fingertip contacts for 12", () => {
    const d = detector(12), h = pose(12);
    d.update(frame(0), h);
    d.update(frame(200, { indexPinchDistance: .25 }), h);
    expect(d.update(frame(300, { indexPinchDistance: .25 }), h).complete).toBe(false);
    d.update(frame(400, { indexPinchDistance: .25, middlePinchDistance: .3 }), h);
    expect(d.update(frame(500, { indexPinchDistance: .25, middlePinchDistance: .3 }), h).complete).toBe(true);
  });
  it.each([13, 14, 15])("recognizes %i from two sideways waves with no wrist rotation", number => {
    const d = detector(number), h = pose(number);
    const results = [0, .6, -.6, .6, -.6].map((centerX, i) => d.update(frame(i * 200, { centerX }), h));
    expect(results.slice(0, -1).every(r => !r.complete)).toBe(true);
    expect(results.at(-1)?.complete).toBe(true);
  });
  it.each([16, 17, 18, 19])("retains the configured vertical movement for %i", number => {
    const d = detector(number), h = pose(number);
    const results = [0, .6, -.6, .6, -.6].map((centerY, i) => d.update(frame(i * 200, { centerY }), h));
    expect(results.at(-1)?.complete).toBe(true);
  });
  it("rejects static 3, wrist-only rotation and wrong-axis movement as 13", () => {
    for (const key of ["palmAngle", "centerY"] as const) {
      const d = detector(13);
      [0, 30, -30, 30, -30].forEach((value, i) => expect(d.update(frame(i * 200, { [key]: value }), pose(13)).complete).toBe(false));
    }
    const d = detector(13);
    for (let t = 0; t <= 3000; t += 100) expect(d.update(frame(t), pose(13)).complete).toBe(false);
  });
  it("rejects a single wave and a wrong finger pattern", () => {
    const d = detector(13);
    [0, .6, -.6].forEach((centerX, i) => expect(d.update(frame(i * 200, { centerX }), pose(13)).complete).toBe(false));
    const wrong = detector(14);
    [0, .6, -.6, .6, -.6].forEach((centerX, i) => expect(wrong.update(frame(i * 200, { centerX }), pose(13)).complete).toBe(false));
  });
  it("normalizes distance using the starting palm scale, independent of position and later scale changes", () => {
    for (const scale of [.1, .3]) {
      const d = detector(13);
      const results = [0, .6, -.6, .6, -.6].map((x, i) => d.update(frame(i * 200, { centerX: .5 + x * scale, palmScale: scale }), pose(13)));
      expect(results.at(-1)?.complete).toBe(true);
    }
    const d = detector(13);
    [.1, .2, .05, .2, .1].forEach((palmScale, i) => expect(d.update(frame(i * 200, { centerX: .5, palmScale }), pose(13)).complete).toBe(false));
  });
  it("allows a slow 3-second wave", () => {
    const d = detector(13);
    let result = d.update(frame(0), pose(13));
    const positions = [0, .6, -.6, .6, -.6];
    for (let segment = 0; segment < 4; segment++) {
      for (let j = 1; j <= 8; j++) {
        const centerX = positions[segment] + (positions[segment + 1] - positions[segment]) * j / 8;
        result = d.update(frame((segment * 8 + j) * 100, { centerX }), pose(13));
      }
    }
    expect(result.complete).toBe(true);
  });
  it("clears partial movements after a tracking interruption or reset", () => {
    const d = detector(13);
    d.update(frame(0), pose(13));
    d.update(frame(200, { centerX: .6 }), pose(13));
    d.update(frame(800, { centerX: -.6 }), pose(13));
    expect(d.update(frame(1000, { centerX: .6 }), pose(13)).complete).toBe(false);
    d.reset();
    expect(d.update(frame(1100, { centerX: -.6 }), pose(13)).progress).toBe(0);
  });
  it("can construct each of the ten number detectors in isolation", () => {
    const signs = SIGN_BANK.filter(s => s.motion);
    expect(signs).toHaveLength(10);
    for (const sign of signs) expect(createTargetMotion(sign)).toBeDefined();
  });
});
