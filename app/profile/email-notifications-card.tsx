"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { setEmailNotifications } from "@/app/actions/profile";
import { handleServerActionResponse } from "@/lib/client-utils";
import { useIsClient } from "@/lib/use-is-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Turns the email notifications on or off (#98, D-025). */
export function EmailNotificationsCard({ enabled }: { enabled: boolean }) {
  const [checked, setChecked] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const isClient = useIsClient();

  function toggle(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      const result = await setEmailNotifications(next);
      handleServerActionResponse(result, {
        successMessage: next
          ? "Je krijgt weer e-mailmeldingen."
          : "Je krijgt geen e-mailmeldingen meer.",
      });
      if (!result.success) setChecked(!next);
    });
  }

  return (
    <Card className="mb-6 border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <Mail className="h-5 w-5 text-muted-foreground" />
          E-mailmeldingen
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Een korte e-mail zonder de inhoud: alleen dat er iets is, met een link
          naar de site.
        </p>
      </CardHeader>
      <CardContent>
        <label className="flex items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={checked}
            disabled={!isClient || pending}
            onChange={(e) => toggle(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span>
            Stuur me een e-mail bij een nieuw bericht en wanneer een moderator
            over mijn gerucht beslist.
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
