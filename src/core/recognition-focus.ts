import type { SignDefinition } from "./types.ts";

export interface NumberFocusRange {
  minimum: number;
  maximum: number;
}

export function numberFocusRange(progress: number): NumberFocusRange {
  return progress >= 5
    ? { minimum: 6, maximum: 10 }
    : { minimum: 1, maximum: 5 };
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
