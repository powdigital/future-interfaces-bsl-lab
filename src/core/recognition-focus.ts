import type { SignDefinition } from "./types.ts";

export interface NumberFocusRange {
  minimum: number;
  maximum: number;
}

export function motionNumbersUnlocked(progress: number): boolean {
  return progress >= 10;
}

export function numberFocusRange(progress: number): NumberFocusRange {
  const block = Math.min(3, Math.max(0, Math.floor(progress / 5)));
  const minimum = block * 5 + 1;
  return { minimum, maximum: minimum + 4 };
}

export function focusedStaticNumbers(signBank: SignDefinition[], progress: number): SignDefinition[] {
  const { minimum, maximum } = numberFocusRange(progress);
  return signBank.filter((sign) => {
    const number = Number(sign.shortLabel);
    return sign.recognitionType === "static"
      && sign.category === "number"
      && number >= minimum
      && number <= maximum;
  });
}
