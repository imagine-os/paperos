import { signal } from "./signal";

/** Whether the command palette is showing. Toggled by Ctrl+K and the top bar. */
export const paletteOpen = signal(false);

export function togglePalette(open = !paletteOpen.get()): void {
  paletteOpen.set(open);
}
