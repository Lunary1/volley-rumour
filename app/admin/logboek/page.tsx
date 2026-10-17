import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";

// The admin layout already let only staff through; RLS on staff_actions
// checks again (#64).

const PAGE_SIZE = 100;

const actionLabels: Record<string, string> = {
  rumour_approved: "Gerucht goedgekeurd",
  rumour_rejected: "Gerucht afgewezen",
  rumour_resolved: "Gerucht afgesloten",
  content_removed: "Inhoud verwijderd",
  takedown_rejected: "Verwijderverzoek afgewezen",
  report_dismissed: "Melding afgesloten zonder actie",
  report_action_taken: "Maatregel na melding",
  conversation_viewed: "Gemeld gesprek gelezen",
  user_suspended: "Gebruiker geschorst",
  user_unsuspended: "Schorsing opgeheven",
  role_changed: "Rol gewijzigd",
  badge_granted: "Badge toegekend",
  badge_revoked: "Badge ingetrokken",
  contact_handled: "Contactbericht afgehandeld",
  transfer_created: "Transfer toegevoegd",
  transfer_updated: "Transfer aangepast",
  transfer_deleted: "Transfer verwijderd",
};

const targetLabels: Record<string, string> = {
  rumour: "Gerucht",
  classified: "Zoekertje",
  conversation: "Gesprek",
  message: "Bericht",
  user: "Gebruiker",
  takedown_request: "Verwijderverzoek",
  contact_message: "Contactbericht",
  transfer: "Transfer",
};

interface StaffAction {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  created_at: string;
}

export default async function AuditLogPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_actions")
    .select("id, actor_id, action, target_type, target_id, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  const entries = (data ?? []) as StaffAction[];

  // actor_id and target_id have no foreign key (the log outlives accounts),
  // so usernames are looked up separately: actors, and users acted on (#80).
  const actorIds = [
    ...new Set(
      entries.flatMap((e) =>
        e.target_type === "user" ? [e.actor_id, e.target_id] : [e.actor_id],
      ),
    ),
  ];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, username").in("id", actorIds)
    : { data: [] };
  const usernames = new Map(
    (actors ?? []).map((a: { id: string; username: string }) => [
      a.id,
      a.username,
    ]),
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Logboek</h2>
        <p className="text-sm text-muted-foreground">
          Elke moderatieactie, wie ze deed en waarom. Items kunnen niet
          gewijzigd worden en blijven 2 jaar bewaard.
        </p>
      </div>

      {error ? (
        <p className="text-destructive">Het logboek kon niet geladen worden.</p>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground">Nog geen acties gelogd.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Wanneer
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Wie
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Actie
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Doel
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Reden
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t align-top">
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(entry.created_at, "d MMM yyyy HH:mm")}
                  </td>
                  <td className="px-3 py-2">
                    {usernames.get(entry.actor_id) ?? "Verwijderd account"}
                  </td>
                  <td className="px-3 py-2">
                    {actionLabels[entry.action] ?? entry.action}
                  </td>
                  <td className="px-3 py-2">
                    {targetLabels[entry.target_type] ?? entry.target_type}{" "}
                    {entry.target_type === "user" ? (
                      <Link
                        href={`/admin/gebruikers/${entry.target_id}`}
                        className="text-primary underline underline-offset-2"
                      >
                        {usernames.get(entry.target_id) ?? "Verwijderd account"}
                      </Link>
                    ) : (
                      <code className="text-xs text-muted-foreground">
                        {entry.target_id.slice(0, 8)}
                      </code>
                    )}
                  </td>
                  <td className="px-3 py-2">{entry.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {entries.length === PAGE_SIZE && (
        <p className="text-xs text-muted-foreground">
          De laatste {PAGE_SIZE} acties worden getoond.
        </p>
      )}
    </div>
  );
}
