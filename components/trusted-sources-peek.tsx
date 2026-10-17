import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { VerifiedBadge } from "@/components/verified-badge";
import { TRUSTED_SOURCE_MIN_RESOLVED, formatTrackRecord } from "@/lib/rumours";
import type { TrustedSource } from "@/lib/trusted-sources";

// The top three Betrouwbare bronnen on the homepage (#88, D-005).
export function TrustedSourcesPeek({ sources }: { sources: TrustedSource[] }) {
  const top3 = sources.slice(0, 3);

  return (
    <Card className="bg-card/80 border-border backdrop-blur">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Betrouwbare bronnen</h2>
        </div>

        {top3.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Bijdragers met minstens {TRUSTED_SOURCE_MIN_RESOLVED} afgeronde
            geruchten verschijnen hier, de meest accurate eerst.
          </p>
        ) : (
          <ol className="space-y-2">
            {top3.map((source, i) => (
              <li
                key={source.id}
                className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-4 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium">
                    {source.username}
                  </span>
                  {source.is_verified_source && <VerifiedBadge size="sm" />}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {formatTrackRecord(source)}
                </span>
              </li>
            ))}
          </ol>
        )}

        <Link
          href="/betrouwbare-bronnen"
          className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Bekijk alle betrouwbare bronnen
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
