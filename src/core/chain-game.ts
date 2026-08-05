export interface ChainGameConfig {
  firstNumber: number;
  lastNumber: number;
  milestoneSize: number;
  mode: "ordered" | "free";
}

export interface ChainGameState {
  progress: number;
  checkpoint: number;
  expected: number;
  complete: boolean;
  recognizedNumbers: number[];
}

export type ChainGameResult =
  | {
      type: "accepted";
      state: ChainGameState;
      milestone: number[] | null;
    }
  | {
      type: "failed";
      state: ChainGameState;
      received: number;
      expected: number;
      resetNumbers: number[];
    };

export const DEFAULT_CHAIN_GAME_CONFIG: ChainGameConfig = {
  firstNumber: 1,
  lastNumber: 10,
  milestoneSize: 5,
  mode: "ordered"
};

function sequence(from: number, to: number): number[] {
  if (to < from) return [];
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function checkpointFor(progress: number, config: ChainGameConfig): number {
  if (progress < config.firstNumber) return config.firstNumber - 1;
  return Math.floor(progress / config.milestoneSize) * config.milestoneSize;
}

function stateFor(progress: number, config: ChainGameConfig, recognizedNumbers: number[]): ChainGameState {
  const complete = progress >= config.lastNumber;
  return {
    progress,
    checkpoint: checkpointFor(progress, config),
    expected: complete ? config.firstNumber : progress + 1,
    complete,
    recognizedNumbers: [...recognizedNumbers]
  };
}

export function createChainGame(overrides: Partial<ChainGameConfig> = {}) {
  const config = { ...DEFAULT_CHAIN_GAME_CONFIG, ...overrides };
  let progress = config.firstNumber - 1;
  let recognizedNumbers: number[] = [];

  function submit(received: number): ChainGameResult {
    if (config.mode === "free") {
      if (progress >= config.lastNumber) {
        progress = config.firstNumber - 1;
        recognizedNumbers = [];
      }
      progress += 1;
      recognizedNumbers.push(received);
      const milestone = progress % config.milestoneSize === 0
        ? recognizedNumbers.slice(-config.milestoneSize)
        : null;
      return { type: "accepted", state: stateFor(progress, config, recognizedNumbers), milestone };
    }

    if (progress >= config.lastNumber) {
      if (received === config.firstNumber) {
        progress = config.firstNumber;
        recognizedNumbers = [received];
        return { type: "accepted", state: stateFor(progress, config, recognizedNumbers), milestone: null };
      }
      progress = config.firstNumber - 1;
      recognizedNumbers = [];
      return {
        type: "failed",
        state: stateFor(progress, config, recognizedNumbers),
        received,
        expected: config.firstNumber,
        resetNumbers: sequence(config.firstNumber, config.lastNumber)
      };
    }

    const expected = progress + 1;
    if (received === expected) {
      progress = received;
      recognizedNumbers = sequence(config.firstNumber, progress);
      const isMilestone = progress % config.milestoneSize === 0;
      const milestone = isMilestone
        ? sequence(progress - config.milestoneSize + 1, progress)
        : null;
      return { type: "accepted", state: stateFor(progress, config, recognizedNumbers), milestone };
    }

    const previousProgress = progress;
    const checkpoint = checkpointFor(previousProgress, config);
    progress = checkpoint;
    recognizedNumbers = sequence(config.firstNumber, progress);
    return {
      type: "failed",
      state: stateFor(progress, config, recognizedNumbers),
      received,
      expected,
      resetNumbers: sequence(checkpoint + 1, Math.min(previousProgress, config.lastNumber))
    };
  }

  return {
    submit,
    reset() {
      progress = config.firstNumber - 1;
      recognizedNumbers = [];
      return stateFor(progress, config, recognizedNumbers);
    },
    getState() {
      return stateFor(progress, config, recognizedNumbers);
    }
  };
}
