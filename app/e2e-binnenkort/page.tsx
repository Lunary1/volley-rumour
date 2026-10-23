import { notFound } from "next/navigation";
import { ComingSoonPage } from "@/components/coming-soon-page";

// Test-only (#229): renders the coming-soon homepage for
// e2e/coming-soon.spec.ts. NEXT_PUBLIC_COMING_SOON is fixed at build time and
// the e2e build has it off, so the real homepage can't show it. Anywhere
// E2E_COMING_SOON_PROBE isn't "1" (which only the e2e server sets,
// e2e/local-supabase.mjs) this page is a 404.

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default function ComingSoonProbePage() {
  if (process.env.E2E_COMING_SOON_PROBE !== "1") notFound();
  return <ComingSoonPage />;
}
