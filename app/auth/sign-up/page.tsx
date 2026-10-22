"use client";

import React, { Suspense } from "react";

import { signInWithGoogle, signUp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TermsCheckboxes } from "@/components/terms-checkboxes";
import { useIsClient } from "@/lib/use-is-client";
import { safeNextPath } from "@/lib/utils";
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type SignUpField,
} from "@/lib/schemas";
import Link from "next/link";
import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Maps OAuth / callback error codes to Dutch user-facing messages.
 */
function getOAuthErrorMessage(code: string): string {
  switch (code) {
    case "auth-code-error":
      return "Registreren is mislukt. Probeer het opnieuw.";
    case "oauth-cancelled":
      return "Google registratie geannuleerd. Probeer het opnieuw.";
    case "oauth-provider-error":
      return "Google login is momenteel niet beschikbaar.";
    default:
      return "Er ging iets mis. Probeer het opnieuw.";
  }
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpPageInner />
    </Suspense>
  );
}

function SignUpPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const isClient = useIsClient();
  const searchParams = useSearchParams();
  // Where the user came from, for after the confirmation link (#89).
  const next = safeNextPath(searchParams.get("next"));
  const nextQuery = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  // Error code set by /auth/callback on failure, read once on first render
  const errorCode = searchParams.get("error");
  const [error, setError] = useState<string | null>(() =>
    errorCode ? getOAuthErrorMessage(errorCode) : null,
  );
  const [errorField, setErrorField] = useState<SignUpField | null>(null);

  // Clean the URL so the message doesn't stick around on refresh
  useEffect(() => {
    if (errorCode)
      router.replace(`/auth/sign-up${nextQuery}`, { scroll: false });
  }, [errorCode, nextQuery, router]);

  const handleSignUp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setErrorField(null);
    startTransition(async () => {
      const result = await signUp(null, form);
      if (!result.success) {
        setError(result.error);
        setErrorField(result.field ?? null);
      } else if (result.data.confirmEmail) {
        setSuccess(true);
      } else {
        router.push(next);
        router.refresh();
      }
    });
  };

  const fieldError = (field: SignUpField) =>
    errorField === field ? error : null;

  if (success) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden">
        <div className="w-full max-w-sm px-6 py-6 md:px-10 md:py-10">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-2xl text-foreground">
                Controleer je e-mail
              </CardTitle>
              <CardDescription>
                We hebben een bevestigingslink naar {email} gestuurd. Klik op de
                link om je account te activeren.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/auth/login${nextQuery}`}>
                <Button
                  variant="outline"
                  className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent"
                >
                  Terug naar inloggen
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden">
      <div className="w-full max-w-sm px-6 py-6 md:px-10 md:py-10">
        <div className="flex flex-col gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-2xl text-foreground">
                Registreren
              </CardTitle>
              <CardDescription>
                Maak een account aan om geruchten te delen en zoekertjes te
                plaatsen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-border text-foreground hover:bg-muted"
                  disabled={isGoogleLoading || isLoading}
                  onClick={async () => {
                    setIsGoogleLoading(true);
                    setError(null);
                    try {
                      const result = await signInWithGoogle(next);
                      if (result?.error) {
                        setError(result.error);
                      }
                    } catch {
                      // redirect throws, this is expected
                    } finally {
                      setIsGoogleLoading(false);
                    }
                  }}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {isGoogleLoading ? "Bezig..." : "Doorgaan met Google"}
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      of
                    </span>
                  </div>
                </div>
              </div>
              <form onSubmit={handleSignUp} className="mt-4">
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="username" className="text-foreground">
                      Gebruikersnaam
                    </Label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      placeholder="jouwgebruikersnaam"
                      required
                      minLength={USERNAME_MIN_LENGTH}
                      maxLength={USERNAME_MAX_LENGTH}
                      pattern="[A-Za-z0-9_]+"
                      title="Letters, cijfers en _"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      aria-invalid={!!fieldError("username")}
                      aria-describedby="username-hint"
                      className="bg-input border-border text-foreground"
                    />
                    <FieldMessage
                      id="username-hint"
                      error={fieldError("username")}
                      hint={`${USERNAME_MIN_LENGTH} tot ${USERNAME_MAX_LENGTH} tekens: letters, cijfers en _`}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-foreground">
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="je@email.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={!!fieldError("email")}
                      aria-describedby="email-hint"
                      className="bg-input border-border text-foreground"
                    />
                    <FieldMessage id="email-hint" error={fieldError("email")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-foreground">
                      Wachtwoord
                    </Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={PASSWORD_MIN_LENGTH}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={!!fieldError("password")}
                      aria-describedby="password-hint"
                      className="bg-input border-border text-foreground"
                    />
                    <FieldMessage
                      id="password-hint"
                      error={fieldError("password")}
                      hint={`Minimaal ${PASSWORD_MIN_LENGTH} tekens`}
                    />
                  </div>
                  <TermsCheckboxes />
                  <input type="hidden" name="next" value={next} />
                  {error && !errorField && (
                    <p role="alert" className="text-sm text-destructive-text">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={isLoading || !isClient}
                  >
                    {isLoading ? "Bezig met registreren..." : "Registreren"}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Al een account?{" "}
                  <Link
                    href={`/auth/login${nextQuery}`}
                    className="underline underline-offset-4 text-primary hover:text-primary/80"
                  >
                    Inloggen
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** A field's error in red, or its hint while there is none. */
function FieldMessage({
  id,
  error,
  hint,
}: {
  id: string;
  error: string | null;
  hint?: string;
}) {
  if (error) {
    return (
      <p id={id} role="alert" className="text-xs text-destructive-text">
        {error}
      </p>
    );
  }
  if (!hint) return null;
  return (
    <p id={id} className="text-xs text-muted-foreground">
      {hint}
    </p>
  );
}
