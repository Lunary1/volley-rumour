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
//
// Since #236 the ball is a keep-up game: tap or click it, or focus it and
// press Space or Enter. The line under it counts the run; the visitor's record
// stays in their own browser.
const LOAD_DELAY_MS = 4000;
const RECORD_KEY = "vr-hooghouden-record";

function readRecord(): number {
  try {
    return Number(window.localStorage.getItem(RECORD_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveRecord(record: number) {
  try {
    window.localStorage.setItem(RECORD_KEY, String(record));
  } catch {
    // Private window or blocked storage: the record lasts this visit.
  }
}

interface Score {
  run: number;
  record: number;
  /** The hits of the run that just ended, or null before the first drop. */
  last: number | null;
  newRecord: boolean;
}

function scoreLine({ run, record, last, newRecord }: Score): string {
  const best = record > 0 ? ` · record ${record}` : "";
  if (run > 0) return `${run} keer hoog${best}`;
  if (last === null) return "Hou de bal hoog: tik erop";
  if (newRecord) return `Nieuw record: ${record} keer hoog`;
  return `${last} keer hoog gehouden${best}`;
}
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
  const hitRef = useRef<() => void>(() => {});
  const [state, setState] = useState<"loading" | "ready" | "unsupported">(
    "loading",
  );
  const [playable, setPlayable] = useState(false);
  // Only shown once the ball is playable, so the server's 0 never renders.
  const [score, setScore] = useState<Score>(() => ({
    run: 0,
    record: typeof window === "undefined" ? 0 : readRecord(),
    last: null,
    newRecord: false,
  }));

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
      const scene = startVolleyballScene(container, {
        animate,
        onHit: (run) => setScore((s) => ({ ...s, run })),
        onDrop: (run) =>
          setScore((s) => {
            const newRecord = run > s.record;
            if (newRecord) saveRecord(run);
            return {
              run: 0,
              record: Math.max(run, s.record),
              last: run,
              newRecord,
            };
          }),
      });
      if (!scene) {
        setState("unsupported");
        return;
      }
      stop = scene.stop;
      hitRef.current = scene.hit;
      setPlayable(animate);
      setState("ready");
    });
    return () => {
      stopped = true;
      cancelIdle();
      stop();
    };
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        ref={ref}
        data-volleyball={state}
        role={playable ? "button" : undefined}
        tabIndex={playable ? 0 : undefined}
        aria-label={playable ? "Bal hooghouden" : undefined}
        aria-describedby={playable ? "hooghouden-score" : undefined}
        onKeyDown={(event) => {
          if (!playable || (event.key !== " " && event.key !== "Enter")) {
            return;
          }
          event.preventDefault();
          hitRef.current();
        }}
        className={cn(
          "aspect-square w-full rounded-full outline-none transition-opacity duration-700 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none [&>canvas]:block [&>canvas]:size-full",
          state === "ready" ? "opacity-100" : "opacity-0",
        )}
      />
      {/* Always in the HTML at one line's height, so nothing moves. */}
      <p
        id="hooghouden-score"
        aria-live="polite"
        data-testid="hooghouden-score"
        className="h-5 text-meta text-muted-foreground tabular-nums"
      >
        {playable && scoreLine(score)}
      </p>
    </div>
  );
}
