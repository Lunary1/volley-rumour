import type { ReactNode } from "react";
import { SearchX } from "lucide-react";

/** The body of a "niet gevonden" page (#90): icon, heading, text, links. */
export function NotFoundPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4 py-16">
      <div className="max-w-md text-center">
        <SearchX
          className="mx-auto mb-4 h-12 w-12 text-muted-foreground"
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
