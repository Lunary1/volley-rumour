import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_RUMOUR_STATUSES, RUMOUR_CATEGORY_LABELS } from "@/lib/rumours";
import { TakedownForm } from "./takedown-form";
import { formatDate } from "@/lib/dates";

// Takedown requests (#68, J-12, D-014). Reached from a rumour's detail view
// (?gerucht=<id>) or from the footer and privacy page, where the visitor
// first looks the rumour up by name. No login needed.

export const metadata: Metadata = {
  title: "Gerucht laten verwijderen - VolleyRumours",
  description:
    "Gaat een gerucht over jou? Vraag de verwijdering aan, zonder account.",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEARCH_LIMIT = 20;

interface PublicRumour {
  id: string;
  player_name: string;
  category: string;
  from_club_name: string | null;
  to_club_name: string | null;
  created_at: string;
}

const RUMOUR_COLUMNS =
  "id, player_name, category, from_club_name, to_club_name, created_at";

function RumourSummary({ rumour }: { rumour: PublicRumour }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {RUMOUR_CATEGORY_LABELS[rumour.category] ?? rumour.category}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Geplaatst op {formatDate(rumour.created_at, "d MMMM yyyy")}
        </span>
      </div>
      <p className="font-semibold">{rumour.player_name}</p>
      {(rumour.from_club_name || rumour.to_club_name) && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {rumour.from_club_name && <span>{rumour.from_club_name}</span>}
          {rumour.from_club_name && rumour.to_club_name && (
            <ArrowRight className="h-3.5 w-3.5" aria-label="naar" />
          )}
          {rumour.to_club_name && <span>{rumour.to_club_name}</span>}
        </p>
      )}
    </div>
  );
}

export default async function TakedownRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ gerucht?: string; q?: string }>;
}) {
  const { gerucht, q } = await searchParams;
  const supabase = await createClient();

  // Only public rumours: RLS would also show a logged-in author their own
  // pending ones, and those can't be the subject of a request.
  let rumour: PublicRumour | null = null;
  if (gerucht && UUID_PATTERN.test(gerucht)) {
    const { data } = await supabase
      .from("rumours")
      .select(RUMOUR_COLUMNS)
      .eq("id", gerucht)
      .in("status", PUBLIC_RUMOUR_STATUSES)
      .maybeSingle();
    rumour = data;
  }

  const query = q?.trim().slice(0, 100) ?? "";
  let results: PublicRumour[] = [];
  if (!rumour && query.length >= 2) {
    const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const { data } = await supabase
      .from("rumours")
      .select(RUMOUR_COLUMNS)
      .in("status", PUBLIC_RUMOUR_STATUSES)
      .ilike("player_name", pattern)
      .order("created_at", { ascending: false })
      .limit(SEARCH_LIMIT);
    results = data ?? [];
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Een gerucht laten verwijderen</h1>
        <p className="text-muted-foreground">
          Gaat een gerucht op VolleyRumours over jou, je kind of iemand die je
          vertegenwoordigt? Vraag hier de verwijdering aan. Je hebt geen account
          nodig. Een moderator bekijkt je verzoek en beslist of het gerucht
          verdwijnt; tot dan blijft het zichtbaar.
        </p>
      </div>

      {rumour ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <h2>Over dit gerucht</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RumourSummary rumour={rumour} />
              <Link
                href="/verwijderverzoek"
                className="text-sm text-primary underline underline-offset-2"
              >
                Een ander gerucht kiezen
              </Link>
            </CardContent>
          </Card>
          <TakedownForm rumourId={rumour.id} />
        </>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              <h2>Over welk gerucht gaat het?</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {gerucht && (
              <p className="text-sm text-destructive">
                Dit gerucht bestaat niet (meer). Zoek het hieronder op.
              </p>
            )}
            <form
              action="/verwijderverzoek"
              method="get"
              role="search"
              className="space-y-2"
            >
              <Label htmlFor="takedown-search">
                Naam van de speler of trainer
              </Label>
              <div className="flex gap-2">
                <Input
                  id="takedown-search"
                  name="q"
                  defaultValue={query}
                  minLength={2}
                  maxLength={100}
                  required
                />
                <Button type="submit">
                  <Search className="h-4 w-4" aria-hidden />
                  Zoeken
                </Button>
              </div>
            </form>

            {query.length >= 2 &&
              (results.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Geen geruchten gevonden over &ldquo;{query}&rdquo;.
                </p>
              ) : (
                <ul aria-label="Gevonden geruchten" className="space-y-2">
                  {results.map((result) => (
                    <li
                      key={result.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <RumourSummary rumour={result} />
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/verwijderverzoek?gerucht=${result.id}`}>
                          Dit gerucht
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
