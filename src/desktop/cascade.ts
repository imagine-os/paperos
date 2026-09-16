export interface Point {
  x: number;
  y: number;
}

export const CASCADE_STEP = 28;
export const CASCADE_TOLERANCE = 8;

/**
 * Returns a position at or near `wanted` that is not (almost) on top of any
 * point in `occupied`. Each collision nudges the position down and to the
 * right by CASCADE_STEP, the classic desktop cascade.
 */
export function cascadePosition(
  occupied: readonly Point[],
  wanted: Point,
  step = CASCADE_STEP,
  tolerance = CASCADE_TOLERANCE
): Point {
  let { x, y } = wanted;
  // Bounded loop: every existing point can force at most one nudge.
  for (let i = 0; i <= occupied.length; i++) {
    const collides = occupied.some(
      (p) => Math.abs(p.x - x) < tolerance && Math.abs(p.y - y) < tolerance
    );
    if (!collides) break;
    x += step;
    y += step;
  }
  return { x, y };
}
