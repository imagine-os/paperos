/**
 * Motion preference. Camera animations (tours, boards, focus mode) and CSS
 * transitions are instant when the person asked the OS for reduced motion.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** `ms` normally, 0 under reduced motion. */
export function motionMs(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

/** A tldraw camera animation option: `{duration}` or undefined (instant) under reduced motion. */
export function cameraAnimation(ms: number): { duration: number } | undefined {
  const d = motionMs(ms);
  return d > 0 ? { duration: d } : undefined;
}
