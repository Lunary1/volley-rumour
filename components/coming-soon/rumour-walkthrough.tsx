"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle,
  Flame,
  Link2,
  ShieldCheck,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// "Zo werkt Transfer Talk" (#236): the three steps of a rumour beside an
// example card that goes through them, a step every few seconds while it's on
// screen (D-002, D-005, D-020). A click on a step shows it. With reduced
// motion nothing changes by itself. The card names no real person or club.
const STEP_MS = 3600;

const STEPS = [
  {
    icon: Flame,
    title: "Iemand meldt een gerucht",
    description: "Altijd met een bron: wie het zegt en waar het vandaan komt.",
  },
  {
    icon: ShieldCheck,
    title: "Een moderator kijkt het na",
    description:
      "Pas daarna komt het online, en een speler kan het laten verwijderen.",
  },
  {
    icon: BadgeCheck,
    title: "Bevestigd of ontkracht",
    description: "Na de officiële bekendmaking zie je wie het vooraf goed had.",
  },
];

// The card's status per step, with the same labels and variants as real
// rumour cards (lib/rumours.ts).
const STATUS = [
  { label: "Wordt nagekeken", variant: "muted" },
  { label: "Lopend", variant: "warning" },
  { label: "Bevestigd", variant: "success" },
] as const;

function ExampleCard({ stage }: { stage: number }) {
  const status = STATUS[stage];
  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="subtle">Voorbeeld</Badge>
          <Badge
            key={stage}
            variant={status.variant}
            className="animate-in fade-in zoom-in-95 motion-reduce:animate-none"
          >
            {status.label}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-card-title font-semibold">
            Setter maakt de overstap
          </h3>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            Nationale 1 Heren
            <ArrowRight className="size-3.5" aria-hidden />
            Liga Heren
          </p>
        </div>

        {/* One line per step, at one height, so the card never jumps. */}
        <p
          key={stage}
          className="flex h-5 items-center gap-1.5 text-sm text-secondary-foreground animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
        >
          {stage === 0 && (
            <>
              <Link2 className="size-4" aria-hidden />
              Bron: een trainer van de club
            </>
          )}
          {stage === 1 && (
            <>
              <ShieldCheck className="size-4" aria-hidden />
              Nagekeken en online: 64% denkt dat het klopt
            </>
          )}
          {stage === 2 && (
            <>
              <CheckCircle className="size-4 text-primary" aria-hidden />
              Officieel bevestigd door de club
            </>
          )}
        </p>

        <div className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          <User className="size-3.5" aria-hidden />
          <span className="font-medium">volleyfan</span>
          <span className="ml-auto tabular-nums">
            {stage === 2 ? "6 van 7 bevestigd" : "5 van 6 bevestigd"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function RumourWalkthrough() {
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);
  const [inView, setInView] = useState(false);
  // Bumped by a click, so the timer starts over from the chosen step.
  const [restart, setRestart] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setStage((s) => (s + 1) % STEPS.length),
      STEP_MS,
    );
    return () => window.clearInterval(timer);
  }, [inView, restart]);

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2"
    >
      <ol className="flex flex-col gap-2">
        {STEPS.map((step, i) => {
          const active = i === stage;
          return (
            <li key={step.title}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => {
                  setStage(i);
                  setRestart((r) => r + 1);
                }}
                className={cn(
                  "flex w-full gap-4 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-border-strong bg-card"
                    : "border-transparent hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border-strong",
                  )}
                >
                  {i + 1}
                </span>
                <span className="space-y-1">
                  <span className="flex items-center gap-2 font-semibold">
                    <step.icon
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                    {step.title}
                  </span>
                  <span className="block text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex justify-center">
        <ExampleCard stage={stage} />
      </div>
    </div>
  );
}
