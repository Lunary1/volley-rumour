import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  RUMOUR_CATEGORY_LABELS,
  RUMOUR_SOURCE_TYPES,
  RUMOUR_STATUS_LABELS,
  labelFor,
} from "@/lib/rumours";
import { cn } from "@/lib/utils";
import { RelativeTime } from "@/components/relative-time";
import { ResolveActions } from "./resolve-actions";
import { ReopenAction } from "./reopen-action";
import { ExpireAll } from "./expire-all";

// Lopende rumours, oldest first, for moderators to resolve (#70, D-020,
// J-14), and denied or expired ones, last decided first, to reopen when the
// decision was wrong (#150). The admin layout already let only staff
// through; resolve_rumour() and reopen_rumour() check again.

const PAGE_SIZE = 50;

interface ListedRumour {
  id: string;
  player_name: string;
  category: string;
  status: string;
  gender: string | null;
  from_club_name: string | null;
  to_club_name: string | null;
  source_type: string | null;
  source_url: string | null;
  votes_true: number | null;
  votes_false: number | null;
  created_at: string;
  resolved_at: string | null;
  resolution_source_url: string | null;
  creator: { username: string } | null;
}

/** "63% van 8 stemmers denkt dat dit klopt", or that nobody voted. */
function belief(votesTrue: number, votesFalse: number) {
  const total = votesTrue + votesFalse;
  if (total === 0) return "Nog geen stemmen";
  const percent = Math.round((votesTrue / total) * 100);
  return `${percent}% van ${total} ${total === 1 ? "stemmer" : "stemmers"} denkt dat dit klopt`;
}

function ListTabs({ closed }: { closed: boolean }) {
  const tabs = [
    { href: "/admin/geruchten", label: "Lopend", active: !closed },
    {
      href: "/admin/geruchten?lijst=afgesloten",
      label: "Afgesloten",
      active: closed,
    },
  ];
  return (
    <nav aria-label="Geruchten" className="flex gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            tab.active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function OpenRumoursPage(props: {
  searchParams: Promise<{ lijst?: string }>;
}) {
  const closed = (await props.searchParams).lijst === "afgesloten";
  const supabase = await createClient();
  const query = supabase
    .from("rumours")
    .select(
      "id, player_name, category, status, gender, from_club_name, to_club_name, source_type, source_url, votes_true, votes_false, created_at, resolved_at, resolution_source_url, creator:creator_id(username)",
      { count: "exact" },
    );
  const { data, error, count } = await (
    closed
      ? query
          .in("status", ["denied", "expired"])
          .order("resolved_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
      : query.eq("status", "rumour").order("created_at", { ascending: true })
  ).limit(PAGE_SIZE);
  const rumours = (data ?? []) as unknown as ListedRumour[];
  const listName = closed ? "Afgesloten geruchten" : "Lopende geruchten";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{listName}</h2>
        <p className="text-sm text-muted-foreground">
          {closed
            ? "Ontkrachte en niet bevestigde geruchten, laatst afgesloten eerst. Was de beslissing fout, heropen het gerucht dan met een reden. Een foute bevestiging maak je ongedaan door de transfer te verwijderen."
            : "Sluit een gerucht af als bevestigd (met een officiële bron, dan komt het bij de transfers), ontkracht of niet bevestigd. Oudste eerst."}{" "}
          Elke beslissing komt in het logboek.
        </p>
      </div>
      <ListTabs closed={closed} />

      {error ? (
        <p className="text-destructive-text">
          {closed
            ? "De afgesloten geruchten konden niet geladen worden."
            : "De lopende geruchten konden niet geladen worden."}
        </p>
      ) : rumours.length === 0 ? (
        <p className="text-muted-foreground">
          {closed ? "Geen afgesloten geruchten." : "Geen lopende geruchten."}
        </p>
      ) : (
        <>
          {!closed && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {count === 1
                  ? "1 gerucht is lopend."
                  : `${count} geruchten zijn lopend.`}
              </p>
              <ExpireAll count={count ?? rumours.length} />
            </div>
          )}
          <ul aria-label={listName} className="space-y-4">
            {rumours.map((rumour) => (
              <li key={rumour.id}>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {RUMOUR_CATEGORY_LABELS[rumour.category] ??
                          rumour.category}
                      </Badge>
                      {closed && (
                        <Badge variant="secondary">
                          {labelFor(RUMOUR_STATUS_LABELS, rumour.status) ??
                            rumour.status}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Gedeeld <RelativeTime date={rumour.created_at} /> door{" "}
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
                      {closed && (
                        <>
                          <dt className="text-muted-foreground">Afgesloten</dt>
                          <dd className="min-w-0">
                            {rumour.resolved_at ? (
                              <RelativeTime date={rumour.resolved_at} />
                            ) : (
                              "Datum onbekend"
                            )}
                            {rumour.resolution_source_url && (
                              <>
                                {" · "}
                                <a
                                  href={rumour.resolution_source_url}
                                  target="_blank"
                                  rel="nofollow noopener noreferrer"
                                  className="break-all text-primary underline underline-offset-2"
                                >
                                  {rumour.resolution_source_url}
                                </a>
                              </>
                            )}
                          </dd>
                        </>
                      )}
                      <dt className="text-muted-foreground">Stemmen</dt>
                      <dd>
                        {belief(
                          rumour.votes_true ?? 0,
                          rumour.votes_false ?? 0,
                        )}
                      </dd>
                    </dl>
                    {closed ? (
                      <ReopenAction
                        rumourId={rumour.id}
                        playerName={rumour.player_name}
                      />
                    ) : (
                      <ResolveActions
                        rumourId={rumour.id}
                        playerName={rumour.player_name}
                        category={rumour.category}
                        gender={rumour.gender}
                      />
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          {count !== null && count > PAGE_SIZE && (
            <p className="text-xs text-muted-foreground">
              {closed
                ? `De laatst afgesloten ${PAGE_SIZE} worden getoond.`
                : `De oudste ${PAGE_SIZE} worden getoond.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
