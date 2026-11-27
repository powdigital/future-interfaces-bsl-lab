import { describe, expect, it } from "vitest";
import { createLibraryDwell, easeDwellProgress, indexLabelPosition, type DwellTarget } from "../src/core/library-navigation.ts";
import type { Landmark } from "../src/core/types.ts";

const targets: DwellTarget[] = [
  { id: "number", left: 10, top: 10, right: 110, bottom: 60, enabled: true },
  { id: "letter", left: 120, top: 10, right: 220, bottom: 60, enabled: true },
  { id: "word", left: 230, top: 10, right: 330, bottom: 60, enabled: false }
];
const pointer = (x = 30, id = "Right") => ({ id, x, y: 30 });
const hoverUntil = (d: ReturnType<typeof createLibraryDwell>, until: number, x = 30, from = 0) => {
  for (let now = from; now <= until; now += 50) d.update(now, [pointer(x)], targets);
};

describe("index-label library navigation", () => {
  it("eases the visual fill smoothly without overshoot or changing the dwell clock", () => {
    expect(easeDwellProgress(0)).toBe(0);
    expect(easeDwellProgress(.25)).toBe(.0625);
    expect(easeDwellProgress(.5)).toBe(.5);
    expect(easeDwellProgress(.75)).toBe(.9375);
    expect(easeDwellProgress(1)).toBe(1);
    expect(easeDwellProgress(-1)).toBe(0);
    expect(easeDwellProgress(2)).toBe(1);
    expect(easeDwellProgress(NaN)).toBe(0);
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const value = easeDwellProgress(i / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
    const d = createLibraryDwell(750, 200, 0); hoverUntil(d, 700);
    const early = d.update(749, [pointer()], targets);
    expect(easeDwellProgress(early.progress)).toBeLessThan(1);
    expect(early.triggered).toBeNull();
    expect(d.update(750, [pointer()], targets).triggered).toBe("number");
  });
  it("triggers exactly at 750 ms, once until the index leaves", () => {
    const d = createLibraryDwell(750, 200, 0); hoverUntil(d, 700);
    expect(d.update(749, [pointer()], targets).triggered).toBeNull();
    expect(d.update(750, [pointer()], targets)).toMatchObject({ triggered: "number", progress: 1 });
    expect(d.update(800, [pointer()], targets).triggered).toBeNull();
    expect(d.update(850, [pointer()], targets).triggered).toBeNull();
  });
  it("keeps progress across a brief exit instead of restarting", () => {
    const d = createLibraryDwell(750, 200, 0); hoverUntil(d, 700);
    d.update(740, [pointer(111)], targets);
    expect(d.update(750, [pointer()], targets).progress).toBeCloseTo(700 / 750);
    expect(d.update(800, [pointer()], targets).triggered).toBeNull();
    expect(d.update(850, [pointer()], targets).triggered).toBe("number");
  });
  it("cannot transfer a partial hold between hands or tabs", () => {
    const d = createLibraryDwell(750, 200, 0); hoverUntil(d, 700);
    expect(d.update(750, [pointer(30, "Left")], targets).triggered).toBeNull();
    expect(d.update(800, [pointer(150, "Left")], targets)).toMatchObject({ target: "number", triggered: null });
    for (let now = 900; now <= 1200; now += 100) d.update(now, [pointer(150, "Left")], targets);
    expect(d.update(1250, [pointer(150, "Left")], targets).target).toBeNull();
    expect(d.update(1350, [pointer(150, "Left")], targets)).toMatchObject({ target: "letter", triggered: null });
  });
  it("keeps the same hand candidate despite detection ordering changes", () => {
    const d = createLibraryDwell(750, 200, 0);
    for (let now = 0; now <= 700; now += 50) {
      const pointers = [pointer(), pointer(150, "Left")];
      d.update(now, now % 100 ? pointers.reverse() : pointers, targets);
    }
    expect(d.update(750, [pointer(150, "Left"), pointer()], targets).triggered).toBe("number");
  });
  it("preserves a short missing-index gap but resets a long camera stall", () => {
    const d = createLibraryDwell(750, 200, 0); hoverUntil(d, 700);
    d.update(725, [], targets);
    expect(d.update(750, [pointer()], targets).progress).toBeCloseTo(700 / 750);
    expect(d.update(2000, [pointer()], targets).progress).toBe(0);
  });
  it("does not activate disabled targets or ambiguous duplicate hand identities", () => {
    const d = createLibraryDwell(750, 200, 0); hoverUntil(d, 2000, 250);
    expect(d.update(2050, [pointer(250)], targets)).toMatchObject({ target: null, triggered: null });
    expect(d.update(2100, [pointer(), pointer()], targets).target).toBeNull();
  });
  it("allows Words to activate through the same 750 ms dwell when enabled", () => {
    const d = createLibraryDwell(750, 200, 0);
    const enabled = targets.map(target => ({ ...target, enabled: true }));
    for (let now = 0; now < 750; now += 50) expect(d.update(now, [pointer(250)], enabled).triggered).toBeNull();
    expect(d.update(750, [pointer(250)], enabled).triggered).toBe("word");
  });
  it("projects the I label using the mirrored cover crop and 16px label offset", () => {
    const hand = Array.from({ length: 21 }, () => ({ x: .25, y: .5 })) as Landmark[];
    expect(indexLabelPosition(hand, { width: 800, height: 600, videoBounds: { x: -200, y: 0, width: 1200, height: 600 } }))
      .toEqual({ x: 700, y: 284 });
    expect(indexLabelPosition([], { width: 800, height: 600, videoBounds: { x: 0, y: 0, width: 800, height: 600 } })).toBeNull();
  });
});
