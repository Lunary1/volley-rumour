"use client";

import { useEffect, useState } from "react";
import { useIsClient } from "@/lib/use-is-client";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(targetDate: Date): TimeLeft | null {
  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function CountdownTimer({ launchDate }: { launchDate: string }) {
  const isClient = useIsClient();
  // Only rendered once on the client (see below), so the server's clock never
  // reaches the markup.
  const [timeLeft, setTimeLeft] = useState(() =>
    calculateTimeLeft(new Date(launchDate)),
  );

  useEffect(() => {
    const target = new Date(launchDate);
    const interval = setInterval(() => {
      const tl = calculateTimeLeft(target);
      setTimeLeft(tl);
      if (!tl) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [launchDate]);

  // Countdown finished
  if (isClient && !timeLeft) {
    return (
      <p className="text-2xl font-bold text-primary-text">We zijn live!</p>
    );
  }

  // Before hydration the same boxes show dashes, so nothing moves when the
  // numbers arrive (#229). A changed number rolls in from above (#236).
  const units = [
    { label: "Dagen", value: timeLeft?.days },
    { label: "Uren", value: timeLeft?.hours },
    { label: "Min", value: timeLeft?.minutes },
    { label: "Sec", value: timeLeft?.seconds },
  ];

  return (
    <div
      role="timer"
      aria-label="Tijd tot de lancering"
      className="flex gap-3 sm:gap-4"
    >
      {units.map((unit) => (
        <div
          key={unit.label}
          className="flex flex-col items-center justify-center overflow-hidden rounded-xl bg-card border border-border p-3 sm:p-4 min-w-16 sm:min-w-20 shadow-sm"
        >
          <span
            key={unit.value ?? "--"}
            className="text-2xl sm:text-3xl font-bold tabular-nums text-foreground animate-in slide-in-from-top-full duration-200 motion-reduce:animate-none"
          >
            {isClient && unit.value !== undefined
              ? String(unit.value).padStart(2, "0")
              : "--"}
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground mt-1">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
