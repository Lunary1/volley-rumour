"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  updateProfile,
  updatePassword,
  getProfileStats,
} from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy,
  Flame,
  MessageSquare,
  CheckCircle,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  email?: string;
  trust_score: number;
}

interface Stats {
  rumourCount: number;
  voteCount: number;
  confirmedCount: number;
  classifiedCount: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Je bent niet ingelogd");
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setUsername(profileData.username);
        setAvatarUrl(profileData.avatar_url || "");

        // Load stats
        const { count: rumourCount } = await supabase
          .from("rumours")
          .select("id", { count: "exact" })
          .eq("creator_id", user.id);

        const { count: voteCount } = await supabase
          .from("rumour_votes")
          .select("id", { count: "exact" })
          .eq("user_id", user.id);

        const { count: confirmedCount } = await supabase
          .from("rumours")
          .select("id", { count: "exact" })
          .eq("creator_id", user.id)
          .eq("status", "confirmed");

        const { count: classifiedCount } = await supabase
          .from("classifieds")
          .select("id", { count: "exact" })
          .eq("author_id", user.id);

        setStats({
          rumourCount: rumourCount || 0,
          voteCount: voteCount || 0,
          confirmedCount: confirmedCount || 0,
          classifiedCount: classifiedCount || 0,
        });
      }
    } catch (err) {
      setError("Kon profiel niet laden");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("username", username);
    formData.append("avatar_url", avatarUrl);

    const result = await updateProfile(formData);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Profiel bijgewerkt!");
      setProfile((p) =>
        p ? { ...p, username, avatar_url: avatarUrl || null } : null,
      );
    }

    setSubmitting(false);
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("Wachtwoorden komen niet overeen");
      setSubmitting(false);
      return;
    }

    if (newPassword.length < 8) {
      setError("Wachtwoord moet minimaal 8 tekens zijn");
      setSubmitting(false);
      return;
    }

    const result = await updatePassword(currentPassword, newPassword);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Wachtwoord bijgewerkt!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Laden...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Je bent niet ingelogd</p>
          <Link href="/auth/login">
            <Button>Inloggen</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/leaderboard">
            <Button variant="outline" className="mb-4">
              ← Terug naar leaderboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Mijn Profiel</h1>
          <p className="text-muted-foreground mt-1">
            Beheer je accountgegevens en bekijk je statistieken
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <Card className="mb-6 border-red-500 bg-red-50 dark:bg-red-950">
            <CardContent className="pt-6">
              <p className="text-red-700 dark:text-red-200">{error}</p>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
            <CardContent className="pt-6">
              <p className="text-green-700 dark:text-green-200">{success}</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="stats">Statistieken</TabsTrigger>
            <TabsTrigger value="profile">Profiel</TabsTrigger>
            <TabsTrigger value="security">Beveiliging</TabsTrigger>
          </TabsList>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Jouw Statistieken</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex flex-col items-center p-4 rounded-lg border">
                    <Trophy className="h-6 w-6 text-amber-500 mb-2" />
                    <p className="text-2xl font-bold">
                      {profile.trust_score || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Trust Score</p>
                  </div>

                  <div className="flex flex-col items-center p-4 rounded-lg border">
                    <Flame className="h-6 w-6 text-orange-500 mb-2" />
                    <p className="text-2xl font-bold">{stats?.rumourCount}</p>
                    <p className="text-sm text-muted-foreground">Geruchten</p>
                  </div>

                  <div className="flex flex-col items-center p-4 rounded-lg border">
                    <MessageSquare className="h-6 w-6 text-blue-500 mb-2" />
                    <p className="text-2xl font-bold">{stats?.voteCount}</p>
                    <p className="text-sm text-muted-foreground">Stemmen</p>
                  </div>

                  <div className="flex flex-col items-center p-4 rounded-lg border">
                    <CheckCircle className="h-6 w-6 text-green-500 mb-2" />
                    <p className="text-2xl font-bold">
                      {stats?.confirmedCount}
                    </p>
                    <p className="text-sm text-muted-foreground">Bevestigd</p>
                  </div>

                  <div className="flex flex-col items-center p-4 rounded-lg border md:col-span-4">
                    <ShoppingBag className="h-6 w-6 text-purple-500 mb-2" />
                    <p className="text-2xl font-bold">
                      {stats?.classifiedCount}
                    </p>
                    <p className="text-sm text-muted-foreground">Zoekertjes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Over Trust Score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  • <strong>+5 punten</strong> wanneer je gerucht wordt
                  bevestigd
                </p>
                <p>
                  • <strong>+1 punt</strong> per upvote dat je gerucht ontvangt
                </p>
                <p>
                  Trust Score bepaalt hoe betrouwbaar je bent in de community
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profielbeheer</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div>
                    <Label>Avatar URL</Label>
                    <div className="flex gap-4 mt-2">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={avatarUrl} alt={username} />
                        <AvatarFallback>
                          {username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Input
                        placeholder="https://example.com/avatar.jpg"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Plak hier de URL van je favoriete profielfoto. Gebruik
                      externe image hosters zoals Imgur of Gravatar
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="username">Gebruikersnaam</Label>
                    <Input
                      id="username"
                      placeholder="Jouw gebruikersnaam"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      minLength={2}
                      disabled={submitting}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimaal 2 tekens
                    </p>
                  </div>

                  <div>
                    <Label>E-mailadres (niet wijzigbaar)</Label>
                    <Input
                      value={profile.email || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting ? "Bezig met opslaan..." : "Profiel Bijwerken"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Wachtwoord Wijzigen</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <Label htmlFor="current-password">Huidig Wachtwoord</Label>
                    <Input
                      id="current-password"
                      type="password"
                      placeholder="Voer je huidige wachtwoord in"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <Label htmlFor="new-password">Nieuw Wachtwoord</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Voer je nieuwe wachtwoord in"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={submitting}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimaal 8 tekens
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="confirm-password">
                      Bevestig Nieuw Wachtwoord
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Herhaal je nieuwe wachtwoord"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting
                      ? "Bezig met bijwerken..."
                      : "Wachtwoord Wijzigen"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
              <CardHeader>
                <CardTitle className="text-amber-900 dark:text-amber-100">
                  Veiligheidstips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                <p>• Gebruik een sterk, uniek wachtwoord</p>
                <p>• Deel je wachtwoord met niemand</p>
                <p>• Controleer regelmatig je accountactiviteit</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
