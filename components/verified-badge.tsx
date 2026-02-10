"use client";

import { ShieldCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  /** Render a larger badge (e.g. profile page header) */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function VerifiedBadge({ size = "sm", className }: VerifiedBadgeProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn("inline-flex items-center shrink-0", className)}
            aria-label="Geverifieerde bron"
          >
            <ShieldCheck className={cn(sizeClasses[size], "text-primary")} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-center">
          <p className="font-semibold">Geverifieerde Bron</p>
          <p className="text-[11px] opacity-90">
            Dit account is door VolleyRumours geverifieerd als betrouwbare bron
            voor transfernieuws
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
