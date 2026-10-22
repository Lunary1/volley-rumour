import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A page-filling message: icon, heading, text and buttons. The body of the
 * "niet gevonden" pages (#90) and the error page.
 */
export function MessagePanel({
  icon: Icon,
  iconClassName,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  /** The icon's colour, e.g. text-destructive-text; muted by default. */
  iconClassName?: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4 py-16">
      <div className="max-w-md text-center">
        <Icon
          className={cn(
            "mx-auto mb-4 h-12 w-12 text-muted-foreground",
            iconClassName,
          )}
          aria-hidden="true"
        />
        <h1 className="mb-3 text-2xl font-bold text-foreground">{title}</h1>
        <p className="mb-6 text-muted-foreground">{description}</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {children}
        </div>
      </div>
    </div>
  );
}
