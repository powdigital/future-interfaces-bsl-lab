export interface ChainTimerConfig {
  standardMs: number;
  checkpointBonusMs: number;
  milestoneSize: number;
  lastNumber: number;
}

export const DEFAULT_CHAIN_TIMER_CONFIG: ChainTimerConfig = {
  standardMs: 2000,
  checkpointBonusMs: 2000,
  milestoneSize: 5,
  lastNumber: 20
};

export function turnDurationMs(
  progress: number,
  overrides: Partial<ChainTimerConfig> = {}
): number | null {
  const config = { ...DEFAULT_CHAIN_TIMER_CONFIG, ...overrides };
  if (progress < 1 || progress >= config.lastNumber) return null;
  const checkpointReached = progress % config.milestoneSize === 0;
  return config.standardMs + (checkpointReached ? config.checkpointBonusMs : 0);
}

export function countdownProgress(startedAt: number, durationMs: number, now: number): number {
  if (durationMs <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - (now - startedAt) / durationMs));
}
