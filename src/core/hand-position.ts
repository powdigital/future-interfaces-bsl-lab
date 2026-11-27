import type { Landmark } from "./types.ts";

export type CardinalHandAngle = -90 | 0 | 90 | 180;
export type HandFacing = "front" | "back" | "unknown";

export interface HandPositionReading {
  angle: CardinalHandAngle;
  signedAngle: number;
  confidence: number;
  facing: HandFacing;
  handedness: "left" | "right" | "unknown";
}

export interface PalmFrame {
  wrist: Landmark;
  knuckleCenter: Landmark;
  signedAngle: number;
  angle: CardinalHandAngle;
  roll: number;
  confidence: number;
}

const CARDINAL_ANGLES: CardinalHandAngle[] = [-90, 0, 90, 180];

function circularDistance(a: number, b: number): number {
  const difference = Math.abs(a - b) % 360;
  return Math.min(difference, 360 - difference);
}

function length(vector: { x: number; y: number }): number {
  return Math.hypot(vector.x, vector.y);
}

function normalize(vector: { x: number; y: number }): { x: number; y: number } {
  const magnitude = Math.max(length(vector), 0.000001);
  return { x: vector.x / magnitude, y: vector.y / magnitude };
}

function snapSignedAngle(signedAngle: number): CardinalHandAngle {
  return CARDINAL_ANGLES.reduce((closest, candidate) =>
    circularDistance(signedAngle, candidate) < circularDistance(signedAngle, closest) ? candidate : closest
  );
}

export function getPalmFrame(landmarks: Landmark[]): PalmFrame {
  if (landmarks.length < 18) throw new Error("Palm frame requires wrist and four knuckle landmarks");
  const wrist = landmarks[0];
  const knuckles = [landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
  const knuckleCenter = knuckles.reduce<Landmark>((center, point) => ({
    x: center.x + point.x / knuckles.length,
    y: center.y + point.y / knuckles.length,
    z: (center.z || 0) + (point.z || 0) / knuckles.length
  }), { x: 0, y: 0, z: 0 });
  const longitudinal = normalize({ x: knuckleCenter.x - wrist.x, y: knuckleCenter.y - wrist.y });
  const knuckleLine = normalize({ x: landmarks[5].x - landmarks[17].x, y: landmarks[5].y - landmarks[17].y });
  const perpendicularA = { x: -knuckleLine.y, y: knuckleLine.x };
  const perpendicularB = { x: knuckleLine.y, y: -knuckleLine.x };
  const dotA = perpendicularA.x * longitudinal.x + perpendicularA.y * longitudinal.y;
  const knuckleNormal = dotA >= 0 ? perpendicularA : perpendicularB;
  const combined = normalize({
    x: longitudinal.x * 0.65 + knuckleNormal.x * 0.35,
    y: longitudinal.y * 0.65 + knuckleNormal.y * 0.35
  });
  const signedAngle = Math.atan2(combined.x, -combined.y) * 180 / Math.PI;
  const orthogonality = 1 - Math.abs(longitudinal.x * knuckleLine.x + longitudinal.y * knuckleLine.y);
  const palmWidth = Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
  const axisLength = Math.hypot(knuckleCenter.x - wrist.x, knuckleCenter.y - wrist.y);
  const axisStrength = Math.min(1, axisLength / Math.max(palmWidth * 0.75, 0.000001));
  const confidence = Math.max(0, Math.min(1, orthogonality * 0.65 + axisStrength * 0.35));
  return {
    wrist,
    knuckleCenter,
    signedAngle,
    angle: snapSignedAngle(signedAngle),
    roll: Math.abs(signedAngle),
    confidence
  };
}

export function snapHandAngle(landmarks: Landmark[]): CardinalHandAngle {
  return getPalmFrame(landmarks).angle;
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

export function mirrorSignedHandAngle(angle: number): number {
  const mirrored = -angle;
  if (mirrored > 180) return mirrored - 360;
  if (mirrored <= -180) return 180;
  return Object.is(mirrored, -0) ? 0 : mirrored;
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
  const frame = getPalmFrame(landmarks);
  return {
    angle: frame.angle,
    signedAngle: frame.signedAngle,
    confidence: frame.confidence,
    facing: classifyHandFacing(landmarks, handednessValue),
    handedness: normalizeHandedness(handednessValue)
  };
}
