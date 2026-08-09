import type { Landmark } from "./types.ts";

export type CardinalHandAngle = -90 | 0 | 90 | 180;
export type HandFacing = "front" | "back" | "unknown";

export interface HandPositionReading {
  angle: CardinalHandAngle;
  facing: HandFacing;
  handedness: "left" | "right" | "unknown";
}

const CARDINAL_ANGLES: CardinalHandAngle[] = [-90, 0, 90, 180];

function circularDistance(a: number, b: number): number {
  const difference = Math.abs(a - b) % 360;
  return Math.min(difference, 360 - difference);
}

export function snapHandAngle(landmarks: Landmark[]): CardinalHandAngle {
  if (landmarks.length < 10) throw new Error("Hand direction requires wrist and middle-finger base landmarks");
  const wrist = landmarks[0];
  const middleBase = landmarks[9];
  const signedAngle = Math.atan2(middleBase.x - wrist.x, wrist.y - middleBase.y) * 180 / Math.PI;
  return CARDINAL_ANGLES.reduce((closest, candidate) =>
    circularDistance(signedAngle, candidate) < circularDistance(signedAngle, closest) ? candidate : closest
  );
}

export function normalizeHandedness(value?: string): HandPositionReading["handedness"] {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "left" || normalized === "right") return normalized;
  return "unknown";
}

export function mirrorCardinalAngle(angle: CardinalHandAngle): CardinalHandAngle {
  if (angle === -90) return 90;
  if (angle === 90) return -90;
  return angle;
}

export function classifyHandFacing(landmarks: Landmark[], handednessValue?: string): HandFacing {
  if (landmarks.length < 18) throw new Error("Hand facing requires wrist, index-base, and pinky-base landmarks");
  const handedness = normalizeHandedness(handednessValue);
  if (handedness === "unknown") return "unknown";

  const wrist = landmarks[0];
  const indexBase = landmarks[5];
  const pinkyBase = landmarks[17];
  const indexVector = { x: indexBase.x - wrist.x, y: indexBase.y - wrist.y };
  const pinkyVector = { x: pinkyBase.x - wrist.x, y: pinkyBase.y - wrist.y };
  const cross = indexVector.x * pinkyVector.y - indexVector.y * pinkyVector.x;
  const palmWidthSquared = Math.max(
    (indexBase.x - pinkyBase.x) ** 2 + (indexBase.y - pinkyBase.y) ** 2,
    0.000001
  );
  const normalizedWinding = cross / palmWidthSquared;
  if (Math.abs(normalizedWinding) < 0.08) return "unknown";

  const isPalm = handedness === "right" ? normalizedWinding < 0 : normalizedWinding > 0;
  return isPalm ? "front" : "back";
}

export function getHandPosition(landmarks: Landmark[], handednessValue?: string): HandPositionReading {
  return {
    angle: snapHandAngle(landmarks),
    facing: classifyHandFacing(landmarks, handednessValue),
    handedness: normalizeHandedness(handednessValue)
  };
}
