import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { adminSections } from "./sections";

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Hier behandel je geruchten, meldingen en gebruikers. Elke actie komt in
        het logboek.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {adminSections.map((section) => {
          const card = (
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-lg">
                  <h2>{section.label}</h2>
                  {!section.href && (
                    <Badge variant="outline">Binnenkort</Badge>
                  )}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          );
          return section.href ? (
            <Link key={section.label} href={section.href}>
              {card}
            </Link>
          ) : (
            <div key={section.label}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
