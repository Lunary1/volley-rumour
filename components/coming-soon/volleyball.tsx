"use client";

import { useEffect, useRef, useState } from "react";
import { whenIdle } from "@/lib/supabase/load-client";
import { cn } from "@/lib/utils";

// The coming-soon hero's moving volleyball (#229). The box is in the server
// HTML at its final size, so nothing moves when the ball appears. three.js
// (about 130 KB compressed) waits for the visitor's first scroll, tap, key or
// pointer move, or 4 s after the page has loaded, then for an idle moment:
// loading it while the page was still settling cost 0.4 s of blocking time
// on a mid-range phone. With reduced motion the ball stands still.
const LOAD_DELAY_MS = 4000;
const WAKE_EVENTS = ["pointermove", "pointerdown", "scroll", "keydown"];

function whenSettled(callback: () => void): () => void {
  let cancelIdle = () => {};
  let timer = 0;
  const start = () => {
    cleanup();
    cancelIdle = whenIdle(callback);
  };
  const arm = () => {
    timer = window.setTimeout(start, LOAD_DELAY_MS);
  };
  function cleanup() {
    window.clearTimeout(timer);
    window.removeEventListener("load", arm);
    WAKE_EVENTS.forEach((e) => window.removeEventListener(e, start));
  }
  WAKE_EVENTS.forEach((e) =>
    window.addEventListener(e, start, { once: true, passive: true }),
  );
  if (document.readyState === "complete") arm();
  else window.addEventListener("load", arm, { once: true });
  return () => {
    cleanup();
    cancelIdle();
  };
}
export function Volleyball({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unsupported">(
    "loading",
  );

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    let stopped = false;
    let stop = () => {};
    const cancelIdle = whenSettled(async () => {
      const { startVolleyballScene } = await import("./volleyball-scene");
      if (stopped) return;
      const scene = startVolleyballScene(container, { animate });
      if (!scene) {
        setState("unsupported");
        return;
      }
      stop = scene.stop;
      setState("ready");
    });
    return () => {
      stopped = true;
      cancelIdle();
      stop();
    };
  }, []);

  return (
    <div
      ref={ref}
      data-volleyball={state}
      className={cn(
        "transition-opacity duration-700 motion-reduce:transition-none [&>canvas]:block [&>canvas]:size-full",
        state === "ready" ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
