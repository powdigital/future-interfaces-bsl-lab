import { describe, expect, it } from "vitest";
import {
  approximateHeadBounds, createCalibrationHold, createHeadBoxTracker,
  evaluateCameraCalibration, meanLuminance, projectBox
} from "../src/core/camera-calibration.ts";

const head = { left: .43, right: .57, top: .2, bottom: .5 };
const left = { left: .12, right: .27, top: .32, bottom: .65 };
const right = { left: .73, right: .88, top: .32, bottom: .65 };
const good = { head, hands: [left, right], luminance: 100, faceTrackerReady: true };

describe("head and two-hand framing calibration", () => {
  it("accepts correctly framed head and hands, regardless of detection order", () => {
    expect(evaluateCameraCalibration(good).ready).toBe(true);
    expect(evaluateCameraCalibration({ ...good, hands: [right, left] }).ready).toBe(true);
  });

  it("requires the head and two distinct hands, not an individual sign", () => {
    expect(evaluateCameraCalibration({ ...good, hands: [left] }).ready).toBe(false);
    expect(evaluateCameraCalibration({ ...good, hands: [left, left] }).ready).toBe(false);
    expect(evaluateCameraCalibration({ ...good, head: null }).ready).toBe(false);
    expect(evaluateCameraCalibration({ ...good, faceTrackerReady: false }).message).toContain("unavailable");
  });

  it("prioritizes darkness over every positioning instruction", () => {
    const result = evaluateCameraCalibration({ ...good, luminance: 20 });
    expect(result).toMatchObject({ ready: false, lightingLow: true, message: "Lighting too low", headReady: false, leftReady: false, rightReady: false });
    expect(evaluateCameraCalibration({ ...good, luminance: NaN }).ready).toBe(false);
  });

  it("offers depth and head-height guidance", () => {
    expect(evaluateCameraCalibration({ ...good, head: { left: .3, right: .7, top: .1, bottom: .8 } }).message).toBe("Move back");
    expect(evaluateCameraCalibration({ ...good, head: { left: .48, right: .52, top: .3, bottom: .4 } }).message).toBe("Move forward");
    expect(evaluateCameraCalibration({ ...good, head: { ...head, top: .1, bottom: .4 } }).message).toBe("Head: move down");
    expect(evaluateCameraCalibration({ ...good, head: { ...head, top: .4, bottom: .7 } }).message).toBe("Head: move up");
  });

  it("requires a continuous hold and discards progress after lost tracking or low light", () => {
    const hold = createCalibrationHold();
    expect(hold.update(true, 0).progress).toBe(0);
    expect(hold.update(true, 1000).complete).toBe(false);
    expect(hold.update(false, 1100).progress).toBe(0);
    expect(hold.update(true, 1200).complete).toBe(false);
    expect(hold.update(true, 2699).complete).toBe(false);
    expect(hold.update(true, 2700).complete).toBe(true);
    hold.reset();
    expect(hold.update(true, 5000).complete).toBe(false);
  });

  it("projects source coordinates through the mirrored visible camera crop", () => {
    expect(projectBox({ left: .3, right: .4, top: .2, bottom: .6 }, {
      width: 600, height: 600, videoBounds: { x: -200, y: 0, width: 1000, height: 600 }
    })).toMatchObject({ top: .2, bottom: .6 });
    const result = projectBox(left, { width: 1, height: 1, videoBounds: { x: 0, y: 0, width: 1, height: 1 } });
    expect(result.left).toBeCloseTo(.73);
    expect(result.right).toBeCloseTo(.88);
  });

  it("redraws the head box only every 500ms and removes a lost head", () => {
    const tracker = createHeadBoxTracker();
    expect(tracker.update(head, 0)).toEqual(head);
    expect(tracker.update(left, 499)).toEqual(head);
    expect(tracker.update(left, 500)).toEqual(left);
    expect(tracker.update(null, 900)).toEqual(left);
    expect(tracker.update(null, 1000)).toBeNull();
  });

  it("builds an axis-aligned head box from face features and eyes", () => {
    const face = Array.from({ length: 468 }, () => ({ x: .5, y: .4 }));
    face[33] = { x: .46, y: .35 };
    face[263] = { x: .54, y: .35 };
    face[10] = { x: .5, y: .2 };
    face[152] = { x: .5, y: .6 };
    expect(approximateHeadBounds(face)?.top).toBeLessThan(.2);
    expect(approximateHeadBounds(face)?.bottom).toBeGreaterThan(.6);
    expect(approximateHeadBounds([])).toBeNull();
  });

  it("checks subject lighting without letting a bright background hide a dark face", () => {
    const pixels = [10, 10, 10, 255, 240, 240, 240, 255];
    expect(meanLuminance(pixels, 2, 1)).toBeCloseTo(125);
    expect(meanLuminance(pixels, 2, 1, { left: 0, right: .5, top: 0, bottom: 1 })).toBeCloseTo(10);
  });
});
