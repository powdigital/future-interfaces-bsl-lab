import type { Landmark } from "./types.ts";

export type MotionPhase = "waiting" | "ready" | "closing" | "cooldown";

export interface MotionObservation {
  timestamp: number;
  pinchDistance: number;
  centerX: number;
  centerY: number;
  palmScale: number;
}

export interface MotionResult {
  phase: MotionPhase;
  progress: number;
  detected: boolean;
  signId: "bsl-number-11" | null;
  pinchDistance: number | null;
}

export interface PinchCycleConfig {
  openThreshold: number;
  closedThreshold: number;
  minDurationMs: number;
  maxDurationMs: number;
  cooldownMs: number;
  stableOpenFrames: number;
  maxCenterDrift: number;
}

const DEFAULT_CONFIG: PinchCycleConfig = {
  openThreshold: 0.45,
  closedThreshold: 0.32,
  minDurationMs: 120,
  maxDurationMs: 1800,
  cooldownMs: 650,
  stableOpenFrames: 2,
  maxCenterDrift: 1
};

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

export function motionObservationFromLandmarks(landmarks: Landmark[], timestamp: number): MotionObservation {
  if (landmarks.length < 21) throw new Error("A complete hand requires 21 landmarks");
  const palmWidth = Math.max(distance(landmarks[5], landmarks[17]), 0.0001);
  const palmPoints = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
  const center = palmPoints.reduce((sum, point) => ({
    x: sum.x + point.x / palmPoints.length,
    y: sum.y + point.y / palmPoints.length
  }), { x: 0, y: 0 });
  return {
    timestamp,
    pinchDistance: distance(landmarks[4], landmarks[8]) / palmWidth,
    centerX: center.x,
    centerY: center.y,
    palmScale: palmWidth
  };
}

export function createPinchCycleRecognizer(overrides: Partial<PinchCycleConfig> = {}) {
  const config = { ...DEFAULT_CONFIG, ...overrides };
  let phase: MotionPhase = "waiting";
  let openFrames = 0;
  let startedAt = 0;
  let cooldownStartedAt = 0;
  let startCenter = { x: 0, y: 0 };

  function reset(nextPhase: MotionPhase = "waiting") {
    phase = nextPhase;
    openFrames = 0;
    startedAt = 0;
    startCenter = { x: 0, y: 0 };
  }

  function result(observation: MotionObservation | null, detected = false): MotionResult {
    const progress = phase === "ready" ? 0.2
      : phase === "closing" ? 0.5
        : phase === "cooldown" ? 1
          : 0;
    return {
      phase,
      progress,
      detected,
      signId: detected ? "bsl-number-11" : null,
      pinchDistance: observation?.pinchDistance ?? null
    };
  }

  function update(observation: MotionObservation): MotionResult {
    const isOpen = observation.pinchDistance >= config.openThreshold;
    const isClosed = observation.pinchDistance <= config.closedThreshold;

    if (phase === "cooldown") {
      if (observation.timestamp - cooldownStartedAt >= config.cooldownMs && isOpen) reset("ready");
      return result(observation);
    }

    if (phase === "waiting") {
      openFrames = isOpen ? openFrames + 1 : 0;
      if (openFrames >= config.stableOpenFrames) phase = "ready";
      return result(observation);
    }

    if (phase === "ready") {
      if (!isOpen) {
        phase = "closing";
        startedAt = observation.timestamp;
        startCenter = { x: observation.centerX, y: observation.centerY };
      }
      return result(observation);
    }

    const elapsed = observation.timestamp - startedAt;
    const centerDrift = Math.hypot(observation.centerX - startCenter.x, observation.centerY - startCenter.y)
      / Math.max(observation.palmScale, 0.0001);
    if (elapsed > config.maxDurationMs || centerDrift > config.maxCenterDrift) {
      reset();
      return result(observation);
    }

    if (phase === "closing") {
      if (isClosed && elapsed >= config.minDurationMs) {
        phase = "cooldown";
        cooldownStartedAt = observation.timestamp;
        return result(observation, true);
      }
      if (isOpen) reset("ready");
    }

    return result(observation);
  }

  return {
    update,
    updateLandmarks(landmarks: Landmark[], timestamp: number) {
      return update(motionObservationFromLandmarks(landmarks, timestamp));
    },
    handLost() {
      reset();
      return result(null);
    },
    reset() {
      reset();
      return result(null);
    },
    getPhase() {
      return phase;
    }
  };
}
