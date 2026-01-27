"use client";

import React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

const POSITIONS = [
  { value: "setter", label: "Setter" },
  { value: "libero", label: "Libero" },
  { value: "receptiehoek", label: "Receptie/hoek" },
  { value: "middenaanvaller", label: "Middenaanvaller" },
  { value: "opposite", label: "Opposite" },
];

const TRAINER_DIPLOMAS = [
  { value: "initiator", label: "Initiator" },
  { value: "instructeur", label: "Instructeur" },
  { value: "trainer_c", label: "Trainer C" },
  { value: "trainer_b", label: "Trainer B" },
  { value: "trainer_a", label: "Trainer A" },
];

const DIVISIONS = [
  { value: "liga_heren", label: "LIGA HEREN" },
  { value: "liga_dames", label: "LIGA DAMES" },
  { value: "nat1_heren", label: "Nationale 1 Heren" },
  { value: "nat2_heren", label: "Nationale 2 Heren" },
  { value: "nat3_heren", label: "Nationale 3 Heren" },
  { value: "nat1_dames", label: "Nationale 1 Dames" },
  { value: "nat2_dames", label: "Nationale 2 Dames" },
  { value: "nat3_dames", label: "Nationale 3 Dames" },
  { value: "promo1_heren", label: "PROMO 1 Heren" },
  { value: "promo2_heren", label: "PROMO 2 Heren" },
  { value: "promo3_heren", label: "PROMO 3 Heren" },
  { value: "promo4_heren", label: "PROMO 4 Heren" },
  { value: "promo1_dames", label: "PROMO 1 Dames" },
  { value: "promo2_dames", label: "PROMO 2 Dames" },
  { value: "promo3_dames", label: "PROMO 3 Dames" },
  { value: "promo4_dames", label: "PROMO 4 Dames" },
];

const PROVINCES = [
  { value: "antwerpen", label: "Antwerpen" },
  { value: "limburg", label: "Limburg" },
  { value: "oost_vlaanderen", label: "Oost-Vlaanderen" },
  { value: "vlaams_brabant", label: "Vlaams-Brabant" },
  { value: "west_vlaanderen", label: "West-Vlaanderen" },
  { value: "henegouwen", label: "Henegouwen" },
  { value: "waals_brabant", label: "Waals-Brabant" },
  { value: "namen", label: "Namen" },
  { value: "luik", label: "Luik" },
  { value: "luxemburg", label: "Luxemburg" },
  { value: "frankrijk", label: "Frankrijk" },
  { value: "zwitserland", label: "Zwitserland" },
  { value: "turkije", label: "Turkije" },
  { value: "nederland", label: "Nederland" },
];

export default function NewClassifiedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const isTrainerType =
    selectedType === "trainer_seeks_team" ||
    selectedType === "team_seeks_trainer";
  const positionOptions = isTrainerType ? TRAINER_DIPLOMAS : POSITIONS;
  const fieldLabel = isTrainerType ? "Diploma" : "Positie";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Je moet ingelogd zijn om een zoekertje te plaatsen");
      setLoading(false);
      return;
    }

    const classifiedData = {
      user_id: user.id,
      type: formData.get("type") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      contact_name: formData.get("name") as string,
      position: (formData.get("position") as string) || null,
      team_name: (formData.get("team_name") as string) || null,
      province: (formData.get("province") as string) || null,
      division: (formData.get("division") as string) || null,
      contact_email: formData.get("contact_email") as string,
      is_active: true,
    };

    const { error: insertError } = await supabase
      .from("classifieds")
      .insert(classifiedData);

    if (insertError) {
      setError("Er ging iets mis bij het plaatsen van je zoekertje");
      setLoading(false);
      return;
    }

    router.push("/zoekertjes");
    router.refresh();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="type">Type zoekertje</Label>
              <Select
                name="type"
                required
                onValueChange={(value) => setSelectedType(value)}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player_seeks_team">
                    Speler zoekt club
                  </SelectItem>
                  <SelectItem value="trainer_seeks_team">
                    Trainer zoekt club
                  </SelectItem>
                  <SelectItem value="team_seeks_player">
                    Club zoekt speler
                  </SelectItem>
                  <SelectItem value="team_seeks_trainer">
                    Club zoekt trainer
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Naam</Label>
              <Input
                id="name"
                name="name"
                placeholder="Je naam of clubnaam"
                required
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                name="title"
                placeholder="bv. Ervaren setter zoekt nieuwe uitdaging"
                required
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschrijving</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Vertel meer over jezelf, je ervaring en wat je zoekt..."
                rows={5}
                required
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">{fieldLabel} (optioneel)</Label>
                <Select name="position">
                  <SelectTrigger className="bg-input border-border text-foreground w-full">
                    <SelectValue
                      placeholder={`Selecteer ${fieldLabel.toLowerCase()}`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {positionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team_name">Huidige Club/Team</Label>
                <Input
                  id="team_name"
                  name="team_name"
                  placeholder="Club naam"
                  className="bg-input border-border text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="province">Provincie</Label>
                <Select name="province">
                  <SelectTrigger className="bg-input border-border text-foreground w-full">
                    <SelectValue placeholder="Selecteer provincie" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map((province) => (
                      <SelectItem key={province.value} value={province.value}>
                        {province.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="division">Divisie</Label>
                <Select name="division">
                  <SelectTrigger className="bg-input border-border text-foreground w-full">
                    <SelectValue placeholder="Selecteer divisie" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIVISIONS.map((division) => (
                      <SelectItem key={division.value} value={division.value}>
                        {division.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact e-mail</Label>
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                placeholder="je@email.com"
                required
                className="bg-input border-border text-foreground"
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-md text-destructive text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? (
                "Bezig met plaatsen..."
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Zoekertje plaatsen
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
