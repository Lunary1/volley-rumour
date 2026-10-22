import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A page section's heading, with an optional line below it and a link to
 * the full list (#211).
 */
function SectionHeader({
  title,
  description,
  href,
  linkLabel = "Bekijk alle",
  className,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-muted-foreground">{description}</p>
        )}
      </div>
      {href && (
        <Button
          asChild
          variant="more"
          className="shrink-0 self-start sm:self-auto"
        >
          <Link href={href}>
            {linkLabel}
            <ArrowRight />
          </Link>
        </Button>
      )}
    </div>
  );
}

export { SectionHeader };
