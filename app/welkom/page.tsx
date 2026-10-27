import { NO_INDEX } from "@/lib/seo";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";
import { WELCOME_PATH } from "@/lib/terms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AcceptTermsForm } from "./accept-terms-form";

export const metadata: Metadata = {
  title: "Welkom",
  robots: NO_INDEX,
};

/**
 * #75 (D-003): the proxy sends every logged-in user who hasn't confirmed 16+
 * and accepted the current terms here. That is every Google sign-up, and
 * every account from before the gate, once.
 */
export default async function WelkomPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(WELCOME_PATH)}`);
  }

  const { data: accepted } = await supabase.rpc("has_accepted_terms");
  if (accepted === true) redirect(next);

  // Someone who accepted an older version is here because the terms changed
  // (#256), not because they're new.
  const { data: earlier } = await supabase
    .from("terms_acceptances")
    .select("terms_version")
    .limit(1);
  const returning = (earlier?.length ?? 0) > 0;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-full max-w-md px-6 py-6 md:px-10 md:py-10">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">
              {returning
                ? "De voorwaarden zijn aangepast"
                : "Welkom bij VolleyRumours"}
            </CardTitle>
            <CardDescription>
              {returning
                ? "Lees de nieuwe versie van de voorwaarden. Bevestig daarna je leeftijd en aanvaard ze om verder te gaan."
                : "Voor je verdergaat: bevestig je leeftijd en aanvaard de voorwaarden. We vragen dit één keer aan iedereen, ook aan wie al een account had."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AcceptTermsForm next={next} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
