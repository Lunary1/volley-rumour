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

const GENDERS = [
  { value: "men", label: "Heren" },
  { value: "women", label: "Dames" },
  { value: "mixed", label: "Gemengd" },
];

export default function NewClassifiedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

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

    const type = formData.get("type") as string;
    let classifiedData: any = {
      user_id: user.id,
      type: type,
      is_active: true,
    };

    // Handle different types
    if (type === "player_seeks_team") {
      classifiedData = {
        ...classifiedData,
        title: `${formData.get("voornaam")} ${formData.get("naam")}`,
        description: (formData.get("description") as string) || null,
        contact_name: `${formData.get("voornaam")} ${formData.get("naam")}`,
        position: formData.get("position"),
        team_name: formData.get("clubnaam"),
        province: formData.get("province"),
        division: formData.get("division"),
      };
    } else if (type === "team_seeks_player") {
      classifiedData = {
        ...classifiedData,
        title: formData.get("team_name") as string,
        description: (formData.get("description") as string) || null,
        contact_name: formData.get("team_name"),
        position: formData.get("position"),
        team_name: formData.get("team_name"),
        province: formData.get("province"),
        division: formData.get("division"),
      };
    } else if (type === "trainer_seeks_team") {
      classifiedData = {
        ...classifiedData,
        title: `${formData.get("voornaam")} ${formData.get("naam")}`,
        description: (formData.get("description") as string) || null,
        contact_name: `${formData.get("voornaam")} ${formData.get("naam")}`,
        position: formData.get("diploma"),
        team_name: (formData.get("current_club") as string) || null,
        province: formData.get("province"),
        division: formData.get("division"),
      };
    } else if (type === "team_seeks_trainer") {
      classifiedData = {
        ...classifiedData,
        title: formData.get("team_name") as string,
        description: (formData.get("description") as string) || null,
        contact_name: formData.get("team_name"),
        team_name: formData.get("team_name"),
        province: formData.get("province"),
        division: formData.get("division"),
      };
    }

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
                    Speler/speelster zoekt team
                  </SelectItem>
                  <SelectItem value="team_seeks_player">
                    Team zoekt speler/speelster
                  </SelectItem>
                  <SelectItem value="trainer_seeks_team">
                    Trainer/trainster zoekt team
                  </SelectItem>
                  <SelectItem value="team_seeks_trainer">
                    Team zoekt trainer/trainster
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* TYPE 1: Player seeks team */}
            {selectedType === "player_seeks_team" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="voornaam">
                      Voornaam <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="voornaam"
                      name="voornaam"
                      placeholder="Bijv. Jan"
                      required
                      className="bg-input border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="naam">
                      Naam <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="naam"
                      name="naam"
                      placeholder="Bijv. Janssen"
                      required
                      className="bg-input border-border text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="geslacht">
                      Geslacht <span className="text-destructive">*</span>
                    </Label>
                    <Select name="geslacht" required>
                      <SelectTrigger className="bg-input border-border text-foreground w-full">
                        <SelectValue placeholder="Selecteer geslacht" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((gender) => (
                          <SelectItem key={gender.value} value={gender.value}>
                            {gender.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">
                      Positie <span className="text-destructive">*</span>
                    </Label>
                    <Select name="position" required>
                      <SelectTrigger className="bg-input border-border text-foreground w-full">
                        <SelectValue placeholder="Selecteer positie" />
                      </SelectTrigger>
                      <SelectContent>
                        {POSITIONS.map((pos) => (
                          <SelectItem key={pos.value} value={pos.value}>
                            {pos.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clubnaam">
                      Clubnaam <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="clubnaam"
                      name="clubnaam"
                      placeholder="Bijv. Knack Roeselare"
                      required
                      className="bg-input border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="division">
                      Niveau <span className="text-destructive">*</span>
                    </Label>
                    <Select name="division" required>
                      <SelectTrigger className="bg-input border-border text-foreground w-full">
                        <SelectValue placeholder="Selecteer niveau" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIVISIONS.map((division) => (
                          <SelectItem
                            key={division.value}
                            value={division.value}
                          >
                            {division.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="province">
                    Provincie <span className="text-destructive">*</span>
                  </Label>
                  <Select name="province" required>
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
                  <Label htmlFor="description">
                    Omschrijf hier kort wat je precies zoekt
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Vertel meer over jezelf en wat je zoekt..."
                    rows={4}
                    className="bg-input border-border text-foreground"
                  />
                </div>
              </>
            )}

            {/* TYPE 2: Team seeks player */}
            {selectedType === "team_seeks_player" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="team_name">
                    Teamnaam/Club <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="team_name"
                    name="team_name"
                    placeholder="Bijv. Caruur Gent Volley"
                    required
                    className="bg-input border-border text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="province">
                      Provincie <span className="text-destructive">*</span>
                    </Label>
                    <Select name="province" required>
                      <SelectTrigger className="bg-input border-border text-foreground w-full">
                        <SelectValue placeholder="Selecteer provincie" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVINCES.map((province) => (
                          <SelectItem
                            key={province.value}
                            value={province.value}
                          >
                            {province.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="division">
                      Niveau <span className="text-destructive">*</span>
                    </Label>
                    <Select name="division" required>
                      <SelectTrigger className="bg-input border-border text-foreground w-full">
                        <SelectValue placeholder="Selecteer niveau" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIVISIONS.map((division) => (
                          <SelectItem
                            key={division.value}
                            value={division.value}
                          >
                            {division.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="geslacht">
                    Dames/Heren <span className="text-destructive">*</span>
                  </Label>
                  <Select name="geslacht" required>
                    <SelectTrigger className="bg-input border-border text-foreground w-full">
                      <SelectValue placeholder="Selecteer geslacht" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((gender) => (
                        <SelectItem key={gender.value} value={gender.value}>
                          {gender.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">
                    Positie <span className="text-destructive">*</span>
                  </Label>
                  <Select name="position" required>
                    <SelectTrigger className="bg-input border-border text-foreground w-full">
                      <SelectValue placeholder="Selecteer positie" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((pos) => (
                        <SelectItem key={pos.value} value={pos.value}>
                          {pos.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    Omschrijf hier kort wat jullie precies zoeken
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Vertel meer over je team en wat je zoekt..."
                    rows={4}
                    className="bg-input border-border text-foreground"
                  />
                </div>
              </>
            )}

            {/* TYPE 3: Trainer seeks team */}
            {selectedType === "trainer_seeks_team" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="voornaam">
                      Voornaam <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="voornaam"
                      name="voornaam"
                      placeholder="Bijv. Jan"
                      required
                      className="bg-input border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="naam">
                      Naam <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="naam"
                      name="naam"
                      placeholder="Bijv. Janssen"
                      required
                      className="bg-input border-border text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="geslacht">
                      Geslacht <span className="text-destructive">*</span>
                    </Label>
                    <Select name="geslacht" required>
                      <SelectTrigger className="bg-input border-border text-foreground w-full">
                        <SelectValue placeholder="Selecteer geslacht" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((gender) => (
                          <SelectItem key={gender.value} value={gender.value}>
                            {gender.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diploma">
                      Diploma <span className="text-destructive">*</span>
                    </Label>
                    <Select name="diploma" required>
                      <SelectTrigger className="bg-input border-border text-foreground w-full">
                        <SelectValue placeholder="Selecteer diploma" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRAINER_DIPLOMAS.map((diploma) => (
                          <SelectItem key={diploma.value} value={diploma.value}>
                            {diploma.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="current_club">
                    Huidige clubnaam (optioneel)
                  </Label>
                  <Input
                    id="current_club"
                    name="current_club"
                    placeholder="Bijv. Knack Roeselare"
                    className="bg-input border-border text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="division">
                      Niveau <span className="text-destructive">*</span>
                    </Label>
                    <Select name="division" required>
                      <SelectTrigger className="bg-input border-border text-foreground w-full">
                        <SelectValue placeholder="Selecteer niveau" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIVISIONS.map((division) => (
                          <SelectItem
                            key={division.value}
                            value={division.value}
                          >
                            {division.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="province">
                      Provincie <span className="text-destructive">*</span>
                    </Label>
                    <Select name="province" required>
                      <SelectTrigger className="bg-input border-border text-foreground w-full">
                        <SelectValue placeholder="Selecteer provincie" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVINCES.map((province) => (
                          <SelectItem
                            key={province.value}
                            value={province.value}
                          >
                            {province.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    Omschrijf hier kort wat je precies zoekt
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Vertel meer over jezelf en wat je zoekt..."
                    rows={4}
                    className="bg-input border-border text-foreground"
                  />
                </div>
              </>
            )}

            {/* TYPE 4: Team seeks trainer */}
            {selectedType === "team_seeks_trainer" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="team_name">
                    Teamnaam/Club <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="team_name"
                    name="team_name"
                    placeholder="Bijv. Caruur Gent Volley"
                    required
                    className="bg-input border-border text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="province">
                      Provincie <span className="text-destructive">*</span>
                    </Label>
                    <Select name="province" required>
                      <SelectTrigger className="bg-input border-border text-foreground w-full">
                        <SelectValue placeholder="Selecteer provincie" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVINCES.map((province) => (
                          <SelectItem
                            key={province.value}
                            value={province.value}
                          >
                            {province.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="division">
                      Niveau <span className="text-destructive">*</span>
                    </Label>
                    <Select name="division" required>
                      <SelectTrigger className="bg-input border-border text-foreground w-full">
                        <SelectValue placeholder="Selecteer niveau" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIVISIONS.map((division) => (
                          <SelectItem
                            key={division.value}
                            value={division.value}
                          >
                            {division.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="geslacht">
                    Dames/Heren <span className="text-destructive">*</span>
                  </Label>
                  <Select name="geslacht" required>
                    <SelectTrigger className="bg-input border-border text-foreground w-full">
                      <SelectValue placeholder="Selecteer geslacht" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((gender) => (
                        <SelectItem key={gender.value} value={gender.value}>
                          {gender.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    Omschrijf hier kort wat jullie precies zoeken
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Vertel meer over je team en wat je zoekt..."
                    rows={4}
                    className="bg-input border-border text-foreground"
                  />
                </div>
              </>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-md text-destructive text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !selectedType}
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
