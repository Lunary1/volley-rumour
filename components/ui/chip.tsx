import { cva, type VariantProps } from "class-variance-authority";

/**
 * A filter chip, e.g. the zoekertje types (#207). Style a link with it, so
 * filters work before hydration: `<Link className={chipVariants({ active })}>`.
 * The selected chip is filled with the text colour, the others outlined.
 */
export const chipVariants = cva(
  "flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
  {
    variants: {
      active: {
        true: "border-foreground bg-foreground font-semibold text-background",
        false:
          "border-border font-medium text-secondary-foreground hover:border-border-strong hover:text-foreground",
      },
    },
    defaultVariants: { active: false },
  },
);

export type ChipVariants = VariantProps<typeof chipVariants>;
