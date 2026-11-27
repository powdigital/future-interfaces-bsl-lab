import { describe, expect, it } from "vitest";
import { SIGN_BANK } from "../src/core/sign-bank.ts";
import {
  focusedStaticNumbers,
  motionNumbersUnlocked,
  numberFocusRange
} from "../src/core/recognition-focus.ts";

describe("five-number recognition focus", () => {
  it("keeps motion recognition locked until Numbers 1 to 10 are complete", () => {
    expect(motionNumbersUnlocked(0)).toBe(false);
    expect(motionNumbersUnlocked(9)).toBe(false);
    expect(motionNumbersUnlocked(10)).toBe(true);
    expect(motionNumbersUnlocked(20)).toBe(true);
  });

  it("focuses only Numbers 1 to 5 before the first checkpoint", () => {
    expect(focusedStaticNumbers(SIGN_BANK, 0).map((sign) => sign.shortLabel)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("removes Number 4 and focuses Numbers 6 to 10 after checkpoint 5", () => {
    const focused = focusedStaticNumbers(SIGN_BANK, 5);
    expect(focused.map((sign) => sign.shortLabel)).toEqual(["6", "7", "8", "9", "10"]);
    expect(focused.some((sign) => sign.id === "bsl-number-4")).toBe(false);
    expect(focused.some((sign) => sign.id === "bsl-number-9")).toBe(true);
  });

  it("moves focus through all four five-number blocks", () => {
    expect(numberFocusRange(10)).toEqual({ minimum: 11, maximum: 15 });
    expect(numberFocusRange(15)).toEqual({ minimum: 16, maximum: 20 });
    expect(numberFocusRange(20)).toEqual({ minimum: 16, maximum: 20 });
  });

  it("leaves static recognition quiet while a motion block is focused", () => {
    expect(focusedStaticNumbers(SIGN_BANK, 10)).toEqual([]);
  });
});
