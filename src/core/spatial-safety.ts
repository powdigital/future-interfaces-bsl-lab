import type { Landmark } from "./types.ts";

export type DistanceGuidance = "move-back" | "move-closer" | null;

export interface CameraViewport {
  width: number;
  height: number;
  videoBounds: { x: number; y: number; width: number; height: number };
}

export const DEFAULT_FRAMING_THRESHOLDS = {
  tooFar: 0.06,
  tooClose: 0.24,
  edgeMargin: 0.2,
  maxHandExtent: 0.5
};

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

export function palmSpan(landmarks: Landmark[]): number {
  if (landmarks.length < 18) return 0;
  return distance(landmarks[5], landmarks[17]);
}

export function getDistanceGuidance(
  hands: Landmark[][],
  overrides: Partial<typeof DEFAULT_FRAMING_THRESHOLDS> = {},
  viewport?: CameraViewport
): DistanceGuidance {
  if (!hands.length) return null;
  const thresholds = { ...DEFAULT_FRAMING_THRESHOLDS, ...overrides };
  // Match the actual cover-cropped camera area, not the full camera source.
  // The rail is outside this viewport. Mirroring does not change edge distance.
  const visibleHands = hands.map((hand) => hand.map((point) => ({
    x: viewport ? (viewport.videoBounds.x + point.x * viewport.videoBounds.width) / viewport.width : point.x,
    y: viewport ? (viewport.videoBounds.y + point.y * viewport.videoBounds.height) / viewport.height : point.y,
    z: 0
  })));
  const nearEdge = visibleHands.some((hand) => hand.some((point) =>
    point.x <= thresholds.edgeMargin || point.x >= 1 - thresholds.edgeMargin
    || point.y <= thresholds.edgeMargin || point.y >= 1 - thresholds.edgeMargin
  ));
  // Includes the wrist, fingertips and knuckles, even if a clipped fingertip
  // has become too unreliable to classify as extended.
  const tooMuchFrame = visibleHands.some((hand) => {
    const xs = hand.map((point) => point.x);
    const ys = hand.map((point) => point.y);
    return Math.max(...xs) - Math.min(...xs) > thresholds.maxHandExtent
      || Math.max(...ys) - Math.min(...ys) > thresholds.maxHandExtent;
  });
  if (nearEdge || tooMuchFrame) return "move-back";
  const largestVisiblePalm = Math.max(...visibleHands.map(palmSpan));
  if (largestVisiblePalm > thresholds.tooClose) return "move-back";
  if (largestVisiblePalm < thresholds.tooFar) return "move-closer";
  return null;
}

export interface FaceRegion {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function faceRegionFromEyes(face: Landmark[]): FaceRegion | null {
  if (face.length <= 263) return null;
  const leftEye = face[33];
  const rightEye = face[263];
  const eyeDistance = distance(leftEye, rightEye);
  if (eyeDistance < 0.015) return null;
  const centerX = (leftEye.x + rightEye.x) / 2;
  const centerY = (leftEye.y + rightEye.y) / 2;
  return {
    left: centerX - eyeDistance * 0.9,
    right: centerX + eyeDistance * 0.9,
    top: centerY - eyeDistance * 0.8,
    bottom: centerY + eyeDistance * 1.45
  };
}

export function handOverlapsFace(hand: Landmark[], face: Landmark[]): boolean {
  if (hand.length < 18) return false;
  const region = faceRegionFromEyes(face);
  if (!region) return false;
  const palmPoints = [hand[0], hand[5], hand[9], hand[13], hand[17]];
  const center = palmPoints.reduce((point, landmark) => ({
    x: point.x + landmark.x / palmPoints.length,
    y: point.y + landmark.y / palmPoints.length
  }), { x: 0, y: 0 });
  return center.x >= region.left && center.x <= region.right
    && center.y >= region.top && center.y <= region.bottom;
}
