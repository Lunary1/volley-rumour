import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { notificationEmail } from "@/lib/notifications";

// Error monitoring (#186, D-041): production errors go to the error_events
// table, one row per distinct error, and the alerts mailbox gets an email when
// the database says one is due (a new error, or one back after a quiet hour).
// No third-party service (D-023). Nothing here may throw: reporting an error
// must never cause another.

export type ErrorKind = "render" | "route" | "action" | "proxy" | "client";

interface ErrorReport {
  source: "server" | "client";
  kind: ErrorKind;
  /** A route pattern or a cleaned-up path, never a full URL. */
  route: string;
  message: string;
  digest?: string;
}

const ALERT_EMAIL = process.env.ERROR_ALERT_EMAIL ?? "info@volleyrumours.be";

const kindLabels: Record<ErrorKind, string> = {
  render: "pagina",
  route: "API-route",
  action: "serveractie",
  proxy: "proxy",
  client: "browser",
};

/** Only production builds report, so a dev server's mistakes stay local. */
export function isMonitoringOn() {
  return process.env.NODE_ENV === "production";
}

// Ids, numbers and tokens in a message would make every occurrence a new
// error, so they don't count towards the fingerprint.
function normaliseMessage(message: string) {
  return message
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "<id>",
    )
    .replace(/[A-Za-z0-9_-]{24,}/g, "<token>")
    .replace(/\d+/g, "<n>");
}

function fingerprint({ source, kind, route, message }: ErrorReport) {
  return createHash("sha256")
    .update([source, kind, route, normaliseMessage(message)].join("\n"))
    .digest("hex");
}

/**
 * A browser path reduced to what is safe to keep: the first segment as it is,
 * deeper segments only when they look like a fixed route name, so status
 * tokens, ids and usernames aren't stored.
 */
export function cleanPath(path: string) {
  const segments = path.split(/[?#]/)[0].split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  return (
    "/" +
    segments
      .slice(0, 5)
      .map((segment, i) =>
        i === 0 || /^[a-z-]{1,20}$/.test(segment) ? segment : "[…]",
      )
      .join("/")
  ).slice(0, 200);
}

/** Records an error and emails the alerts mailbox if an alert is due. */
export async function recordError(report: ErrorReport) {
  try {
    const { data: alert, error } = await createAdminClient().rpc(
      "record_error_event",
      {
        p_fingerprint: fingerprint(report),
        p_source: report.source,
        p_kind: report.kind,
        p_route: report.route.slice(0, 200),
        p_message: (report.message || "(geen melding)").slice(0, 500),
        p_digest: report.digest?.slice(0, 100) ?? null,
      },
    );
    if (error) throw error;
    if (!alert) return;
    // Content-free like the other notifications: where and what kind, not
    // the message. The message is on /admin/fouten.
    await sendEmail(
      notificationEmail(
        ALERT_EMAIL,
        "Fout op VolleyRumours",
        `Er ging iets mis op ${report.route} (${kindLabels[report.kind]}). Dit is de eerste keer, of de eerste keer na een uur zonder deze fout.`,
        { label: "Bekijk de fouten", path: "/admin/fouten" },
        {
          text: "Je krijgt deze e-mail omdat dit adres de foutmeldingen van VolleyRumours ontvangt.",
        },
      ),
    );
  } catch (error) {
    console.error("Error not recorded:", error);
  }
}
