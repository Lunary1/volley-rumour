"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  requestTakedown,
  type TakedownRequestInput,
} from "@/app/actions/takedown";
import {
  TAKEDOWN_EMAIL_MAX_LENGTH,
  TAKEDOWN_EXPLANATION_MAX_LENGTH,
  TAKEDOWN_EXPLANATION_MIN_LENGTH,
  TAKEDOWN_NAME_MAX_LENGTH,
  TAKEDOWN_RELATIONS,
  type TakedownRelation,
} from "@/lib/takedown";
import { useIsClient } from "@/lib/use-is-client";

const relations = Object.entries(TAKEDOWN_RELATIONS) as [
  TakedownRelation,
  string,
][];

/** The request form; after sending, the reference and status link. */
export function TakedownForm({ rumourId }: { rumourId: string }) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  // Until hydration, a click would make the browser submit the form itself,
  // as a GET with the requester's name, email and explanation in the URL.
  const hydrated = useIsClient();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{
    reference: string;
    statusUrl: string;
  } | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const response = await requestTakedown({
        rumourId,
        relation: String(form.get("relation") ?? ""),
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        explanation: String(form.get("explanation") ?? ""),
        goodFaith: form.get("goodFaith") === "on",
        website: String(form.get("website") ?? ""),
      } as TakedownRequestInput);
      if (!response.success) {
        setError(response.error);
        return;
      }
      setSent({
        reference: response.data.reference,
        statusUrl: `${window.location.origin}${response.data.statusPath}`,
      });
    });
  }

  if (sent) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
            <h2>Je verzoek is verstuurd</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Je referentienummer is{" "}
            <strong className="font-mono">{sent.reference}</strong>. Een
            moderator bekijkt je verzoek zo snel mogelijk.
          </p>
          <div className="space-y-1">
            <p className="font-medium">Bewaar deze link</p>
            <p className="text-muted-foreground">
              Hiermee volg je je verzoek. Zodra een moderator beslist, sturen we
              je één e-mail met een link naar de beslissing.
            </p>
            <p className="break-all rounded-md border bg-muted/30 p-2 font-mono text-xs">
              {sent.statusUrl}
            </p>
          </div>
          <Button asChild>
            <Link href={sent.statusUrl}>Status bekijken</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          <h2>Je verzoek</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={submit}
          className="space-y-5"
          aria-label="Verwijderverzoek"
        >
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">
              Wie doet het verzoek?
            </legend>
            {relations.map(([value, label]) => (
              <div key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  id={`${id}-${value}`}
                  name="relation"
                  value={value}
                  required
                  className="h-4 w-4 accent-primary"
                />
                <Label htmlFor={`${id}-${value}`} className="font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </fieldset>

          <div className="space-y-1">
            <Label htmlFor={`${id}-name`}>Je naam</Label>
            <Input
              id={`${id}-name`}
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={TAKEDOWN_NAME_MAX_LENGTH}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${id}-email`}>Je e-mailadres</Label>
            <Input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="email"
              maxLength={TAKEDOWN_EMAIL_MAX_LENGTH}
              required
              aria-describedby={`${id}-email-hint`}
            />
            <p
              id={`${id}-email-hint`}
              className="text-xs text-muted-foreground"
            >
              Alleen om je over dit verzoek te contacteren als dat nodig is.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${id}-explanation`}>
              Waarom moet dit gerucht weg?
            </Label>
            <Textarea
              id={`${id}-explanation`}
              name="explanation"
              rows={5}
              minLength={TAKEDOWN_EXPLANATION_MIN_LENGTH}
              maxLength={TAKEDOWN_EXPLANATION_MAX_LENGTH}
              required
              placeholder="Bijvoorbeeld: het klopt niet, het gaat over een minderjarige, of het is kwetsend."
            />
          </div>

          {/* DSA art. 16(2)(d): the notice is made in good faith (#94). */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id={`${id}-good-faith`}
              name="goodFaith"
              required
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <Label htmlFor={`${id}-good-faith`} className="font-normal">
              Ik verklaar te goeder trouw dat mijn verzoek juist en volledig is.
            </Label>
          </div>

          {/* Honeypot: hidden from people and screen readers, filled by bots. */}
          <div
            aria-hidden
            className="absolute -left-[9999px] h-px w-px overflow-hidden"
          >
            <label htmlFor={`${id}-website`}>Website</label>
            <input
              id={`${id}-website`}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Alleen moderators zien je naam, e-mailadres en uitleg. We wissen ze
            12 maanden na je verzoek. Meer in ons{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              privacybeleid
            </Link>
            .
          </p>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending || !hydrated}>
            {pending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            Verzoek versturen
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
