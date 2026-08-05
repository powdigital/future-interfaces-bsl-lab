import { describe, expect, it } from "vitest";
import { createPinchCycleRecognizer, type MotionObservation } from "../src/core/motion-engine.ts";

function frame(timestamp: number, pinchDistance: number, centerX = 0, centerY = 0): MotionObservation {
  return { timestamp, pinchDistance, centerX, centerY, palmScale: 1 };
}

function primeOpen(recognizer: ReturnType<typeof createPinchCycleRecognizer>) {
  recognizer.update(frame(0, 0.7));
  recognizer.update(frame(30, 0.68));
  return recognizer.update(frame(60, 0.66));
}

describe("single-cycle Number 11 motion recognition", () => {
  it("detects one complete open, close, reopen pinch", () => {
    const recognizer = createPinchCycleRecognizer();
    expect(primeOpen(recognizer).phase).toBe("ready");
    expect(recognizer.update(frame(180, 0.42)).phase).toBe("closing");
    expect(recognizer.update(frame(360, 0.2)).phase).toBe("reopening");
    const result = recognizer.update(frame(620, 0.58));
    expect(result.detected).toBe(true);
    expect(result.signId).toBe("bsl-number-11");
    expect(result.phase).toBe("cooldown");
  });

  it("does not detect a held closed pinch", () => {
    const recognizer = createPinchCycleRecognizer();
    [0, 100, 200, 300, 400].forEach((timestamp) => {
      expect(recognizer.update(frame(timestamp, 0.18)).detected).toBe(false);
    });
  });

  it("does not detect an incomplete movement", () => {
    const recognizer = createPinchCycleRecognizer();
    primeOpen(recognizer);
    recognizer.update(frame(200, 0.4));
    recognizer.update(frame(400, 0.32));
    const result = recognizer.update(frame(600, 0.65));
    expect(result.detected).toBe(false);
    expect(result.phase).toBe("ready");
  });

  it("does not emit twice during a repeated movement inside the cooldown", () => {
    const recognizer = createPinchCycleRecognizer();
    primeOpen(recognizer);
    recognizer.update(frame(180, 0.4));
    recognizer.update(frame(360, 0.18));
    expect(recognizer.update(frame(620, 0.6)).detected).toBe(true);
    expect(recognizer.update(frame(720, 0.4)).detected).toBe(false);
    expect(recognizer.update(frame(850, 0.18)).detected).toBe(false);
    expect(recognizer.update(frame(1050, 0.62)).detected).toBe(false);
  });

  it("rejects a cycle dominated by whole-hand movement", () => {
    const recognizer = createPinchCycleRecognizer();
    primeOpen(recognizer);
    recognizer.update(frame(180, 0.4, 0, 0));
    const result = recognizer.update(frame(360, 0.18, 1.1, 0));
    expect(result.detected).toBe(false);
    expect(result.phase).toBe("waiting");
  });
});
