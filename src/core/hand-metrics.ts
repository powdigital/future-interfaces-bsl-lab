import type { DigitMetrics, DigitState, HandMetrics, HandOrientationMetrics, Landmark } from "./types.ts";
import { getPalmFrame } from "./hand-position.ts";

export const DIGIT_STATE = {
  EXTENDED: "extended",
  FOLDED: "folded",
  AMBIGUOUS: "ambiguous"
} as const satisfies Record<string, DigitState>;

const EXTENDED_MIN_ANGLE = 144;

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function jointAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const lengths = Math.hypot(ab.x, ab.y, ab.z) * Math.hypot(cb.x, cb.y, cb.z);
  return Math.acos(Math.max(-1, Math.min(1, dot / Math.max(lengths, 0.0001)))) * 180 / Math.PI;
}

function stateForFinger(angle1: number, angle2: number, straightness: number, reach: number): DigitState {
  if (angle1 >= EXTENDED_MIN_ANGLE && angle2 >= EXTENDED_MIN_ANGLE && straightness >= 0.8 && reach >= 1.05) {
    return DIGIT_STATE.EXTENDED;
  }
  if (angle1 <= 125 && (angle2 <= 135 || reach <= 0.98) && straightness <= 0.9) {
    return DIGIT_STATE.FOLDED;
  }
  return DIGIT_STATE.AMBIGUOUS;
}

function fingerMetrics(landmarks: Landmark[], mcp: number, pip: number, dip: number, tip: number): DigitMetrics {
  const pathLength = distance(landmarks[mcp], landmarks[pip])
    + distance(landmarks[pip], landmarks[dip])
    + distance(landmarks[dip], landmarks[tip]);
  const straightness = distance(landmarks[mcp], landmarks[tip]) / Math.max(pathLength, 0.0001);
  const angle1 = jointAngle(landmarks[mcp], landmarks[pip], landmarks[dip]);
  const angle2 = jointAngle(landmarks[pip], landmarks[dip], landmarks[tip]);
  const reach = distance(landmarks[tip], landmarks[0]) / Math.max(distance(landmarks[pip], landmarks[0]), 0.0001);
  return { state: stateForFinger(angle1, angle2, straightness, reach), angle1, angle2, straightness, reach };
}

function thumbMetrics(landmarks: Landmark[]): DigitMetrics {
  const [wrist, thumbCmc, thumbMcp, thumbIp, thumbTip, indexBase] = landmarks;
  const pinkyBase = landmarks[17];
  const palmWidth = distance(indexBase, pinkyBase);
  const palmPoints = [wrist, indexBase, landmarks[9], landmarks[13], pinkyBase];
  const palmCenter = palmPoints.reduce<Required<Landmark>>((center, point) => ({
    x: center.x + point.x / palmPoints.length,
    y: center.y + point.y / palmPoints.length,
    z: center.z + (point.z || 0) / palmPoints.length
  }), { x: 0, y: 0, z: 0 });
  const pathLength = distance(thumbCmc, thumbMcp) + distance(thumbMcp, thumbIp) + distance(thumbIp, thumbTip);
  const straightness = distance(thumbCmc, thumbTip) / Math.max(pathLength, 0.0001);
  const axis = {
    x: (indexBase.x - pinkyBase.x) / Math.max(palmWidth, 0.0001),
    y: (indexBase.y - pinkyBase.y) / Math.max(palmWidth, 0.0001),
    z: ((indexBase.z || 0) - (pinkyBase.z || 0)) / Math.max(palmWidth, 0.0001)
  };
  const lateralProjection = (thumbTip.x - indexBase.x) * axis.x
    + (thumbTip.y - indexBase.y) * axis.y
    + ((thumbTip.z || 0) - (indexBase.z || 0)) * axis.z;
  const angle1 = jointAngle(thumbCmc, thumbMcp, thumbIp);
  const angle2 = jointAngle(thumbMcp, thumbIp, thumbTip);
  const reach = lateralProjection / Math.max(palmWidth, 0.0001);
  const palmDistance = distance(thumbTip, palmCenter);
  let state: DigitState = DIGIT_STATE.AMBIGUOUS;
  if (angle1 >= EXTENDED_MIN_ANGLE && angle2 >= EXTENDED_MIN_ANGLE && straightness >= 0.8 && reach > 0.1 && palmDistance > palmWidth * 0.75) {
    state = DIGIT_STATE.EXTENDED;
  } else if (lateralProjection <= palmWidth * 0.1 && (palmDistance < palmWidth * 0.62 || angle1 <= 125 || angle2 <= 125)) {
    state = DIGIT_STATE.FOLDED;
  }
  return { state, angle1, angle2, straightness, reach };
}

export function getHandMetrics(landmarks: Landmark[]): HandMetrics {
  if (landmarks.length < 21) throw new Error("A complete MediaPipe hand requires 21 landmarks");
  return [
    thumbMetrics(landmarks),
    fingerMetrics(landmarks, 5, 6, 7, 8),
    fingerMetrics(landmarks, 9, 10, 11, 12),
    fingerMetrics(landmarks, 13, 14, 15, 16),
    fingerMetrics(landmarks, 17, 18, 19, 20)
  ];
}

export function getHandOrientation(landmarks: Landmark[]): HandOrientationMetrics {
  const frame = getPalmFrame(landmarks);
  return {
    roll: frame.roll,
    signedAngle: frame.signedAngle,
    cardinalAngle: frame.angle,
    confidence: frame.confidence
  };
}
