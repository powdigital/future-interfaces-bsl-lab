import { describe, expect, it } from "vitest";
import { createChainGame } from "../src/core/chain-game.ts";

describe("five-number checkpoint game", () => {
  it("rewards the first five-number chain", () => {
    const game = createChainGame();
    [1, 2, 3, 4].forEach((number) => game.submit(number));
    const result = game.submit(5);

    expect(result.type).toBe("accepted");
    if (result.type === "accepted") {
      expect(result.state.progress).toBe(5);
      expect(result.milestone).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("rewards numbers 6 through 10 as the second chain", () => {
    const game = createChainGame();
    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((number) => game.submit(number));
    const result = game.submit(10);

    expect(result.type).toBe("accepted");
    if (result.type === "accepted") {
      expect(result.state.complete).toBe(true);
      expect(result.milestone).toEqual([6, 7, 8, 9, 10]);
    }
  });

  it("returns to checkpoint 5 after a mistake in the second chain", () => {
    const game = createChainGame();
    [1, 2, 3, 4, 5, 6].forEach((number) => game.submit(number));
    const result = game.submit(8);

    expect(result.type).toBe("failed");
    if (result.type === "failed") {
      expect(result.expected).toBe(7);
      expect(result.state.progress).toBe(5);
      expect(result.state.expected).toBe(6);
      expect(result.resetNumbers).toEqual([6]);
    }
  });

  it("returns to zero after a mistake in the first chain", () => {
    const game = createChainGame();
    [1, 2, 3].forEach((number) => game.submit(number));
    const result = game.submit(5);

    expect(result.type).toBe("failed");
    if (result.type === "failed") {
      expect(result.state.progress).toBe(0);
      expect(result.state.expected).toBe(1);
      expect(result.resetNumbers).toEqual([1, 2, 3]);
    }
  });

  it("starts a fresh round when Number 1 follows a completed chain", () => {
    const game = createChainGame();
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((number) => game.submit(number));
    const result = game.submit(1);

    expect(result.type).toBe("accepted");
    if (result.type === "accepted") expect(result.state.progress).toBe(1);
  });
});
