import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  ROLE_LABELS,
  suspensionEndLabel,
  type StaffUserRow,
} from "@/lib/sanctions";
import { UserActions } from "./user-actions";
import { UserStatusBadges } from "../user-status";

// One user as staff see them (#80): status, reports about them and what
// staff did to them. Admins also get the controls (D-016).

const HISTORY_LIMIT = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const historyLabels: Record<string, string> = {
  user_suspended: "Geschorst",
  user_unsuspended: "Schorsing opgeheven",
  role_changed: "Rol gewijzigd",
  badge_granted: "Badge toegekend",
  badge_revoked: "Badge ingetrokken",
};

interface HistoryEntry {
  id: string;
  actor_id: string;
  action: string;
  reason: string | null;
  details: { until?: string | null; from?: string; to?: string };
  created_at: string;
}

function historyDetail(entry: HistoryEntry) {
  if (entry.action === "user_suspended") {
    return suspensionEndLabel(entry.details.until ?? null);
  }
  if (entry.action === "role_changed" && entry.details.to) {
    return `${ROLE_LABELS[entry.details.from ?? ""] ?? entry.details.from} → ${ROLE_LABELS[entry.details.to] ?? entry.details.to}`;
  }
  return null;
}

export default async function UserPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [userRes, adminRes, historyRes, reportsRes] = await Promise.all([
    supabase.rpc("staff_get_user", { p_user_id: id }),
    supabase.rpc("is_admin"),
    supabase
      .from("staff_actions")
      .select("id, actor_id, action, reason, details, created_at")
      .eq("target_type", "user")
      .eq("target_id", id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase.from("reports").select("status").eq("reported_user_id", id),
  ]);

  const user = (userRes.data as StaffUserRow[] | null)?.[0];
  if (!user) notFound();

  const isAdmin = adminRes.data === true;
  const history = (historyRes.data ?? []) as HistoryEntry[];
  const reports = reportsRes.data ?? [];
  const openReports = reports.filter((r) => r.status === "open").length;

  // actor_id has no foreign key (the log outlives accounts).
  const actorIds = [...new Set(history.map((e) => e.actor_id))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, username").in("id", actorIds)
    : { data: [] };
  const usernames = new Map(
    (actors ?? []).map((a: { id: string; username: string }) => [
      a.id,
      a.username,
    ]),
  );

  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-4">
      <Link
        href="/admin/gebruikers"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
        Alle gebruikers
      </Link>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{user.username}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {user.display_name && <span>{user.display_name}</span>}
          <span>
            Lid sinds{" "}
            {format(new Date(user.created_at), "d MMMM yyyy", { locale: nl })}
          </span>
          <UserStatusBadges user={user} />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            <h3>Status</h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Rol</dt>
            <dd>{ROLE_LABELS[user.role] ?? user.role}</dd>
            <dt className="text-muted-foreground">Geverifieerd</dt>
            <dd>{user.is_verified_source ? "Ja" : "Nee"}</dd>
            <dt className="text-muted-foreground">Schorsing</dt>
            <dd>
              {user.is_suspended
                ? `Geschorst ${suspensionEndLabel(user.suspended_until)}`
                : "Niet geschorst"}
            </dd>
            {user.is_suspended && (
              <>
                <dt className="text-muted-foreground">Reden</dt>
                <dd className="whitespace-pre-line">
                  {user.suspension_reason}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Meldingen</dt>
            <dd>
              {reports.length === 0 ? (
                "Geen"
              ) : (
                <>
                  {reports.length} in totaal, {openReports} open ·{" "}
                  <Link
                    href="/admin/meldingen"
                    className="text-primary underline underline-offset-2"
                  >
                    Naar meldingen
                  </Link>
                </>
              )}
            </dd>
          </dl>

          {isAdmin ? (
            <UserActions user={user} isSelf={me?.id === user.id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Alleen beheerders kunnen schorsen, de badge toekennen en rollen
              wijzigen.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            <h3>Geschiedenis</h3>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen acties voor deze gebruiker.
            </p>
          ) : (
            <ul className="space-y-3 text-sm" aria-label="Geschiedenis">
              {history.map((entry) => {
                const detail = historyDetail(entry);
                return (
                  <li key={entry.id} className="space-y-0.5">
                    <p>
                      <span className="font-medium">
                        {historyLabels[entry.action] ?? entry.action}
                      </span>
                      {detail && <> {detail}</>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), "d MMM yyyy HH:mm", {
                        locale: nl,
                      })}{" "}
                      · door{" "}
                      {usernames.get(entry.actor_id) ?? "Verwijderd account"}
                    </p>
                    {entry.reason && (
                      <p className="whitespace-pre-line text-muted-foreground">
                        {entry.reason}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
