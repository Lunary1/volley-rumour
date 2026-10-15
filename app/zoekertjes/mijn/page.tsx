import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { ArrowLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  CLASSIFIED_TYPE_LABELS,
  getDivisionLabel,
  getProvinceLabel,
} from "@/lib/classifieds-utils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MyClassifiedActions } from "@/components/my-classified-actions";

export const metadata: Metadata = { title: "Mijn zoekertjes" };

type Status = "online" | "found" | "removed";

const STATUS_LABELS: Record<Status, string> = {
  online: "Online",
  found: "Gevonden",
  removed: "Verwijderd door een moderator",
};

const STATUS_CLASSES: Record<Status, string> = {
  online:
    "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400",
  found: "border-border bg-muted text-muted-foreground",
  removed: "border-destructive/30 bg-destructive/10 text-destructive",
};

/** Every zoekertje of the user, with its status and what they can do (#72). */
export default async function MyClassifiedsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/zoekertjes/mijn");

  // RLS shows the author their own ads, including removed ones (#69).
  const { data: ads, error } = await supabase
    .from("classifieds")
    .select(
      "id, title, type, division, province, is_active, removed_at, removal_note, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) console.error("Error fetching my classifieds:", error);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link
        href="/profile"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Terug naar profiel
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Mijn zoekertjes
          </h1>
          <p className="text-sm text-muted-foreground">
            Pas je zoekertjes aan, markeer ze als gevonden of verwijder ze.
          </p>
        </div>
        <Button asChild>
          <Link href="/zoekertjes/nieuw">
            <Plus className="h-4 w-4" aria-hidden />
            Nieuw zoekertje
          </Link>
        </Button>
      </div>

      {!ads?.length ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          Je hebt nog geen zoekertjes geplaatst.
        </p>
      ) : (
        <ul className="space-y-3">
          {ads.map((ad) => {
            const status: Status = ad.removed_at
              ? "removed"
              : ad.is_active
                ? "online"
                : "found";
            const details = [
              CLASSIFIED_TYPE_LABELS[ad.type] ?? ad.type,
              ad.division && getDivisionLabel(ad.division),
              ad.province && getProvinceLabel(ad.province),
            ].filter(Boolean);

            return (
              <li
                key={ad.id}
                data-testid="my-classified"
                className="rounded-lg border border-border bg-card p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {status === "removed" ? (
                      <h2 className="font-semibold text-foreground break-words">
                        {ad.title}
                      </h2>
                    ) : (
                      <h2 className="font-semibold text-foreground break-words">
                        <Link
                          href={`/zoekertjes/${ad.id}`}
                          className="hover:underline"
                        >
                          {ad.title}
                        </Link>
                      </h2>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {details.join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Geplaatst op{" "}
                      {format(new Date(ad.created_at), "d MMMM yyyy", {
                        locale: nl,
                      })}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0", STATUS_CLASSES[status])}
                  >
                    {STATUS_LABELS[status]}
                  </Badge>
                </div>

                {status === "found" && (
                  <p className="text-sm text-muted-foreground">
                    Staat niet meer in de lijst. Je gesprekken erover blijven
                    bewaard.
                  </p>
                )}
                {/* Neutral on purpose, as on the profile (Takedown Process). */}
                {status === "removed" && (
                  <p className="text-sm text-muted-foreground">
                    Een moderator heeft dit zoekertje van de site gehaald.
                    {ad.removal_note && ` ${ad.removal_note}`}
                  </p>
                )}

                <MyClassifiedActions
                  id={ad.id}
                  title={ad.title}
                  isActive={!!ad.is_active}
                  isRemoved={status === "removed"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
