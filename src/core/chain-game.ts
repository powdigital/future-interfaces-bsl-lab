export interface ChainGameConfig {
  firstNumber: number;
  lastNumber: number;
  milestoneSize: number;
}

export interface ChainGameState {
  progress: number;
  checkpoint: number;
  expected: number;
  complete: boolean;
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
  milestoneSize: 5
};

function sequence(from: number, to: number): number[] {
  if (to < from) return [];
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function checkpointFor(progress: number, config: ChainGameConfig): number {
  if (progress < config.firstNumber) return config.firstNumber - 1;
  return Math.floor(progress / config.milestoneSize) * config.milestoneSize;
}

function stateFor(progress: number, config: ChainGameConfig): ChainGameState {
  const complete = progress >= config.lastNumber;
  return {
    progress,
    checkpoint: checkpointFor(progress, config),
    expected: complete ? config.firstNumber : progress + 1,
    complete
  };
}

export function createChainGame(overrides: Partial<ChainGameConfig> = {}) {
  const config = { ...DEFAULT_CHAIN_GAME_CONFIG, ...overrides };
  let progress = config.firstNumber - 1;

  function submit(received: number): ChainGameResult {
    if (progress >= config.lastNumber) {
      if (received === config.firstNumber) {
        progress = config.firstNumber;
        return { type: "accepted", state: stateFor(progress, config), milestone: null };
      }
      progress = config.firstNumber - 1;
      return {
        type: "failed",
        state: stateFor(progress, config),
        received,
        expected: config.firstNumber,
        resetNumbers: sequence(config.firstNumber, config.lastNumber)
      };
    }

    const expected = progress + 1;
    if (received === expected) {
      progress = received;
      const isMilestone = progress % config.milestoneSize === 0;
      const milestone = isMilestone
        ? sequence(progress - config.milestoneSize + 1, progress)
        : null;
      return { type: "accepted", state: stateFor(progress, config), milestone };
    }

    const previousProgress = progress;
    const checkpoint = checkpointFor(previousProgress, config);
    progress = checkpoint;
    return {
      type: "failed",
      state: stateFor(progress, config),
      received,
      expected,
      resetNumbers: sequence(checkpoint + 1, Math.min(previousProgress, config.lastNumber))
    };
  }

  return {
    submit,
    reset() {
      progress = config.firstNumber - 1;
      return stateFor(progress, config);
    },
    getState() {
      return stateFor(progress, config);
    }
  };
}
