import type { Instrumentation } from "next";

// Every unhandled server error (page, route handler, server action, proxy)
// is recorded for /admin/fouten and may email an alert (#186, D-041).
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  _request,
  context,
) => {
  // nodemailer and node:crypto need Node; every route runs on Node here.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { isMonitoringOn, recordError } =
    await import("@/lib/error-monitoring");
  if (!isMonitoringOn()) return;

  const digest =
    typeof error === "object" && error && "digest" in error
      ? String(error.digest)
      : undefined;
  // notFound() and redirect() are control flow, not errors.
  if (digest?.startsWith("NEXT_")) return;

  await recordError({
    source: "server",
    kind: context.routeType,
    // The route pattern, e.g. /verwijderverzoek/[token], never the URL.
    route: context.routePath,
    message: error instanceof Error ? error.message : String(error),
    digest,
  });
};
