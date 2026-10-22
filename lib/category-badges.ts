// Badge colours for rumour categories and transfer types (#174), one set for
// both so the cards can't drift apart. Calm colours (#207): player badges get
// the soft green, trainer badges an outline, retirements a neutral fill, so
// they differ by fill and not by hue alone. Every text colour meets WCAG AA
// (4.5:1) against its badge in the light and the dark theme;
// e2e/category-badges.spec.ts measures it.
export const CATEGORY_BADGE_CLASSES = {
  player: "bg-primary-soft text-primary-text border-transparent",
  trainer: "bg-transparent text-secondary-foreground border-border-strong",
  retirement: "bg-muted text-muted-foreground border-transparent",
} as const;
