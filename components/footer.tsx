import Link from "next/link";
import { Flame } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Flame className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                VolleyRumours
              </span>
            </Link>
            <p className="text-muted-foreground text-sm max-w-md">
              De community-gedreven website voor Belgische volleybal transfers.
              Deel je kennis, stem op transfers en word een betrouwbare bron.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Navigatie</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/geruchten"
                  className="hover:text-foreground transition-colors"
                >
                  Transfer Talk
                </Link>
              </li>
              <li>
                <Link
                  href="/transfers"
                  className="hover:text-foreground transition-colors"
                >
                  Transfers
                </Link>
              </li>
              <li>
                <Link
                  href="/zoekertjes"
                  className="hover:text-foreground transition-colors"
                >
                  Zoekertjes
                </Link>
              </li>
              <li>
                <Link
                  href="/leaderboard"
                  className="hover:text-foreground transition-colors"
                >
                  Leaderboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Community</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/auth/register"
                  className="hover:text-foreground transition-colors"
                >
                  Registreren
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/login"
                  className="hover:text-foreground transition-colors"
                >
                  Inloggen
                </Link>
              </li>
              <li>
                <Link
                  href="/over-ons"
                  className="hover:text-foreground transition-colors"
                >
                  Over Ons
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-foreground transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} VolleyRumours. Alle rechten
            voorbehouden.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/voorwaarden"
              className="hover:text-foreground transition-colors"
            >
              Voorwaarden
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
