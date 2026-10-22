"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowLeft, Clock, Loader2, Info } from "lucide-react";
import Link from "next/link";
import { MAX_PENDING_RUMOURS } from "@/lib/rumours";
import { RumourForm } from "@/components/rumour-form";

// Logged-out visitors log in and come back here (#67).
const LOGIN_URL = "/auth/login?next=/geruchten/nieuw";

export default function NewRumourPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  // The database enforces the cap (#54); this only warns before typing.
  const [atPendingLimit, setAtPendingLimit] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push(LOGIN_URL);
        return;
      }

      const [{ data: profile }, { count: pendingCount }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, username")
          .eq("id", authUser.id)
          .single(),
        supabase
          .from("rumours")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", authUser.id)
          .eq("status", "pending"),
      ]);

      setAtPendingLimit((pendingCount ?? 0) >= MAX_PENDING_RUMOURS);
      setUser({ ...authUser, ...profile });
    };
    checkUser();
  }, [router]);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="min-h-screen py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // ── Submitted ──────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h1 className="text-2xl font-bold mb-2">
                Je gerucht wordt nagekeken
              </h1>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Een moderator bekijkt je gerucht voor het op Transfer Talk
                verschijnt. Tot dan zie je het alleen zelf, op je profiel.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/profile">
                  <Button>Naar mijn profiel</Button>
                </Link>
                <Link href="/geruchten">
                  <Button variant="outline">Terug naar Transfer Talk</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/geruchten"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar Transfer Talk
        </Link>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-2xl font-bold">
                Nieuw Gerucht
              </CardTitle>
            </div>
            <CardDescription>
              Deel een transfer of stopzetting met de community. Klopt je tip,
              dan groeit je track record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Help Callout */}
            <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/30 flex gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  💡 Hoe werkt het?
                </p>
                <p>
                  Als een moderator je gerucht bevestigt of ontkracht, telt het
                  mee voor je <strong>track record</strong>: hoeveel van je
                  geruchten bevestigd werden. Vanaf 5 afgeronde geruchten kan je
                  bij de <strong>betrouwbare bronnen</strong> staan.
                </p>
                <p className="mt-2">
                  Een moderator kijkt elk gerucht na voor het online komt.
                </p>
              </div>
            </div>

            <RumourForm
              atPendingLimit={atPendingLimit}
              onCreated={() => setSubmitted(true)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
