/**
 * Zoom bands for culling canvas decoration: below `FAR` arrows and their
 * labels are hidden (windows already show placeholders there), below `MID`
 * only the labels go. The bands have a little hysteresis so a zoom that
 * hovers around a threshold does not flicker.
 */
export type ZoomBand = "near" | "mid" | "far";

export const ZOOM_FAR = 0.1;
export const ZOOM_MID = 0.3;
const HYSTERESIS = 1.25;

export function zoomBand(zoom: number, current: ZoomBand = "near"): ZoomBand {
  // Leaving a band needs the zoom to go a bit past the threshold.
  const farOut = current === "far" ? ZOOM_FAR * HYSTERESIS : ZOOM_FAR;
  const midOut = current === "mid" ? ZOOM_MID * HYSTERESIS : ZOOM_MID;
  if (zoom < farOut) return "far";
  if (zoom < midOut) return "mid";
  return "near";
}
