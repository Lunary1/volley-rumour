// Badge colours for rumour categories and transfer types (#174), one set for
// both so the cards can't drift apart. Every text colour meets WCAG AA
// (4.5:1) against its badge in the light and the dark theme;
// e2e/category-badges.spec.ts measures it. Light mode's --accent is a
// near-white background colour, so the trainer badge uses orange there and
// keeps the orange accent in dark mode.
export const CATEGORY_BADGE_CLASSES = {
  player: "bg-primary/20 text-primary border-primary/30",
  trainer:
    "bg-orange-500/15 text-orange-800 border-orange-300 dark:bg-accent/20 dark:text-accent dark:border-accent/30",
  retirement: "bg-muted text-muted-foreground border-muted",
} as const;
