"use client";

import { useRef, useState } from "react";
import { subscribeToWaitlist } from "@/app/actions/waitlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export function WaitlistForm() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setStatus("loading");
    setErrorMessage("");

    const result = await subscribeToWaitlist(formData);

    if (result.success) {
      setStatus("success");
      formRef.current?.reset();
    } else {
      setStatus("error");
      setErrorMessage(result.error);
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-center gap-2 text-primary bg-primary/10 rounded-lg px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <p className="text-sm font-medium">
          Bedankt! Je hoort van ons bij de lancering.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-3 w-full max-w-md"
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="email"
            name="email"
            placeholder="jouw@email.be"
            required
            className="pl-10"
            disabled={status === "loading"}
          />
        </div>
        <Button type="submit" disabled={status === "loading"} size="default">
          {status === "loading" ? "Even geduld…" : "Inschrijven"}
        </Button>
      </div>

      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      />

      {status === "error" && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Door je in te schrijven ga je akkoord met ons{" "}
        <Link
          href="/privacy"
          className="underline hover:text-foreground transition-colors"
        >
          privacybeleid
        </Link>
        .
      </p>
    </form>
  );
}
