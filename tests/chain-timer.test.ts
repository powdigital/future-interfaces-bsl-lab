import { describe, expect, it } from "vitest";
import { countdownProgress, turnDurationMs } from "../src/core/chain-timer.ts";

describe("timed chain difficulty", () => {
  it("waits for Number 1 before timing the sequence", () => {
    expect(turnDurationMs(0)).toBeNull();
    expect(turnDurationMs(1)).toBe(2000);
  });

  it("adds two seconds after each secured five-number checkpoint", () => {
    [5, 10, 15].forEach((progress) => expect(turnDurationMs(progress)).toBe(4000));
    expect(turnDurationMs(6)).toBe(2000);
    expect(turnDurationMs(20)).toBeNull();
  });

  it("animates from full to empty and clamps at both ends", () => {
    expect(countdownProgress(1000, 2000, 500)).toBe(1);
    expect(countdownProgress(1000, 2000, 2000)).toBe(0.5);
    expect(countdownProgress(1000, 2000, 3000)).toBe(0);
    expect(countdownProgress(1000, 2000, 4000)).toBe(0);
  });
});
