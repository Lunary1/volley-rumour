import { format, formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { RUMOUR_CATEGORY_LABELS } from "@/lib/rumours";
import { ModerationActions } from "./moderation-actions";

// Pending rumours, oldest first (#66). The admin layout already let only
// staff through; RLS shows pending rumours to staff (and their authors) only.
// The author's track record waits for #88 (D-012); the source field for #67.

const PAGE_SIZE = 50;

interface PendingRumour {
  id: string;
  player_name: string;
  category: string;
  from_club_name: string | null;
  to_club_name: string | null;
  description: string | null;
  created_at: string;
  creator: { username: string } | null;
}

export default async function ModerationQueuePage() {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("rumours")
    .select(
      "id, player_name, category, from_club_name, to_club_name, description, created_at, creator:creator_id(username)",
      { count: "exact" },
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(PAGE_SIZE);
  const rumours = (data ?? []) as unknown as PendingRumour[];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Moderatiewachtrij</h2>
        <p className="text-sm text-muted-foreground">
          Nieuwe geruchten, oudste eerst. Pas na goedkeuring zijn ze zichtbaar
          op Transfer Talk. Elke beslissing komt in het logboek.
        </p>
      </div>

      {error ? (
        <p className="text-destructive">De wachtrij kon niet geladen worden.</p>
      ) : rumours.length === 0 ? (
        <p className="text-muted-foreground">Geen geruchten om na te kijken.</p>
      ) : (
        <>
          <p className="text-sm font-medium">
            {count === 1
              ? "1 gerucht wacht op een beslissing."
              : `${count} geruchten wachten op een beslissing.`}
          </p>
          <ul aria-label="Wachtende geruchten" className="space-y-4">
            {rumours.map((rumour) => (
              <li key={rumour.id}>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {RUMOUR_CATEGORY_LABELS[rumour.category] ??
                          rumour.category}
                      </Badge>
                      <span
                        className="text-xs text-muted-foreground"
                        title={format(
                          new Date(rumour.created_at),
                          "d MMM yyyy HH:mm",
                          { locale: nl },
                        )}
                      >
                        Ingediend{" "}
                        {formatDistanceToNow(new Date(rumour.created_at), {
                          addSuffix: true,
                          locale: nl,
                        })}{" "}
                        door{" "}
                        {rumour.creator?.username ?? "een verwijderd account"}
                      </span>
                    </div>
                    <CardTitle className="text-lg">
                      <h3>{rumour.player_name}</h3>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(rumour.from_club_name || rumour.to_club_name) && (
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span>{rumour.from_club_name ?? "Onbekende club"}</span>
                        {rumour.to_club_name && (
                          <>
                            <ArrowRight
                              className="h-4 w-4 text-muted-foreground"
                              aria-label="naar"
                            />
                            <span>{rumour.to_club_name}</span>
                          </>
                        )}
                      </p>
                    )}
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {rumour.description || "Geen beschrijving."}
                    </p>
                    <ModerationActions
                      rumourId={rumour.id}
                      playerName={rumour.player_name}
                    />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          {count !== null && count > PAGE_SIZE && (
            <p className="text-xs text-muted-foreground">
              De oudste {PAGE_SIZE} worden getoond.
            </p>
          )}
        </>
      )}
    </div>
  );
}
