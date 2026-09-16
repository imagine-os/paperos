"use client";

import { useSyncExternalStore } from "react";
import type { Signal } from "./signal";

/** Subscribes a component to a Signal. */
export function useSignal<T>(s: Signal<T>): T {
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}
