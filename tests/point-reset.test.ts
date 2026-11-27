import { describe, expect, it } from "vitest";
import { createLibraryDwell, type DwellTarget } from "../src/core/library-navigation.ts";
import { createPointResetClock, nearbyButtonGroups } from "../src/core/point-reset.ts";

const targets: DwellTarget[] = [
  { id: "number", left: 0, top: 0, right: 100, bottom: 50, enabled: true },
  { id: "letter", left: 158, top: 0, right: 258, bottom: 50, enabled: true }
];
const p = (x: number) => [{ id: "Right", x, y: 25 }];

describe("forgiving point selection", () => {
  it("has no visible button state change before 100 ms of deliberate entry", () => {
    const d = createLibraryDwell();
    expect(d.update(0, p(50), targets)).toMatchObject({ target: null, progress: 0, triggered: null });
    expect(d.update(99, p(50), targets).target).toBeNull();
    expect(d.update(100, p(50), targets)).toMatchObject({ target: "number", progress: .2, triggered: null });
    const pass = createLibraryDwell();
    pass.update(0, p(50), targets);
    expect(pass.update(99, [], targets).target).toBeNull();
    expect(pass.update(100, p(180), targets).target).toBeNull();
    expect(pass.update(199, p(180), targets).target).toBeNull();
    expect(pass.update(200, p(180), targets).target).toBe("letter");
  });
  it("never allows a configured dwell below the 100 ms hard minimum", () => {
    const d = createLibraryDwell(1);
    d.update(0, p(50), targets);
    expect(d.update(99, p(50), targets).triggered).toBeNull();
    expect(d.update(100, p(50), targets).triggered).toBe("number");
  });
  it("keeps progress while the finger moves across the full button and its halo", () => {
    const d = createLibraryDwell();
    d.update(0, p(50), targets);
    expect(d.update(100, p(5), targets).progress).toBe(.2);
    expect(d.update(200, p(95), targets).progress).toBe(.4);
    expect(d.update(300, p(120), targets).progress).toBe(.6);
    expect(d.update(400, p(-20), targets).progress).toBe(.8);
    expect(d.update(500, p(50), targets).triggered).toBe("number");
  });
  it("holds the same overlay for a 499 ms exit, then discards it at 500 ms", () => {
    const d = createLibraryDwell();
    for (let t = 0; t <= 200; t += 100) d.update(t, p(50), targets);
    for (let t = 250; t <= 650; t += 100) expect(d.update(t, [], targets)).toMatchObject({ target: "number", progress: .4, triggered: null });
    expect(d.update(749, [], targets)).toMatchObject({ target: "number", progress: .4 });
    expect(d.update(750, [], targets)).toMatchObject({ target: null, progress: 0 });
  });
  it("preserves progress after tracking loss and requires 100 ms on return", () => {
    const d = createLibraryDwell();
    for (let t = 0; t <= 400; t += 100) d.update(t, p(50), targets);
    expect(d.update(450, [], targets)).toMatchObject({ progress: .8, triggered: null });
    expect(d.update(499, p(50), targets)).toMatchObject({ progress: .8, triggered: null });
    expect(d.update(598, p(50), targets).triggered).toBeNull();
    expect(d.update(599, p(50), targets).triggered).toBe("number");
  });
  it("selects at 500 ms by default, not earlier", () => {
    const d = createLibraryDwell();
    for (let t = 0; t <= 450; t += 50) expect(d.update(t, p(50), targets).triggered).toBeNull();
    expect(d.update(499, p(50), targets).triggered).toBeNull();
    expect(d.update(500, p(50), targets).triggered).toBe("number");
  });
  it("requires a strict initial hit then retains the whole padded button", () => {
    const d = createLibraryDwell();
    expect(d.update(0, p(105), targets).target).toBeNull();
    d.update(50, p(99), targets);
    expect(d.update(100, p(105), targets).target).toBeNull();
    d.update(150, p(99), targets);
    d.update(250, p(104), targets);
    expect(d.update(350, p(109), targets).target).toBe("number");
    d.update(450, p(114), targets);
    expect(d.update(550, p(119), targets).triggered).toBe("number");
    expect(d.update(650, p(123), targets).triggered).toBeNull();
  });
  it("pauses outside the tolerance and cannot absorb another button", () => {
    const d = createLibraryDwell();
    for (let t = 0; t < 500; t += 100) d.update(t, p(99), targets);
    expect(d.update(500, p(125), targets)).toMatchObject({ target: "number", progress: .8, triggered: null });
    d.update(550, p(99), targets);
    expect(d.update(650, p(160), targets)).toMatchObject({ target: "number", progress: .8, triggered: null });
  });
  it("does not retrigger a held finger after the shared reset interval", () => {
    const d = createLibraryDwell();
    for (let t = 0; t <= 500; t += 100) d.update(t, p(50), targets);
    for (let t = 600; t <= 900; t += 100) d.suspend(t);
    expect(d.update(1000, p(50), targets).triggered).toBeNull();
    d.update(1050, [], targets);
    expect(d.update(1100, p(50), targets)).toMatchObject({ progress: 1, triggered: null });
  });
});

describe("shared point-gesture reset", () => {
  it("blocks for 500 ms, holding a 50% black mask then fading for 350 ms", () => {
    const clock = createPointResetClock();
    expect(clock.blocked(0)).toBe(false);
    clock.start(1000);
    expect(clock.overlayOpacity(1000)).toBe(.5);
    expect(clock.overlayOpacity(1150)).toBe(.5);
    expect(clock.overlayOpacity(1325)).toBe(.25);
    expect(clock.blocked(1499)).toBe(true);
    expect(clock.blocked(1500)).toBe(false);
    expect(clock.overlayOpacity(1500)).toBe(0);
  });
  it("includes adjacent button groups but excludes distant controls", () => {
    expect(nearbyButtonGroups(targets[0], targets[1])).toBe(true);
    expect(nearbyButtonGroups(targets[0], { left: 0, top: 65, right: 100, bottom: 95 })).toBe(true);
    expect(nearbyButtonGroups(targets[0], { left: 400, top: 0, right: 500, bottom: 50 })).toBe(false);
  });
});
