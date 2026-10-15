"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  submitContactMessage,
  type ContactMessageInput,
} from "@/app/actions/contact";
import {
  CONTACT_CATEGORIES,
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  type ContactCategory,
} from "@/lib/contact";
import { useIsClient } from "@/lib/use-is-client";

const categories = Object.entries(CONTACT_CATEGORIES) as [
  ContactCategory,
  string,
][];

/** The contact form; after sending, a confirmation. */
export function ContactForm({
  defaultEmail,
  defaultCategory,
}: {
  defaultEmail?: string;
  defaultCategory?: ContactCategory;
}) {
  const id = useId();
  // Before hydration the browser would submit the form itself, as a GET with
  // the message in the URL.
  const hydrated = useIsClient();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [category, setCategory] = useState<ContactCategory | "">(
    defaultCategory ?? "",
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    if (!category) {
      setError("Kies een onderwerp");
      return;
    }
    startTransition(async () => {
      const response = await submitContactMessage({
        category,
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        message: String(form.get("message") ?? ""),
        website: String(form.get("website") ?? ""),
      } as ContactMessageInput);
      if (!response.success) {
        setError(response.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div role="status" className="space-y-2 rounded-lg border bg-card p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
          Je bericht is verstuurd
        </h2>
        <p className="text-sm text-muted-foreground">
          Bedankt! We lezen elk bericht en antwoorden via e-mail als dat nodig
          is.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6" aria-label="Contactformulier">
      <div className="space-y-2">
        <Label htmlFor={`${id}-category`}>Onderwerp</Label>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as ContactCategory)}
        >
          <SelectTrigger id={`${id}-category`} className="w-full">
            <SelectValue placeholder="Kies een onderwerp" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>Je naam</Label>
        <Input
          id={`${id}-name`}
          name="name"
          autoComplete="name"
          minLength={2}
          maxLength={CONTACT_NAME_MAX_LENGTH}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-email`}>Je e-mailadres</Label>
        <Input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          maxLength={CONTACT_EMAIL_MAX_LENGTH}
          required
          aria-describedby={`${id}-email-hint`}
        />
        <p id={`${id}-email-hint`} className="text-xs text-muted-foreground">
          We antwoorden op dit adres.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-message`}>Je bericht</Label>
        <Textarea
          id={`${id}-message`}
          name="message"
          rows={6}
          minLength={CONTACT_MESSAGE_MIN_LENGTH}
          maxLength={CONTACT_MESSAGE_MAX_LENGTH}
          required
        />
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
        Alleen moderators en beheerders lezen je bericht. We wissen je naam,
        e-mailadres en bericht 12 maanden nadat we het afgehandeld hebben. Meer
        in ons{" "}
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
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Bericht versturen
      </Button>
    </form>
  );
}
