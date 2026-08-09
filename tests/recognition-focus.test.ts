import { describe, expect, it } from "vitest";
import { SIGN_BANK } from "../src/core/sign-bank.ts";
import { focusedStaticNumbers, numberFocusRange } from "../src/core/recognition-focus.ts";

describe("five-number recognition focus", () => {
  it("focuses only Numbers 1 to 5 before the first checkpoint", () => {
    expect(focusedStaticNumbers(SIGN_BANK, 0).map((sign) => sign.shortLabel)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("removes Number 4 and focuses Numbers 6 to 10 after checkpoint 5", () => {
    const focused = focusedStaticNumbers(SIGN_BANK, 5);
    expect(focused.map((sign) => sign.shortLabel)).toEqual(["6", "7", "8", "9", "10"]);
    expect(focused.some((sign) => sign.id === "bsl-number-4")).toBe(false);
    expect(focused.some((sign) => sign.id === "bsl-number-9")).toBe(true);
  });

  it("keeps the final active block focused after completion", () => {
    expect(numberFocusRange(10)).toEqual({ minimum: 6, maximum: 10 });
  });
});
