import { describe, expect, it } from "vitest";
import { createTargetPractice } from "../src/core/target-practice.ts";
import { practiceLibrary } from "../src/core/practice-library.ts";
import { SIGN_BANK } from "../src/core/sign-bank.ts";

describe("gentle target practice", () => {
  it("offers unlimited preparation and requires a continuous starting pose", () => {
    const p = createTargetPractice(); p.reset({ id: "13", kind: "motion" });
    for (let now = 0; now <= 10000; now += 100) p.update({ now, available: true, startPose: false });
    expect(p.getState()).toMatchObject({ phase: "preparing", remainingMs: 4000 });
    p.update({ now: 10100, available: true, startPose: true });
    p.update({ now: 10200, available: true, startPose: false });
    expect(p.getState().preparationProgress).toBe(0);
    p.update({ now: 10300, available: true, startPose: true });
    expect(p.update({ now: 10400, available: true, startPose: true }).phase).toBe("performing");
  });
  it("does not accept static evidence as a moving sign", () => {
    const p = createTargetPractice(); p.reset({ id: "13", kind: "motion" });
    for (let now = 0; now < 4200; now += 100) p.update({ now, available: true, startPose: true, staticMatch: true });
    expect(p.getState().phase).toBe("performing");
    expect(p.update({ now: 4200, available: true, startPose: false }).phase).toBe("timeout");
  });
  it("holds static signs for 500ms after preparation, independently of frame rate", () => {
    for (const step of [20, 100]) {
      const p = createTargetPractice(); p.reset({ id: "3", kind: "static" });
      let now = 0;
      while (p.getState().phase !== "performing") { p.update({ now, available: true, startPose: true }); now += step; }
      const start = now - step;
      while (now < start + 500) { expect(p.update({ now, available: true, startPose: true, staticMatch: true }).phase).toBe("performing"); now += step; }
      expect(p.update({ now, available: true, startPose: true, staticMatch: true }).phase).toBe("success");
    }
  });
  it("allows correction of a wrong sign during an active attempt", () => {
    const p = createTargetPractice(); p.reset({ id: "3", kind: "static" });
    for (let now = 0; now <= 200; now += 100) p.update({ now, available: true, startPose: true });
    for (let now = 300; now <= 700; now += 100) expect(p.update({ now, available: true, startPose: false }).phase).toBe("performing");
    for (let now = 800; now <= 1200; now += 100) p.update({ now, available: true, startPose: true, staticMatch: true });
    expect(p.getState().phase).toBe("success");
  });
  it("pauses for lost tracking or lighting, re-prepares and preserves remaining time", () => {
    const p = createTargetPractice(); p.reset({ id: "11", kind: "motion" });
    for (let now = 0; now <= 400; now += 100) p.update({ now, available: true, startPose: true });
    const remaining = p.getState().remainingMs;
    for (let now = 500; now <= 5000; now += 100) p.update({ now, available: false, startPose: true, motionComplete: true });
    expect(p.getState()).toMatchObject({ phase: "paused", remainingMs: remaining });
    p.update({ now: 5100, available: true, startPose: true });
    p.update({ now: 5200, available: true, startPose: true });
    expect(p.update({ now: 5300, available: true, startPose: true }).phase).toBe("performing");
    expect(p.getState().remainingMs).toBe(remaining);
  });
  it("does not count hidden-tab or inference-stall time", () => {
    const p = createTargetPractice(); p.reset({ id: "11", kind: "motion" });
    for (let now = 0; now <= 200; now += 100) p.update({ now, available: true, startPose: true });
    expect(p.update({ now: 10000, available: true, startPose: true, motionComplete: true })).toMatchObject({ phase: "paused", remainingMs: 4000 });
  });
  it("accepts only a complete movement and latches its result", () => {
    const p = createTargetPractice(); p.reset({ id: "13", kind: "motion" });
    for (let now = 0; now <= 200; now += 100) p.update({ now, available: true, startPose: true, motionComplete: true });
    expect(p.getState().phase).toBe("performing");
    expect(p.update({ now: 300, available: true, startPose: true, motionComplete: true }).phase).toBe("success");
    expect(p.update({ now: 8000, available: false, startPose: false }).phase).toBe("success");
    expect(p.reset({ id: "14", kind: "motion" })).toMatchObject({ phase: "preparing", progress: 0, remainingMs: 4000 });
  });
  it("supports arbitrary letter IDs and per-sign difficulty without number assumptions", () => {
    const p = createTargetPractice();
    expect(p.reset({ id: "bsl-letter-a", kind: "static", policy: { staticWindowMs: 5000 } })).toMatchObject({ targetId: "bsl-letter-a", remainingMs: 5000 });
    const library = practiceLibrary(SIGN_BANK);
    expect(library.filter(e => e.category === "number" && e.available)).toHaveLength(20);
    expect(library.filter(e => e.category === "letter" && !e.available)).toHaveLength(26);
  });
});
