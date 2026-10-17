import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  RUMOUR_CATEGORY_LABELS,
  RUMOUR_DIVISIONS,
  RUMOUR_GENDERS,
  RUMOUR_SOURCE_TYPES,
  formatTrackRecord,
  labelFor,
  type TrackRecord,
} from "@/lib/rumours";
import { ModerationActions } from "./moderation-actions";
import { RelativeTime } from "@/components/relative-time";

// Pending rumours, oldest first (#66). The admin layout already let only
// staff through; RLS shows pending rumours to staff (and their authors) only.
// The author's track record informs the decision, it doesn't make it (D-005,
// #88).

const PAGE_SIZE = 50;

interface PendingRumour {
  id: string;
  player_name: string;
  category: string;
  from_club_name: string | null;
  to_club_name: string | null;
  description: string | null;
  source_type: string | null;
  source_url: string | null;
  declared_good_faith: boolean | null;
  declared_senior: boolean | null;
  gender: string | null;
  from_division: string | null;
  to_division: string | null;
  created_at: string;
  creator: ({ username: string } & TrackRecord) | null;
}

/** "VC Testdorp (Nationale 2 Heren)", or just the club. */
function clubWithDivision(club: string, division: string | null) {
  const label = labelFor(RUMOUR_DIVISIONS, division);
  return label ? `${club} (${label})` : club;
}

export default async function ModerationQueuePage() {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("rumours")
    .select(
      "id, player_name, category, from_club_name, to_club_name, description, source_type, source_url, declared_good_faith, declared_senior, gender, from_division, to_division, created_at, creator:creator_id(username, rumours_confirmed, rumours_denied)",
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
                      <span className="text-xs text-muted-foreground">
                        Ingediend <RelativeTime date={rumour.created_at} /> door{" "}
                        {rumour.creator?.username ?? "een verwijderd account"}
                        {rumour.creator &&
                          ` · ${formatTrackRecord(rumour.creator) ?? "nog geen afgeronde geruchten"}`}
                      </span>
                    </div>
                    <CardTitle className="text-lg">
                      <h3>{rumour.player_name}</h3>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(rumour.from_club_name || rumour.to_club_name) && (
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span>
                          {clubWithDivision(
                            rumour.from_club_name ?? "Onbekende club",
                            rumour.from_division,
                          )}
                        </span>
                        {rumour.to_club_name && (
                          <>
                            <ArrowRight
                              className="h-4 w-4 text-muted-foreground"
                              aria-label="naar"
                            />
                            <span>
                              {clubWithDivision(
                                rumour.to_club_name,
                                rumour.to_division,
                              )}
                            </span>
                          </>
                        )}
                      </p>
                    )}
                    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                      <dt className="text-muted-foreground">Bron</dt>
                      <dd className="min-w-0">
                        {labelFor(RUMOUR_SOURCE_TYPES, rumour.source_type) ??
                          "Geen bron opgegeven"}
                        {rumour.source_url && (
                          <>
                            {" · "}
                            <a
                              href={rumour.source_url}
                              target="_blank"
                              rel="nofollow ugc noopener noreferrer"
                              className="break-all text-primary underline underline-offset-2"
                            >
                              {rumour.source_url}
                            </a>
                          </>
                        )}
                      </dd>
                      {rumour.gender && (
                        <>
                          <dt className="text-muted-foreground">Geslacht</dt>
                          <dd>{labelFor(RUMOUR_GENDERS, rumour.gender)}</dd>
                        </>
                      )}
                      <dt className="text-muted-foreground">Verklaringen</dt>
                      <dd>
                        {rumour.declared_senior && rumour.declared_good_faith
                          ? "Senior en te goeder trouw bevestigd"
                          : "Niet bevestigd (gerucht van voor de verklaringen)"}
                      </dd>
                    </dl>
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
