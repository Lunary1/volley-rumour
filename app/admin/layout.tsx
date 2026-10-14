import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getStaffUser } from "@/lib/staff";
import { adminSections } from "./sections";

export const metadata: Metadata = {
  title: "Beheer | VolleyRumours",
  robots: { index: false, follow: false },
};

// Every /admin page renders inside this layout, so this is the gate: non-staff
// get a 404 and never learn the admin area exists (D-006). Admin server
// actions check again with requireStaff().
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getStaffUser();
  if (!staff) notFound();

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-3xl font-bold">Beheer</h1>
        </div>
        <div className="flex flex-col gap-8 md:flex-row">
          <nav aria-label="Beheer" className="md:w-56 md:shrink-0">
            <ul className="flex flex-col gap-1">
              {adminSections.map((section) => (
                <li key={section.label}>
                  {section.href ? (
                    <Link
                      href={section.href}
                      className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      {section.label}
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground"
                    >
                      {section.label}
                      <Badge variant="outline">Binnenkort</Badge>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </main>
  );
}
