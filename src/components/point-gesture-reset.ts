import { createPointResetClock, nearbyButtonGroups, POINT_RESET_MS } from "../core/point-reset.ts";

// Mark any future point-control group with data-point-gesture-group and pass its
// element to begin() after success. Nearby groups share the same interaction lock.
export function createPointGestureReset(scope: HTMLElement) {
  const clock = createPointResetClock();
  let locked: HTMLElement[] = [];
  const previousInert = new Map<HTMLElement, boolean>();
  let timer: ReturnType<typeof setTimeout>;
  const mask = document.createElement("div");
  mask.className = "point-reset-mask";
  mask.hidden = true;
  mask.setAttribute("aria-hidden", "true");
  document.body.append(mask);

  function positionMask() {
    if (!locked.length) return;
    const boxes = locked.map(group => group.getBoundingClientRect());
    const left = Math.min(...boxes.map(box => box.left)) - 8;
    const top = Math.min(...boxes.map(box => box.top)) - 8;
    mask.style.left = `${left}px`;
    mask.style.top = `${top}px`;
    mask.style.width = `${Math.max(...boxes.map(box => box.right)) - left + 8}px`;
    mask.style.height = `${Math.max(...boxes.map(box => box.bottom)) - top + 8}px`;
  }
  function finish() {
    for (const group of locked) {
      group.inert = previousInert.get(group) || false;
      group.classList.remove("is-point-resetting");
    }
    locked = [];
    previousInert.clear();
    mask.hidden = true;
    mask.classList.remove("is-resetting");
  }
  function isBlocked(group: HTMLElement, now = performance.now()) {
    return clock.blocked(now) && locked.some(element => element === group || element.contains(group));
  }
  function begin(source: HTMLElement, now = performance.now()) {
    if (isBlocked(source, now)) return false;
    clearTimeout(timer);
    finish();
    const box = source.getBoundingClientRect();
    locked = [...scope.querySelectorAll<HTMLElement>("[data-point-gesture-group]")]
      .filter(group => group === source || nearbyButtonGroups(box, group.getBoundingClientRect()));
    if (!locked.includes(source)) locked.push(source);
    for (const group of locked) {
      previousInert.set(group, group.inert);
      group.inert = true;
      group.classList.add("is-point-resetting");
    }
    clock.start(now);
    positionMask();
    mask.hidden = false;
    void mask.offsetWidth;
    mask.classList.add("is-resetting");
    timer = setTimeout(finish, POINT_RESET_MS);
    return true;
  }
  window.addEventListener("resize", positionMask);
  return { begin, isBlocked, destroy() { clearTimeout(timer); finish(); window.removeEventListener("resize", positionMask); mask.remove(); } };
}
