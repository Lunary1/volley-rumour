"use client";

import React, { Suspense } from "react";

import { createClient } from "@/lib/supabase/client";
import { signInWithGoogle } from "@/app/actions/auth";
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
import Link from "next/link";
import { useState, useEffect } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pick up error query param set by /auth/callback on failure
  useEffect(() => {
    const errorCode = searchParams.get("error");
    if (errorCode) {
      setError(getOAuthErrorMessage(errorCode));
      router.replace("/auth/sign-up", { scroll: false });
    }
  }, [searchParams, router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
            window.location.origin,
          data: {
            username,
          },
        },
      });
      if (error) throw error;

      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Er ging iets mis");
    } finally {
      setIsLoading(false);
    }
  };

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
              <Link href="/auth/login">
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
                Maak een account aan om geruchten te delen en punten te
                verdienen
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
                      const result = await signInWithGoogle();
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
                      type="text"
                      placeholder="jouwgebruikersnaam"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="bg-input border-border text-foreground"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-foreground">
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="je@email.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-input border-border text-foreground"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-foreground">
                      Wachtwoord
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-input border-border text-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimaal 6 karakters
                    </p>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={isLoading}
                  >
                    {isLoading ? "Bezig met registreren..." : "Registreren"}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Al een account?{" "}
                  <Link
                    href="/auth/login"
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
