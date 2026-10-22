import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shown where a list has nothing to show yet (#211): what's missing, why, and
 * optionally what to do about it (`children`, e.g. a Button).
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon
          className="mx-auto mb-4 size-12 text-muted-foreground"
          aria-hidden
        />
      )}
      <p className="mb-2 text-lg font-semibold">{title}</p>
      {description && (
        <p className="mx-auto max-w-md text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-6 flex justify-center">{children}</div>}
    </div>
  );
}

export { EmptyState };
