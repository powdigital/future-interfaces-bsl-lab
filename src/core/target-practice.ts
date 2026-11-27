// Recognition supplies evidence for ONE sign. This clock never classifies signs.
// Number and letter sequences share this controller and can provide different detectors.
export interface PracticePolicy {
  preparationMs: number;
  staticHoldMs: number;
  staticWindowMs: number;
  motionWindowMs: number;
  maxFrameGapMs: number;
}
export const GENTLE_PRACTICE_POLICY: PracticePolicy = {
  preparationMs: 180, staticHoldMs: 500, staticWindowMs: 2000,
  motionWindowMs: 4000, maxFrameGapMs: 300
};
export interface PracticeTarget {
  id: string;
  kind: "static" | "motion";
  policy?: Partial<PracticePolicy>;
}
export interface PracticeEvidence {
  now: number;
  available: boolean;
  startPose: boolean;
  staticMatch?: boolean;
  motionComplete?: boolean;
  motionProgress?: number;
}
export function createTargetPractice() {
  let target: PracticeTarget | null = null;
  let policy = GENTLE_PRACTICE_POLICY;
  let phase: "preparing" | "performing" | "paused" | "success" | "timeout" = "preparing";
  let previousTime: number | null = null;
  let previousAvailable = false;
  let preparation = 0;
  let held = 0;
  let elapsed = 0;
  let progress = 0;
  const windowMs = () => target?.kind === "motion" ? policy.motionWindowMs : policy.staticWindowMs;
  function snapshot() {
    return { targetId: target?.id ?? null, phase, remainingMs: Math.max(0, windowMs() - elapsed),
      durationMs: windowMs(), progress, preparationProgress: Math.min(1, preparation / policy.preparationMs) };
  }
  function reset(next: PracticeTarget | null = null) {
    target = next;
    policy = { ...GENTLE_PRACTICE_POLICY, ...next?.policy };
    phase = "preparing";
    previousTime = null;
    previousAvailable = false;
    preparation = held = elapsed = progress = 0;
    return snapshot();
  }
  function update(input: PracticeEvidence) {
    if (!target || phase === "success" || phase === "timeout") return snapshot();
    const gap = previousTime === null ? 0 : Math.max(0, input.now - previousTime);
    previousTime = input.now;
    // Never charge for a missing camera frame, background tab or inference stall.
    const interrupted = !input.available || gap > policy.maxFrameGapMs;
    const delta = previousAvailable && !interrupted ? gap : 0;
    previousAvailable = input.available && !interrupted;
    if (interrupted) {
      phase = "paused";
      preparation = held = progress = 0;
      return snapshot();
    }
    if (phase === "paused") phase = "preparing";
    if (phase === "preparing") {
      preparation = input.startPose ? preparation + delta : 0;
      if (preparation >= policy.preparationMs) phase = "performing";
      return snapshot();
    }
    elapsed += delta;
    if (elapsed >= windowMs()) {
      phase = "timeout";
      return snapshot();
    }
    held = input.staticMatch ? held + delta : 0;
    progress = target.kind === "static" ? Math.min(1, held / policy.staticHoldMs) : input.motionProgress || 0;
    if (target.kind === "static" ? held >= policy.staticHoldMs : input.motionComplete) {
      phase = "success";
      progress = 1;
    }
    return snapshot();
  }
  return { reset, update, getState: snapshot };
}
