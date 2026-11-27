import type { Landmark } from "./types.ts";
import type { CameraViewport } from "./spatial-safety.ts";
import { projectBox } from "./camera-calibration.ts";

export type LibraryCategory = "number" | "letter" | "word";
export interface DwellTarget {
  id: LibraryCategory;
  left: number; top: number; right: number; bottom: number;
  enabled: boolean;
}
export interface IndexPointer { id: string; x: number; y: number }
export const INDEX_LABEL_OFFSET = 16;

// Presentation only: the raw dwell clock still decides the exact 500 ms trigger.
export function easeDwellProgress(progress: number): number {
  const t = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Match the displayed I label, including mirrored cover-crop and its text offset.
export function indexLabelPosition(landmarks: Landmark[], viewport: CameraViewport): { x: number; y: number } | null {
  const tip = landmarks[8];
  if (!tip || !Number.isFinite(tip.x) || !Number.isFinite(tip.y)) return null;
  const p = projectBox({ left: tip.x, right: tip.x, top: tip.y, bottom: tip.y }, viewport);
  return { x: p.left * viewport.width, y: p.top * viewport.height - INDEX_LABEL_OFFSET };
}

export const MIN_BUTTON_INTENT_MS = 100;
export const BUTTON_EXIT_GRACE_MS = 500;

export function createLibraryDwell(holdMs = 500, maxFrameGapMs = 200, maxTolerancePx = 24) {
  const duration = Math.max(MIN_BUTTON_INTENT_MS, holdMs);
  type Candidate = {
    target: LibraryCategory; pointer: string; elapsed: number;
    insideSince: number; missingSince: number | null; confirmed: boolean;
    fired: boolean; wasInside: boolean;
  };
  let candidate: Candidate | null = null;
  let lastFrame: number | null = null;
  const empty = () => ({ target: null, progress: 0, triggered: null });
  function reset() { candidate = null; lastFrame = null; }
  function contains(pointer: IndexPointer, target: DwellTarget, padding = 0) {
    return pointer.x >= target.left - padding && pointer.x <= target.right + padding
      && pointer.y >= target.top - padding && pointer.y <= target.bottom + padding;
  }
  function tolerance(target: DwellTarget, targets: DwellTarget[]) {
    let padding = maxTolerancePx;
    for (const other of targets) {
      if (other.id === target.id || !other.enabled) continue;
      const dx = Math.max(0, other.left - target.right, target.left - other.right);
      const dy = Math.max(0, other.top - target.bottom, target.top - other.bottom);
      padding = Math.min(padding, Math.max(dx, dy) / 2);
    }
    return padding;
  }
  function update(now: number, pointers: IndexPointer[], targets: DwellTarget[]) {
    const previousFrame = lastFrame;
    const gap = previousFrame === null ? 0 : now - previousFrame;
    if (gap < 0 || gap >= BUTTON_EXIT_GRACE_MS) candidate = null;
    lastFrame = now;
    const unique = pointers.filter(pointer => pointers.filter(p => p.id === pointer.id).length === 1);
    const delta = gap > maxFrameGapMs ? 0 : Math.max(0, gap);
    let triggered: LibraryCategory | null = null;

    if (candidate) {
      const target = targets.find(t => t.id === candidate!.target && t.enabled);
      const pointer = unique.find(p => p.id === candidate!.pointer);
      const inside = !!target && !!pointer && contains(pointer, target, tolerance(target, targets));
      if (gap > maxFrameGapMs && candidate.missingSince === null) {
        candidate.missingSince = previousFrame;
        candidate.wasInside = false;
      }
      // An absent pointer never completes a sign, even when the progress is nearly full.
      if (!inside) {
        if (candidate.missingSince === null) candidate.missingSince = now;
        candidate.wasInside = false;
        if (!candidate.confirmed || now - candidate.missingSince >= BUTTON_EXIT_GRACE_MS) candidate = null;
      } else if (candidate.missingSince !== null && now - candidate.missingSince >= BUTTON_EXIT_GRACE_MS) {
        candidate = null;
      } else {
        if (!candidate.wasInside) candidate.insideSince = now;
        else candidate.elapsed = Math.min(duration, candidate.elapsed + delta);
        candidate.missingSince = null;
        candidate.wasInside = true;
        if (now - candidate.insideSince >= MIN_BUTTON_INTENT_MS) {
          candidate.confirmed = true;
          if (candidate.elapsed >= duration && !candidate.fired) {
            candidate.fired = true;
            triggered = candidate.target;
          }
        }
      }
    }
    if (!candidate) {
      // A new interaction starts only inside the actual button, not its forgiving halo.
      const hit = unique.flatMap(pointer => targets
        .filter(target => target.enabled && contains(pointer, target))
        .map(target => ({ pointer, target })))[0];
      if (hit) candidate = {
        target: hit.target.id, pointer: hit.pointer.id, elapsed: 0, insideSince: now,
        missingSince: null, confirmed: false, fired: false, wasInside: true
      };
    }
    if (!candidate?.confirmed) return empty();
    return { target: candidate.target, progress: candidate.elapsed / duration, triggered };
  }
  // Locks preserve the selected target without charging time or letting a held
  // finger repeatedly fire. Exit must last the grace period before reacquisition.
  function suspend(now: number) {
    lastFrame = now;
    if (candidate) { candidate.fired = true; candidate.insideSince = now; }
  }
  return { update, reset, suspend };
}
