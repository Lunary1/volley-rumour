import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const initialsVariants = cva(
  "flex shrink-0 items-center justify-center rounded-full font-bold text-secondary-foreground",
  {
    variants: {
      size: {
        sm: "h-7 w-7 bg-muted text-xs",
        md: "h-8.5 w-8.5 border border-feature-border bg-card text-xs",
      },
    },
    defaultVariants: { size: "sm" },
  },
);

/** "VC Bergvliet" → "VB", "test_club" → "TC". */
export function initialsOf(name: string): string {
  return name
    .split(/[\s_\-·]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/**
 * A round badge with someone's initials, for places without a profile
 * picture. Decorative: the name is always written next to it. Rendered on
 * the server, unlike the Radix Avatar.
 */
export function Initials({
  name,
  size,
  className,
}: { name: string; className?: string } & VariantProps<
  typeof initialsVariants
>) {
  return (
    <span aria-hidden className={cn(initialsVariants({ size }), className)}>
      {initialsOf(name)}
    </span>
  );
}
