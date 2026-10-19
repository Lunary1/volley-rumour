import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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

/** "Vorige · Pagina 2 van 5 · Volgende" under a paged list (#85, #96). */
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
      className="flex justify-center items-center gap-2 pt-4"
    >
      <PageLink href={pageUrl(currentPage - 1)} disabled={currentPage === 1}>
        <ChevronLeft className="h-4 w-4 mr-1" />
        Vorige
      </PageLink>
      <div className="px-4 py-2 text-sm text-muted-foreground">
        Pagina {currentPage} van {totalPages}
      </div>
      <PageLink
        href={pageUrl(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        Volgende
        <ChevronRight className="h-4 w-4 ml-1" />
      </PageLink>
    </nav>
  );
}
