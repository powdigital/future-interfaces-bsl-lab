import { describe, expect, it } from "vitest";
import { createLibraryGames } from "../src/core/library-games.ts";
import { chainScorePresentation } from "../src/components/chain-score.ts";

describe("shared library gamification", () => {
  it("keeps distinct game objects for each library", () => {
    const libraries = createLibraryGames();
    const numbers = libraries.get("number", 20);
    numbers.submit(1); numbers.submit(2);
    const letters = libraries.get("letter", 26);
    expect(letters.getState().progress).toBe(0);
    letters.submit(1);
    expect(libraries.get("number", 20).getState().progress).toBe(2);
    expect(libraries.get("letter", 26).getState().progress).toBe(1);
  });
  it("resets all progress on category changes by default, retaining game references", () => {
    const libraries = createLibraryGames();
    const numbers = libraries.get("number", 20);
    const letters = libraries.get("letter", 26);
    const words = libraries.get("word", 108);
    for (let i = 1; i <= 5; i++) numbers.submit(i);
    letters.submit(1); words.submit(1);
    expect(libraries.activate("letter")).toBe(true);
    for (const game of [numbers, letters, words]) expect(game.getState()).toMatchObject({ progress: 0, checkpoint: 0, recognizedNumbers: [] });
    expect(libraries.get("number", 20)).toBe(numbers);
    letters.submit(1);
    expect(libraries.activate("letter")).toBe(false);
    expect(letters.getState().progress).toBe(1);
    libraries.activate("word");
    expect(letters.getState().progress).toBe(0);
  });
  it("keeps the reset-on-switch policy configurable for later difficulty modes", () => {
    const libraries = createLibraryGames({ resetOnSwitch: false });
    const game = libraries.get("number", 20); game.submit(1);
    libraries.activate("word");
    expect(game.getState().progress).toBe(1);
  });
  it("resets only the selected library and supports future library IDs", () => {
    const libraries = createLibraryGames();
    const numbers = libraries.get("number", 20);
    const letters = libraries.get("letter", 26);
    const colours = libraries.get("colours", 12);
    numbers.submit(1); letters.submit(1); colours.submit(1);
    letters.reset();
    expect(numbers.getState().progress).toBe(1);
    expect(letters.getState().progress).toBe(0);
    expect(colours.getState().progress).toBe(1);
    numbers.reset();
    expect(numbers.getState().recognizedNumbers).toEqual([]);
  });
  it("uses consistent score formatting for all categories", () => {
    expect(chainScorePresentation(0)).toEqual({ text: "00", chaining: false });
    expect(chainScorePresentation(1)).toEqual({ text: "01", chaining: false });
    expect(chainScorePresentation(26)).toEqual({ text: "26", chaining: true });
    expect(chainScorePresentation(120)).toEqual({ text: "120", chaining: true });
    expect(chainScorePresentation(NaN)).toEqual({ text: "00", chaining: false });
    expect(chainScorePresentation(-1)).toEqual({ text: "00", chaining: false });
  });
});
