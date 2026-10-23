import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A panel of rows, like a departure board (#240): the homepage's transfer
 * board, confirmed transfers and newest zoekertjes. A heading, a ruled list
 * and an optional link to the full list below it.
 */
function Ledger({
  title,
  description,
  href,
  linkLabel = "Bekijk alle",
  headingLevel: Heading = "h2",
  className,
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  /** h3 when the Ledger sits under a section heading. */
  headingLevel?: "h2" | "h3";
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = React.useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <Heading
          id={headingId}
          className="text-lg font-semibold tracking-tight"
        >
          {title}
        </Heading>
        {description && (
          <p className="text-meta text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
      {href && (
        <Link
          href={href}
          className="flex h-11 items-center justify-center gap-1.5 border-t border-border text-sm font-medium text-primary-text outline-none hover:bg-accent focus-visible:bg-accent"
        >
          {linkLabel}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </section>
  );
}

/** The ruled list inside a Ledger. */
function LedgerList({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol className={cn("divide-y divide-border", className)} {...props} />;
}

/**
 * One row. With `href` the whole row is the link. Rows have a fixed height
 * (`h-17`), so a skeleton of the same number of rows has the same size (#211).
 */
function LedgerRow({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const row = "flex h-17 items-center gap-3 px-4 sm:px-5";
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={cn(
            row,
            "outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
            className,
          )}
        >
          {children}
        </Link>
      ) : (
        <div className={cn(row, className)}>{children}</div>
      )}
    </li>
  );
}

/** A placeholder row while a Ledger's data streams in. */
function LedgerRowSkeleton({ className }: { className?: string }) {
  return (
    <li
      className={cn("flex h-17 items-center gap-3 px-4 sm:px-5", className)}
      aria-hidden
    >
      <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
      <div className="h-5 w-16 animate-pulse rounded-md bg-muted" />
    </li>
  );
}

/**
 * A thin bar for a share (0–100), e.g. how many voters believe a rumour. The
 * number is always written next to it; the bar only repeats it.
 */
function ShareBar({ value, className }: { value: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block h-1 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <span
        className="block h-full rounded-full bg-primary"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </span>
  );
}

export { Ledger, LedgerList, LedgerRow, LedgerRowSkeleton, ShareBar };
