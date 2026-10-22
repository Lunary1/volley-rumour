import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A page button: a link, so paging works before hydration and can be shared. */
export function PageLink({
  href,
  disabled,
  label,
  className,
  children,
}: {
  href: string;
  disabled: boolean;
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        aria-label={label}
        className={className}
      >
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm" className={className}>
      <Link href={href} aria-label={label}>
        {children}
      </Link>
    </Button>
  );
}

/** The page numbers around the current page, with the first and last. */
function pageNumbers(currentPage: number, totalPages: number) {
  const numbers: (number | "gap")[] = [];
  for (let page = 1; page <= totalPages; page++) {
    const near = Math.abs(page - currentPage) <= 1;
    if (page === 1 || page === totalPages || near) numbers.push(page);
    else if (numbers.at(-1) !== "gap") numbers.push("gap");
  }
  return numbers;
}

/**
 * "Vorige · 1 2 3 … 9 · Volgende" under a paged list (#85, #96). The current
 * page is filled, the others outlined (#207); a phone shows only the current
 * one.
 */
export function PageNav({
  currentPage,
  totalPages,
  pageUrl,
}: {
  currentPage: number;
  totalPages: number;
  pageUrl: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Paginering"
      className="flex justify-center items-center gap-1.5 pt-4"
    >
      <PageLink
        href={pageUrl(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-10"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Vorige
      </PageLink>
      <span className="sr-only">
        Pagina {currentPage} van {totalPages}
      </span>
      {pageNumbers(currentPage, totalPages).map((page, index) =>
        page === "gap" ? (
          <span
            key={`gap-${index}`}
            aria-hidden
            className="hidden sm:block px-1 text-sm text-muted-foreground"
          >
            …
          </span>
        ) : page === currentPage ? (
          <span
            key={page}
            aria-current="page"
            className={buttonVariants({ variant: "inverted", size: "icon-lg" })}
          >
            {page}
          </span>
        ) : (
          <Link
            key={page}
            href={pageUrl(page)}
            aria-label={`Pagina ${page}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-lg" }),
              "hidden sm:inline-flex",
            )}
          >
            {page}
          </Link>
        ),
      )}
      <PageLink
        href={pageUrl(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="h-10"
      >
        Volgende
        <ChevronRight className="h-4 w-4 ml-1" />
      </PageLink>
    </nav>
  );
}
