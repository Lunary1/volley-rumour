import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isRecoverySession } from "@/lib/supabase/recovery";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UpdatePasswordForm } from "@/components/update-password-form";

export const metadata = { title: "Nieuw wachtwoord instellen" };

// #58 – The password-reset email links here via /auth/callback, which turns
// the link into a recovery session.
export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canSetPassword = !!user && (await isRecoverySession(supabase));

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden">
      <div className="w-full max-w-sm px-6 py-6 md:px-10 md:py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">
              {canSetPassword
                ? "Nieuw wachtwoord instellen"
                : "Herstellink ongeldig"}
            </CardTitle>
            <CardDescription>
              {canSetPassword
                ? `Kies een nieuw wachtwoord voor ${user.email}.`
                : "Deze herstellink is ongeldig of verlopen."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canSetPassword ? (
              <UpdatePasswordForm />
            ) : (
              <p className="text-sm text-muted-foreground">
                Vraag een nieuwe herstelmail aan via{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4 text-primary hover:text-primary/80"
                >
                  Wachtwoord vergeten?
                </Link>{" "}
                op de inlogpagina. Open de link in dezelfde browser.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
