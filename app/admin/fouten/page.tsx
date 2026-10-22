import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import type { ErrorKind } from "@/lib/error-monitoring";

// Production errors (#186, D-041). The admin layout already let only staff
// through; RLS on error_events checks again.

export const metadata = { title: "Fouten" };

const PAGE_SIZE = 100;

const kindLabels: Record<ErrorKind, string> = {
  render: "Pagina",
  route: "API-route",
  action: "Serveractie",
  proxy: "Proxy",
  client: "Browser",
};

interface ErrorEvent {
  id: string;
  kind: ErrorKind;
  route: string;
  message: string;
  digest: string | null;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export default async function ErrorsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("error_events")
    .select(
      "id, kind, route, message, digest, count, first_seen_at, last_seen_at",
    )
    .order("last_seen_at", { ascending: false })
    .limit(PAGE_SIZE);
  const events = (data ?? []) as ErrorEvent[];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Fouten</h2>
        <p className="text-sm text-muted-foreground">
          Fouten op de site, gegroepeerd per fout, de laatste eerst. Bij een
          nieuwe fout krijgt info@volleyrumours.be een e-mail. Een fout
          verdwijnt 90 dagen nadat ze voor het laatst voorkwam.
        </p>
      </div>

      {error ? (
        <p className="text-destructive-text">
          De fouten konden niet geladen worden.
        </p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">Geen fouten. Mooi zo.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Laatst
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Waar
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Melding
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Aantal
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Eerst
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t align-top">
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(event.last_seen_at, "d MMM yyyy HH:mm")}
                  </td>
                  <td className="px-3 py-2">
                    <code className="break-all">{event.route}</code>
                    <div className="text-xs text-muted-foreground">
                      {kindLabels[event.kind]}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="break-words">{event.message}</span>
                    {event.digest && (
                      <div className="text-xs text-muted-foreground">
                        Digest: <code>{event.digest}</code>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {event.count}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(event.first_seen_at, "d MMM yyyy HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
