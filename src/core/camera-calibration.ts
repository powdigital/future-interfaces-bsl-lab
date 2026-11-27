import type { Landmark } from "./types.ts";
import type { CameraViewport } from "./spatial-safety.ts";

export interface FramingBox { left: number; top: number; right: number; bottom: number }
export const CALIBRATION_TARGETS = {
  left: { left: 0.08, top: 0.28, right: 0.31, bottom: 0.72 },
  head: { left: 0.38, top: 0.15, right: 0.62, bottom: 0.65 },
  right: { left: 0.69, top: 0.28, right: 0.92, bottom: 0.72 }
} satisfies Record<string, FramingBox>;
export const CALIBRATION_HOLD_MS = 1500;
export const MIN_CALIBRATION_LUMINANCE = 35;

export function landmarkBounds(points: Landmark[]): FramingBox | null {
  if (!points.length || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
  return {
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    bottom: Math.max(...points.map((point) => point.y))
  };
}

// Face features supply an axis-aligned approximation, with forehead/hair padding.
// This is a framing aid, not a head pose or body measurement.
export function approximateHeadBounds(face: Landmark[]): FramingBox | null {
  if (face.length < 455) return null;
  const eyeSpan = Math.hypot(face[33].x - face[263].x, face[33].y - face[263].y);
  const bounds = landmarkBounds(face);
  if (!bounds || eyeSpan < 0.015) return null;
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  if (width <= 0 || height <= 0) return null;
  return { left: bounds.left - width * 0.08, right: bounds.right + width * 0.08,
    top: bounds.top - height * 0.22, bottom: bounds.bottom + height * 0.06 };
}

export function projectBox(box: FramingBox, viewport: CameraViewport): FramingBox {
  const b = viewport.videoBounds;
  return {
    left: 1 - (b.x + box.right * b.width) / viewport.width,
    right: 1 - (b.x + box.left * b.width) / viewport.width,
    top: (b.y + box.top * b.height) / viewport.height,
    bottom: (b.y + box.bottom * b.height) / viewport.height
  };
}

export function meanLuminance(
  rgba: ArrayLike<number>, width: number, height: number,
  region: FramingBox = { left: 0, top: 0, right: 1, bottom: 1 }
): number {
  const x0 = Math.max(0, Math.floor(region.left * width));
  const x1 = Math.min(width, Math.ceil(region.right * width));
  const y0 = Math.max(0, Math.floor(region.top * height));
  const y1 = Math.min(height, Math.ceil(region.bottom * height));
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4;
    sum += rgba[i] * 0.2126 + rgba[i + 1] * 0.7152 + rgba[i + 2] * 0.0722;
    count++;
  }
  return count ? sum / count : 0;
}

function inside(box: FramingBox, target: FramingBox): boolean {
  return box.left >= target.left && box.right <= target.right
    && box.top >= target.top && box.bottom <= target.bottom;
}

function guidance(box: FramingBox, target: FramingBox, label: string, minWidth: number, minHeight: number): string | null {
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  if (width > target.right - target.left || height > target.bottom - target.top) return "Move back";
  if (width < minWidth || height < minHeight) return "Move forward";
  if (box.top < target.top) return `${label}: move down`;
  if (box.bottom > target.bottom) return `${label}: move up`;
  if (box.left < target.left) return `${label}: move right`;
  if (box.right > target.right) return `${label}: move left`;
  return null;
}

export function evaluateCameraCalibration(input: {
  head: FramingBox | null; hands: FramingBox[]; luminance: number; faceTrackerReady: boolean;
}) {
  const { head, luminance, faceTrackerReady } = input;
  const hands = [...input.hands].sort((a, b) => (a.left + a.right) - (b.left + b.right));
  const headMessage = head ? guidance(head, CALIBRATION_TARGETS.head, "Head", 0.09, 0.16) : "Place your head in the centre box";
  const leftMessage = hands[0] ? guidance(hands[0], CALIBRATION_TARGETS.left, "Left box hand", 0.045, 0.12) : "Place one hand in each side box";
  const rightMessage = hands[1] ? guidance(hands[1], CALIBRATION_TARGETS.right, "Right box hand", 0.045, 0.12) : "Place one hand in each side box";
  const lightingLow = !Number.isFinite(luminance) || luminance < MIN_CALIBRATION_LUMINANCE;
  const ready = !lightingLow && faceTrackerReady && !!head && hands.length === 2
    && !headMessage && !leftMessage && !rightMessage;
  return {
    ready, lightingLow,
    headReady: !lightingLow && !!head && !headMessage,
    leftReady: !lightingLow && !!hands[0] && inside(hands[0], CALIBRATION_TARGETS.left) && !leftMessage,
    rightReady: !lightingLow && !!hands[1] && inside(hands[1], CALIBRATION_TARGETS.right) && !rightMessage,
    message: lightingLow ? "Lighting too low" : !faceTrackerReady ? "Head tracker unavailable. Reload to retry"
      : headMessage || (hands.length !== 2 ? "Place one hand in each side box" : leftMessage || rightMessage) || "Hold still to calibrate"
  };
}

export function createCalibrationHold(holdMs = CALIBRATION_HOLD_MS) {
  let startedAt: number | null = null;
  return {
    reset() { startedAt = null; },
    update(ready: boolean, now: number) {
      if (!ready) startedAt = null;
      else if (startedAt === null) startedAt = now;
      const progress = startedAt === null ? 0 : Math.max(0, Math.min(1, (now - startedAt) / holdMs));
      return { progress, complete: ready && progress === 1 };
    }
  };
}

export function createHeadBoxTracker(intervalMs = 500) {
  let lastUpdate = -Infinity;
  let box: FramingBox | null = null;
  return {
    update(next: FramingBox | null, now: number) {
      if (now - lastUpdate >= intervalMs) { lastUpdate = now; box = next ? { ...next } : null; }
      return box;
    }
  };
}
