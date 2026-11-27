export const POINT_RESET_MS = 500;
export const POINT_RESET_FADE_MS = 350;
export interface ButtonGroupBounds { left: number; top: number; right: number; bottom: number }

export function nearbyButtonGroups(a: ButtonGroupBounds, b: ButtonGroupBounds, radius = 64) {
  const dx = Math.max(0, a.left - b.right, b.left - a.right);
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
  return Math.hypot(dx, dy) <= radius;
}

export function createPointResetClock() {
  let until = -Infinity;
  return {
    start(now: number) { until = now + POINT_RESET_MS; },
    blocked(now: number) { return now < until; },
    overlayOpacity(now: number) {
      const remaining = until - now;
      return .5 * Math.max(0, Math.min(1, remaining / POINT_RESET_FADE_MS));
    }
  };
}
