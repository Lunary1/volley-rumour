import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { avatarUrl } from "@/lib/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, Scale, Vote } from "lucide-react";
import { VerifiedBadge } from "@/components/verified-badge";
import { TRUSTED_SOURCE_MIN_RESOLVED, formatTrackRecord } from "@/lib/rumours";
import { accuracy, getTrustedSources } from "@/lib/trusted-sources";

export const metadata = pageMetadata({
  title: "Betrouwbare bronnen",
  description:
    "Bijdragers van wie de meeste geruchten door een moderator bevestigd werden.",
  path: "/betrouwbare-bronnen",
});

// A moderator's decision changes the list at once (#88).
export const dynamic = "force-dynamic";

export default async function TrustedSourcesPage() {
  const sources = await getTrustedSources();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Betrouwbare bronnen
        </h1>
        <p className="text-muted-foreground">
          Bijdragers van wie de meeste geruchten bevestigd werden.
        </p>
      </div>

      <Card className="mb-8 bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-foreground">
            Hoe werkt het?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <span>
              Een moderator bevestigt of ontkracht een gerucht op basis van een
              officiële bron. Je track record telt hoeveel van je afgeronde
              geruchten bevestigd werden.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Scale className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <span>
              Je staat hier vanaf {TRUSTED_SOURCE_MIN_RESOLVED} afgeronde
              geruchten. Geruchten die niet bevestigd raakten, tellen niet mee.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Vote className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <span>
              Stemmen tonen wat de community denkt, maar tellen niet mee voor je
              track record.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Ranglijst</CardTitle>
          <CardDescription>
            Gerangschikt op het aandeel bevestigde geruchten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>
                Nog niemand heeft {TRUSTED_SOURCE_MIN_RESOLVED} afgeronde
                geruchten.
              </p>
              <p className="text-sm mt-2">
                <Link
                  href="/geruchten/nieuw"
                  className="text-primary underline underline-offset-2"
                >
                  Deel een gerucht
                </Link>{" "}
                met een bron en bouw je track record op.
              </p>
            </div>
          ) : (
            <ol aria-label="Betrouwbare bronnen" className="space-y-2">
              {sources.map((source, index) => (
                <li
                  key={source.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-background"
                >
                  <span className="shrink-0 w-6 text-center font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <Avatar>
                    <AvatarImage
                      src={avatarUrl(source.avatar_path) ?? undefined}
                      alt=""
                    />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {source.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate flex items-center gap-1.5">
                      {source.username}
                      {source.is_verified_source && <VerifiedBadge size="sm" />}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatTrackRecord(source)}
                    </p>
                  </div>
                  <p className="font-bold text-foreground">
                    {accuracy(source)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
