"use client";

import { useActionState } from "react";
import { acceptTerms } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { TermsCheckboxes } from "@/components/terms-checkboxes";

export function AcceptTermsForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(acceptTerms, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="next" value={next} />
      <TermsCheckboxes />
      {state && !state.success && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Bezig..." : "Doorgaan"}
      </Button>
    </form>
  );
}
