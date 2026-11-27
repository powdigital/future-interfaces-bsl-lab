import type { SignDefinition } from "./types.ts";
import { WORD_PLACEHOLDERS } from "./word-library.ts";

export interface PracticeLibraryEntry {
  id: string;
  label: string;
  category: "number" | "letter" | "word";
  available: boolean;
  reason?: string;
  group?: string;
}

// A slot is not a classifier. Letters need reviewed hand relationships and assets
// before activation; they must never fall back to a similar-looking number.
export function practiceLibrary(signs: SignDefinition[]): PracticeLibraryEntry[] {
  const entries: PracticeLibraryEntry[] = signs.map((sign) => ({
    id: sign.id, label: sign.label, category: sign.category,
    available: sign.recognitionType === "static" || (sign.recognitionType === "motion" && sign.motion?.status === "active")
  }));
  for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    const id = `bsl-letter-${letter}`;
    if (!entries.some((entry) => entry.id === id)) entries.push({
      id, label: `Letter ${letter.toUpperCase()}`, category: "letter", available: false,
      reason: "Definition and diagram needed"
    });
  }
  for (const word of WORD_PLACEHOLDERS) {
    const existing = entries.find(entry => entry.id === word.id);
    if (existing) existing.group = word.group;
    else entries.push({ ...word });
  }
  return entries;
}
