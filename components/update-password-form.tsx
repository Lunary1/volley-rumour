"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setNewPassword } from "@/app/actions/auth";
import { handleServerActionResponse } from "@/lib/client-utils";
import { PASSWORD_MIN_LENGTH } from "@/lib/schemas";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await setNewPassword(password, confirmPassword);
    if (result.success) {
      handleServerActionResponse(result, {
        successMessage: "Je wachtwoord is ingesteld.",
      });
      router.push("/");
      router.refresh();
    } else {
      handleServerActionResponse(result);
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-2">
        <Label htmlFor="new-password">Nieuw wachtwoord</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          placeholder={`Min. ${PASSWORD_MIN_LENGTH} tekens`}
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Bevestig nieuw wachtwoord</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Bezig..." : "Wachtwoord instellen"}
      </Button>
    </form>
  );
}
