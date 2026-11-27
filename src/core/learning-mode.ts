import type { HandMetrics } from "./types.ts";

export interface LearningModeState {
  active: boolean;
  checkpoint: number;
  expected: number | null;
  completed: number[];
}

export function isLearningCheckpoint(progress: number, lastNumber = 20, blockSize = 5): boolean {
  return progress > 0 && progress < lastNumber && progress % blockSize === 0;
}

export function isTwoThumbsUp(hands: HandMetrics[]): boolean {
  return hands.length === 2 && hands.every((hand) =>
    hand[0]?.state === "extended" && hand.slice(1).every((digit) => digit.state === "folded")
  );
}

export function createLearningMode(lastNumber = 20, blockSize = 5) {
  let state: LearningModeState = { active: false, checkpoint: 0, expected: null, completed: [] };

  function start(progress: number): LearningModeState {
    if (!isLearningCheckpoint(progress, lastNumber, blockSize)) return { ...state, completed: [...state.completed] };
    state = { active: true, checkpoint: progress, expected: progress + 1, completed: [] };
    return { ...state, completed: [] };
  }

  function submit(number: number): { accepted: boolean; finished: boolean; state: LearningModeState } {
    if (!state.active || number !== state.expected) {
      return { accepted: false, finished: false, state: { ...state, completed: [...state.completed] } };
    }
    const completed = [...state.completed, number];
    const finished = completed.length === blockSize || number >= lastNumber;
    state = finished
      ? { active: false, checkpoint: state.checkpoint, expected: null, completed }
      : { ...state, expected: number + 1, completed };
    return { accepted: true, finished, state: { ...state, completed: [...completed] } };
  }

  function reset(): LearningModeState {
    state = { active: false, checkpoint: 0, expected: null, completed: [] };
    return { ...state, completed: [] };
  }

  return { start, submit, reset, getState: () => ({ ...state, completed: [...state.completed] }) };
}
