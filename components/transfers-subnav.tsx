"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const TRANSFERS_SUBTABS = [
  { href: "/geruchten", label: "Transfer Talk" },
  { href: "/transfers", label: "Confirmed" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function TransfersSubnav() {
  const pathname = usePathname();

  // Only show subnav if we're in a transfers section
  const isInTransfers = TRANSFERS_SUBTABS.some((tab) =>
    pathname.startsWith(tab.href),
  );

  if (!isInTransfers) {
    return null;
  }

  return (
    <div className="border-b border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-2">
          {TRANSFERS_SUBTABS.map((tab) => (
            <Link key={tab.href} href={tab.href}>
              <Button
                variant={pathname.startsWith(tab.href) ? "default" : "ghost"}
                size="sm"
                className={
                  pathname.startsWith(tab.href)
                    ? "bg-primary text-primary-foreground"
                    : ""
                }
              >
                {tab.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
