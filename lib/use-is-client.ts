"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server rendering and hydration, true afterwards. Use it to
 * render client-only values (current time, theme) without a hydration
 * mismatch, instead of a `mounted` state set in an effect.
 */
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
