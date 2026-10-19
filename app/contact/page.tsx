import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getCurrentUser } from "@/app/actions/auth";
import { isComingSoon } from "@/lib/coming-soon";
import { ContactForm } from "./contact-form";

// The contact form (#81, D-017). Open in coming-soon mode, without login.
// Messages go to staff at /admin/contact. Abuse has its own routes: "Melden"
// on the content (J-15) and the takedown form for named people (J-12). In
// coming-soon mode neither exists for visitors, so the pointer is hidden.

export const metadata = pageMetadata({
  title: "Contact",
  description:
    "Een vraag, feedback of een voorstel? Stuur ons een bericht via het contactformulier.",
  path: "/contact",
});

export default async function ContactPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen">
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
          <h1 className="mb-4 text-4xl font-bold text-foreground">
            Contacteer ons
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Een vraag over je account, feedback of een voorstel om samen te
            werken? Stuur ons een bericht.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-2xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
        {!isComingSoon() && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Iets melden?</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Een gerucht, zoekertje of gesprek dat niet door de beugel kan?
                Gebruik <strong>Melden</strong> bij dat gerucht, zoekertje of
                gesprek. Zo weten we meteen over welk item het gaat.
              </li>
              <li>
                Gaat een gerucht over jou of je kind?{" "}
                <Link
                  href="/verwijderverzoek"
                  className="text-primary underline underline-offset-2"
                >
                  Vraag de verwijdering aan
                </Link>
                .
              </li>
            </ul>
          </div>
        )}

        <ContactForm
          defaultEmail={user?.email}
          defaultCategory={user?.suspension ? "account" : undefined}
        />
      </section>
    </div>
  );
}
