import { signal } from "../signal";

/** Bumped by `paperos.preview.reload()`; every Preview window rebuilds. */
export const previewReload = signal(0);

export function reloadPreviews(): void {
  previewReload.update((n) => n + 1);
}
