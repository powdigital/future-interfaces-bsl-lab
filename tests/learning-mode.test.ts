import { describe, expect, it } from "vitest";
import { createLearningMode, isLearningCheckpoint, isTwoThumbsUp } from "../src/core/learning-mode.ts";
import type { HandMetrics } from "../src/core/types.ts";

const digit = (state: "extended" | "folded") => ({ state, angle1: 0, angle2: 0, straightness: 0, reach: 0 });
const thumbsUp = (): HandMetrics => [digit("extended"), digit("folded"), digit("folded"), digit("folded"), digit("folded")];

describe("checkpoint learning mode", () => {
  it("only permits entry at an unfinished five-number checkpoint", () => {
    [5, 10, 15].forEach((value) => expect(isLearningCheckpoint(value)).toBe(true));
    [0, 4, 6, 20].forEach((value) => expect(isLearningCheckpoint(value)).toBe(false));
  });

  it("requires exactly two clean thumbs-up poses", () => {
    expect(isTwoThumbsUp([thumbsUp(), thumbsUp()])).toBe(true);
    expect(isTwoThumbsUp([thumbsUp()])).toBe(false);
    const openHand = thumbsUp();
    openHand[1] = digit("extended");
    expect(isTwoThumbsUp([thumbsUp(), openHand])).toBe(false);
  });

  it("teaches the next five in order then returns to the same checkpoint", () => {
    const mode = createLearningMode();
    expect(mode.start(5).expected).toBe(6);
    expect(mode.submit(7).accepted).toBe(false);
    [6, 7, 8, 9].forEach((number) => expect(mode.submit(number).accepted).toBe(true));
    const result = mode.submit(10);
    expect(result.accepted).toBe(true);
    expect(result.finished).toBe(true);
    expect(result.state.active).toBe(false);
    expect(result.state.checkpoint).toBe(5);
    expect(result.state.completed).toEqual([6, 7, 8, 9, 10]);
  });
});
