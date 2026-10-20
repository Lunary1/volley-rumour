import { notFound } from "next/navigation";
import { ClientError } from "./client-error";

// Test-only (#186): lets e2e/error-monitoring.spec.ts cause a real server
// error and a real browser error. Anywhere E2E_ERROR_PROBE isn't "1" (which
// only the e2e server sets, e2e/local-supabase.mjs) this page is a 404.

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ErrorProbePage({
  searchParams,
}: {
  searchParams: Promise<{ soort?: string }>;
}) {
  if (process.env.E2E_ERROR_PROBE !== "1") notFound();
  const { soort } = await searchParams;
  if (soort === "server") throw new Error("E2E-testfout op de server");
  return <ClientError />;
}
