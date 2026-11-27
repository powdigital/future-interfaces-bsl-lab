import { describe, expect, it } from "vitest";
import { WORD_GROUPS, WORD_PLACEHOLDERS } from "../src/core/word-library.ts";
import { practiceLibrary } from "../src/core/practice-library.ts";
import { SIGN_BANK } from "../src/core/sign-bank.ts";

describe("prototype word library", () => {
  it("includes all 108 supplied words in their 12 groups", () => {
    expect(WORD_GROUPS.map(group => group.words.length)).toEqual([10, 12, 10, 10, 10, 8, 8, 12, 8, 6, 6, 8]);
    expect(WORD_PLACEHOLDERS).toHaveLength(108);
    expect(new Set(WORD_PLACEHOLDERS.map(word => word.id)).size).toBe(108);
    expect(WORD_PLACEHOLDERS.at(-1)?.word).toBe("wrong");
  });
  it("uses outside for Places and keeps toilet only in Everyday needs", () => {
    expect(WORD_PLACEHOLDERS.filter(word => word.word === "toilet").map(word => word.group)).toEqual(["Everyday needs"]);
    expect(WORD_PLACEHOLDERS.find(word => word.word === "outside")?.group).toBe("Places");
    expect(WORD_PLACEHOLDERS.find(word => word.word === "thank you")?.id).toBe("bsl-word-thank-you");
  });
  it("exposes stable grouped objects without claiming recognition support", () => {
    const words = practiceLibrary(SIGN_BANK).filter(entry => entry.category === "word");
    expect(words).toHaveLength(108);
    expect(words.every(word => !word.available && word.group && word.reason)).toBe(true);
    expect(words.map(word => word.label)).toEqual(WORD_PLACEHOLDERS.map(word => word.label));
  });
});
