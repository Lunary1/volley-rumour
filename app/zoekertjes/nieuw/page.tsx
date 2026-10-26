import { NO_INDEX } from "@/lib/seo";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/app/actions/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClassifiedForm } from "@/components/classified-form";

export const metadata: Metadata = {
  title: "Nieuw zoekertje",
  robots: NO_INDEX,
};

export default async function NewClassifiedPage() {
  // Logged-out visitors log in and come back here (#71).
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/zoekertjes/nieuw");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/zoekertjes"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Terug naar zoekertjes
      </Link>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            Nieuw Zoekertje Plaatsen
          </CardTitle>
          <CardDescription>
            Op zoek naar een nieuwe club of speler? Plaats hier je zoekertje!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClassifiedForm />
        </CardContent>
      </Card>
    </div>
  );
}
