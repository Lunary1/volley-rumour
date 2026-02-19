"use client";

import React, { Suspense } from "react";

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
import { login, signInWithGoogle, requestPasswordReset } from "@/app/actions/auth";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Maps OAuth / callback error codes to Dutch user-facing messages.
 */
function getOAuthErrorMessage(code: string): string {
  switch (code) {
    case "auth-code-error":
      return "Inloggen is mislukt. Probeer het opnieuw.";
    case "oauth-cancelled":
      return "Google login geannuleerd. Probeer het opnieuw.";
    case "oauth-provider-error":
      return "Google login is momenteel niet beschikbaar.";
    default:
      return "Er ging iets mis. Probeer het opnieuw.";
  }
}

/**
 * KAN-53 – Maps server-action error codes to Dutch user-facing messages.
 * The "google_account_use_google_login" code is returned when a
 * Google-registered user tries to log in with email + password.
 */
function getLoginErrorMessage(code: string): string {
  switch (code) {
    case "google_account_use_google_login":
      return "Dit account is aangemeld via Google. Gebruik de knop \u2018Doorgaan met Google\u2019 om in te loggen.";
    default:
      return code;
  }
}

export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // KAN-53 – Forgot-password panel state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Pick up error query param set by /auth/callback on failure
  useEffect(() => {
    const errorCode = searchParams.get("error");
    if (errorCode) {
      setError(getOAuthErrorMessage(errorCode));
      // Clean the URL so the message doesn't stick around on refresh
      router.replace("/auth/login", { scroll: false });
    }
  }, [searchParams, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await login(email, password);
      if (result?.error) {
        // KAN-53: translate known error codes to Dutch messages
        setError(getLoginErrorMessage(result.error));
        setIsLoading(false);
      } else {
        // Login successful, redirect to home
        router.push("/");
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
      setIsLoading(false);
    }
  };

  // KAN-53 – Forgot-password form handler
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError(null);
    try {
      await requestPasswordReset(resetEmail);
      setResetSent(true);
    } catch {
      setResetError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden">
      <div className="w-full max-w-sm px-6 py-6 md:px-10 md:py-10">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-foreground">
                {showForgotPassword ? "Wachtwoord vergeten" : "Inloggen"}
              </CardTitle>
              <CardDescription>
                {showForgotPassword
                  ? "Voer je e-mailadres in om een herstelmail te ontvangen."
                  : "Log in om geruchten te delen en te stemmen"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* ---- Forgot-password panel (KAN-53) ---- */}
              {showForgotPassword ? (
                <div className="flex flex-col gap-4">
                  {/* Note for Google users */}
                  <p className="text-sm text-muted-foreground">
                    Als je via Google hebt aangemeld, kun je dit formulier
                    gebruiken om jezelf een link te sturen om een wachtwoord in
                    te stellen. Na het instellen kun je inloggen met zowel
                    Google als e-mail&nbsp;+&nbsp;wachtwoord.
                  </p>

                  {resetSent ? (
                    <p className="text-sm text-green-600">
                      Als dit e-mailadres is geregistreerd, ontvang je een
                      e-mail met instructies.
                    </p>
                  ) : (
                    <form onSubmit={handlePasswordReset} className="flex flex-col gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="reset-email">E-mailadres</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="m@example.com"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                        />
                      </div>
                      {resetError && (
                        <p className="text-sm text-red-500">{resetError}</p>
                      )}
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={resetLoading}
                      >
                        {resetLoading ? "Bezig..." : "Herstelmail versturen"}
                      </Button>
                    </form>
                  )}

                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary text-center"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetSent(false);
                      setResetEmail("");
                      setResetError(null);
                    }}
                  >
                    Terug naar inloggen
                  </button>
                </div>
              ) : (
                /* ---- Normal login panel ---- */
                <>
                  <div className="flex flex-col gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
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
                  <form onSubmit={handleLogin} className="mt-4">
                    <div className="flex flex-col gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="email">E-mailadres</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="m@example.com"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Wachtwoord</Label>
                          {/* KAN-53 – Forgot password trigger */}
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-primary"
                            onClick={() => {
                              setShowForgotPassword(true);
                              setError(null);
                              setResetEmail(email); // pre-fill from the login email if set
                            }}
                          >
                            Wachtwoord vergeten?
                          </button>
                        </div>
                        <Input
                          id="password"
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      {error && (
                        <p className="text-sm text-red-500">{error}</p>
                      )}
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoading}
                      >
                        {isLoading ? "Bezig met inloggen..." : "Inloggen"}
                      </Button>
                    </div>
                    <div className="mt-4 text-center text-sm text-muted-foreground">
                      Nog geen account?{" "}
                      <Link
                        href="/auth/sign-up"
                        className="underline underline-offset-4 text-primary hover:text-primary/80"
                      >
                        Registreer
                      </Link>
                    </div>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
