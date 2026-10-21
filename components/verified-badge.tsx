import { ShieldCheck } from "lucide-react";
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

// Rendered on the server with the browser's own tooltip (#200). A Radix
// tooltip put about 50 KB of code in the first load of every page with a
// badge, and never opened on a phone.
export function VerifiedBadge({ size = "sm", className }: VerifiedBadgeProps) {
  return (
    <span
      role="img"
      aria-label="Geverifieerde bron"
      title="Geverifieerde bron: dit account is door VolleyRumours geverifieerd als betrouwbare bron voor transfernieuws"
      className={cn("inline-flex items-center shrink-0", className)}
    >
      <ShieldCheck
        className={cn(sizeClasses[size], "text-primary")}
        aria-hidden
      />
    </span>
  );
}
