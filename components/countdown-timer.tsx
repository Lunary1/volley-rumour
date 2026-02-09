"use client";

import { useEffect, useState } from "react";

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
  const target = new Date(launchDate);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(calculateTimeLeft(target));

    const interval = setInterval(() => {
      const tl = calculateTimeLeft(target);
      setTimeLeft(tl);
      if (!tl) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchDate]);

  // SSR / pre-hydration placeholder
  if (!mounted) {
    return (
      <p className="text-lg text-muted-foreground font-medium">
        Binnenkort beschikbaar
      </p>
    );
  }

  // Countdown finished
  if (!timeLeft) {
    return <p className="text-2xl font-bold text-primary">🎉 We zijn live!</p>;
  }

  const units = [
    { label: "Dagen", value: timeLeft.days },
    { label: "Uren", value: timeLeft.hours },
    { label: "Min", value: timeLeft.minutes },
    { label: "Sec", value: timeLeft.seconds },
  ];

  return (
    <div className="flex gap-3 sm:gap-4">
      {units.map((unit) => (
        <div
          key={unit.label}
          className="flex flex-col items-center justify-center rounded-xl bg-card border border-border p-3 sm:p-4 min-w-16 sm:min-w-20 shadow-sm"
        >
          <span className="text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {String(unit.value).padStart(2, "0")}
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground mt-1">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
