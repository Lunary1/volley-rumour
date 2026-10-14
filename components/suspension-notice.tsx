import Link from "next/link";
import { Ban } from "lucide-react";
import { getCurrentUser } from "@/app/actions/auth";
import { suspensionEndLabel } from "@/lib/sanctions";

/**
 * Tells a suspended user, on every page, that they can read but not post,
 * vote or message, until when and why (#80, J-15). Renders nothing for
 * everyone else.
 */
export async function SuspensionNotice() {
  const user = await getCurrentUser();
  if (!user?.suspension) return null;

  const { until, reason } = user.suspension;

  return (
    <div
      role="status"
      className="border-b border-destructive/30 bg-destructive/10 text-foreground"
    >
      <div className="container mx-auto flex gap-3 px-4 py-3 text-sm">
        <Ban className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">
            Je account is geschorst {suspensionEndLabel(until)}.
          </p>
          <p>Reden: {reason}</p>
          <p className="text-muted-foreground">
            Je kan de site nog lezen, maar geen geruchten of zoekertjes
            plaatsen, niet stemmen, geen berichten sturen en je profiel niet
            aanpassen. Denk je dat dit een vergissing is?{" "}
            <Link href="/contact" className="underline underline-offset-2">
              Neem contact met ons op
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
