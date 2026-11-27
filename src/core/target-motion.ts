import type { DigitMetrics, DigitState, HandMetrics, SignDefinition } from "./types.ts";
import type { MotionObservation } from "./motion-engine.ts";

// Each important digit is checked separately, never averaged away by four others.
function confidence(digit: DigitMetrics, state: DigitState) {
  if (state === "ambiguous" || digit.state === state) return 1;
  if (digit.state !== "ambiguous") return 0;
  return state === "extended"
    ? Math.min(1, Math.max(0, (digit.straightness - .72) / .22))
    : Math.min(1, Math.max(0, (.96 - digit.straightness) / .3));
}
function matches(metrics: HandMetrics, pattern: DigitState[]) {
  return pattern.length === 5 && pattern.every((state, index) => confidence(metrics[index], state) >= .6);
}
function isPinch(sign: SignDefinition) {
  return sign.motion?.detector === "index-pinch" || sign.motion?.detector === "dual-pinch";
}
function gap(sign: SignDefinition, observation: MotionObservation) {
  return sign.motion?.detector === "dual-pinch"
    ? Math.max(observation.indexPinchDistance, observation.middlePinchDistance)
    : observation.indexPinchDistance;
}
export function motionStartMatches(sign: SignDefinition, observation: MotionObservation, metrics: HandMetrics) {
  if (!sign.motion || sign.motion.status !== "active") return false;
  if (!matches(metrics, sign.statePattern)) return false;
  if (!isPinch(sign)) return true;
  // Thumb pose is intentionally unrestricted. A spread thumb is required to begin a pinch.
  return observation.indexPinchDistance >= .45
    && (sign.motion.detector !== "dual-pinch" || observation.middlePinchDistance >= .45);
}

export function createTargetMotion(sign: SignDefinition) {
  const config = sign.motion;
  if (!config) throw new Error(`No movement definition for ${sign.id}`);
  let startedAt: number | null = null;
  let lastValidAt = 0;
  let lastFrameAt: number | null = null;
  let anchor: MotionObservation | null = null;
  let extreme = 0;
  let direction = 0;
  let legs = 0;
  let closedAt: number | null = null;
  let closedConfirmed = false;
  let cycles = 0;
  let complete = false;
  function reset() {
    startedAt = lastFrameAt = closedAt = null;
    anchor = null;
    lastValidAt = extreme = direction = legs = cycles = 0;
    closedConfirmed = complete = false;
  }
  function update(observation: MotionObservation, metrics: HandMetrics) {
    const now = observation.timestamp;
    if (lastFrameAt !== null && now - lastFrameAt > config!.dropoutMs) reset();
    lastFrameAt = now;
    if (complete) return { complete: true, progress: 1 };
    const pinch = isPinch(sign);
    // Closing fingers naturally curl; inactive fingers must still retain their shape.
    const pattern = pinch ? sign.statePattern.map((state, index) =>
      index === 0 || index === 1 || (config!.detector === "dual-pinch" && index === 2) ? "ambiguous" : state
    ) as DigitState[] : sign.statePattern;
    if (!matches(metrics, pattern)) {
      if (now - lastValidAt > config!.dropoutMs) reset();
      closedAt = null;
      return { complete: false, progress: 0 };
    }
    lastValidAt = now;
    if (startedAt === null) {
      if (!motionStartMatches(sign, observation, metrics)) return { complete: false, progress: 0 };
      startedAt = now;
      anchor = observation;
      return { complete: false, progress: 0 };
    }
    if (now - startedAt > config!.durationMs.max) {
      reset();
      return { complete: false, progress: 0 };
    }
    if (pinch) {
      const closed = gap(sign, observation) <= (config!.detector === "dual-pinch" ? .4 : .34);
      const open = motionStartMatches(sign, observation, metrics);
      if (closed && !closedConfirmed) {
        if (closedAt === null) closedAt = now;
        if (now - closedAt >= 80) {
          cycles++;
          closedConfirmed = true;
          complete = cycles >= config!.cycleCount && now - startedAt >= config!.durationMs.min;
        }
      } else if (!closed && !closedConfirmed) closedAt = null;
      if (open && closedConfirmed) { closedAt = null; closedConfirmed = false; }
      // A slow final closure still completes without requiring an unnecessary release.
      if (closed && cycles >= config!.cycleCount && now - startedAt >= config!.durationMs.min) complete = true;
      return { complete, progress: Math.min(1, (cycles + (closedAt !== null && !closedConfirmed ? .5 : 0)) / config!.cycleCount) };
    }
    // Fixed starting palm scale avoids apparent movement caused by changing scale.
    const horizontal = config!.detector === "horizontal-wave";
    const signal = ((horizontal ? observation.centerX : observation.centerY)
      - (horizontal ? anchor!.centerX : anchor!.centerY)) / Math.max(anchor!.palmScale, .0001);
    if (direction === 0 && Math.abs(signal) >= config!.amplitude) {
      direction = Math.sign(signal); extreme = signal; legs = 1;
    } else if (direction !== 0) {
      if ((signal - extreme) * direction > 0) extreme = signal;
      else if ((extreme - signal) * direction >= config!.amplitude) {
        direction *= -1; extreme = signal; legs++;
      }
    }
    complete = legs >= config!.cycleCount * 2 && now - startedAt >= config!.durationMs.min;
    return { complete, progress: Math.min(1, legs / (config!.cycleCount * 2)) };
  }
  return { update, reset };
}
