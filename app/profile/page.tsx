"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  updateProfile,
  updatePassword,
  getRecentActivity,
  type RecentRumour,
  type RecentClassified,
} from "@/app/actions/profile";
import { deleteAccount } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Trophy,
  Flame,
  MessageSquare,
  CheckCircle,
  ShoppingBag,
  Pencil,
  Shield,
  Activity,
  Zap,
  Award,
  Target,
  Mail,
  Instagram,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { VerifiedBadge } from "@/components/verified-badge";

const TRUST_TIERS = [
  { min: 100, label: "Legende", color: "bg-yellow-500 text-yellow-950" },
  { min: 50, label: "Expert", color: "bg-primary text-primary-foreground" },
  { min: 20, label: "Betrouwbaar", color: "bg-blue-500 text-blue-950" },
  { min: 5, label: "Actief", color: "bg-secondary text-secondary-foreground" },
  { min: 0, label: "Nieuwkomer", color: "bg-muted text-muted-foreground" },
] as const;

const TRUST_CAP = 100; // For progress bar display

function getTrustBadge(score: number) {
  const tier =
    TRUST_TIERS.find((t) => score >= t.min) ??
    TRUST_TIERS[TRUST_TIERS.length - 1];
  return { label: tier.label, color: tier.color };
}

function getTrustProgress(score: number) {
  return Math.min(score, TRUST_CAP);
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  email?: string;
  trust_score: number;
  is_verified_source?: boolean;
  instagram_url?: string | null;
  source_description?: string | null;
}

interface Stats {
  rumourCount: number;
  voteCount: number;
  confirmedCount: number;
  classifiedCount: number;
}

// Achievements derived from stats (no backend table)
function getAchievements(stats: Stats | null) {
  if (!stats) return [];
  const a: {
    id: string;
    label: string;
    icon: React.ReactNode;
    earned: boolean;
  }[] = [
    {
      id: "first-rumour",
      label: "Eerste gerucht",
      icon: <Flame className="h-4 w-4" />,
      earned: stats.rumourCount >= 1,
    },
    {
      id: "ten-confirmed",
      label: "10 bevestigd",
      icon: <CheckCircle className="h-4 w-4" />,
      earned: stats.confirmedCount >= 10,
    },
    {
      id: "active-voter",
      label: "Actieve stemmer",
      icon: <MessageSquare className="h-4 w-4" />,
      earned: stats.voteCount >= 10,
    },
    {
      id: "classifieds-seller",
      label: "Zoekertjes",
      icon: <ShoppingBag className="h-4 w-4" />,
      earned: stats.classifiedCount >= 1,
    },
    {
      id: "trusted-source",
      label: "Betrouwbare bron",
      icon: <Award className="h-4 w-4" />,
      earned: stats.confirmedCount >= 1 && stats.rumourCount >= 1,
    },
  ];
  return a;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentActivity, setRecentActivity] = useState<{
    rumours: RecentRumour[];
    classifieds: RecentClassified[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);

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
          .eq("user_id", user.id);

        setStats({
          rumourCount: rumourCount || 0,
          voteCount: voteCount || 0,
          confirmedCount: confirmedCount || 0,
          classifiedCount: classifiedCount || 0,
        });
      }

      const activity = await getRecentActivity();
      setRecentActivity(activity || null);
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
      setEditModalOpen(false);
    }

    setSubmitting(false);
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (deleteConfirmInput !== "VERWIJDER") {
      setError('Typ "VERWIJDER" om te bevestigen');
      return;
    }
    setDeleting(true);
    setError(null);
    const result = await deleteAccount();
    if (result?.error) {
      setError(result.error);
      setDeleting(false);
    }
    // On success the server action redirects — nothing more to do here
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Je bent niet ingelogd</p>
          <Link href="/auth/login">
            <Button>Inloggen</Button>
          </Link>
        </div>
      </div>
    );
  }

  const trustScore = profile.trust_score ?? 0;
  const trustBadge = getTrustBadge(trustScore);
  const trustProgress = getTrustProgress(trustScore);
  const achievements = getAchievements(stats);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back link */}
        <div className="mb-6">
          <Link href="/leaderboard">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              ← Leaderboard
            </Button>
          </Link>
        </div>

        {/* Profile header */}
        <Card className="mb-6 overflow-hidden border-border bg-card">
          <div className="bg-muted/30 px-6 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-6">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
              <Avatar className="h-24 w-24 border-4 border-background shadow-md sm:h-28 sm:w-28">
                <AvatarImage
                  src={profile.avatar_url || undefined}
                  alt={profile.username}
                />
                <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                  {profile.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl flex items-center gap-2">
                  {profile.username}
                  {profile.is_verified_source && <VerifiedBadge size="lg" />}
                </h1>
                {profile.email && (
                  <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
                    <Mail className="h-4 w-4" />
                    <span>{profile.email}</span>
                  </div>
                )}
                <Badge className={trustBadge.color}>{trustBadge.label}</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-border"
                onClick={() => setEditModalOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Bewerk profiel
              </Button>
            </div>
          </div>

          {/* Verified source info */}
          {profile.is_verified_source && (
            <div className="px-6 pb-4 sm:px-8 sm:pb-6 border-t border-border pt-4 space-y-2">
              {profile.source_description && (
                <p className="text-sm text-muted-foreground">
                  {profile.source_description}
                </p>
              )}
              {profile.instagram_url && (
                <a
                  href={profile.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Instagram className="h-4 w-4" />
                  Instagram
                </a>
              )}
            </div>
          )}
        </Card>

        {/* Trust score visualization */}
        <Card className="mb-6 border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Trophy className="h-5 w-5 text-accent" />
              Trust Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">
                {trustScore}
              </span>
              <span className="text-muted-foreground">punten</span>
            </div>
            <div className="space-y-2">
              <Progress value={trustProgress} className="h-3" />
              <p className="text-xs text-muted-foreground">
                +5 bij bevestigd gerucht, +1 per upvote. Streef naar 100 voor
                Legende.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Achievements / badges */}
        <Card className="mb-6 border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Award className="h-5 w-5 text-accent" />
              Prestaties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {achievements.map((a) => (
                <Badge
                  key={a.id}
                  variant={a.earned ? "default" : "outline"}
                  className={
                    a.earned
                      ? "gap-1 bg-primary/90 text-primary-foreground"
                      : "gap-1 opacity-60"
                  }
                >
                  {a.icon}
                  {a.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Statistics panel */}
        <Card className="mb-6 border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Target className="h-5 w-5 text-accent" />
              Statistieken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex flex-col items-center rounded-lg border border-border bg-muted/20 p-4">
                <Flame className="mb-2 h-6 w-6 text-orange-500" />
                <p className="text-2xl font-bold text-foreground">
                  {stats?.rumourCount ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Geruchten</p>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border bg-muted/20 p-4">
                <MessageSquare className="mb-2 h-6 w-6 text-blue-500" />
                <p className="text-2xl font-bold text-foreground">
                  {stats?.voteCount ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Stemmen</p>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border bg-muted/20 p-4">
                <CheckCircle className="mb-2 h-6 w-6 text-green-500" />
                <p className="text-2xl font-bold text-foreground">
                  {stats?.confirmedCount ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Bevestigd</p>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border bg-muted/20 p-4">
                <ShoppingBag className="mb-2 h-6 w-6 text-purple-500" />
                <p className="text-2xl font-bold text-foreground">
                  {stats?.classifiedCount ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Zoekertjes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="mb-6 border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Activity className="h-5 w-5 text-accent" />
              Recente activiteit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity?.rumours && recentActivity.rumours.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  Geruchten
                </p>
                <ul className="space-y-2">
                  {recentActivity.rumours.map((r) => (
                    <li key={r.id}>
                      <Link
                        href="/geruchten"
                        className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                      >
                        <Zap className="h-4 w-4 text-orange-500" />
                        <span className="truncate font-medium text-foreground">
                          {r.player_name}
                        </span>
                        <Badge
                          variant="outline"
                          className="ml-auto shrink-0 text-xs"
                        >
                          {r.status}
                        </Badge>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(r.created_at), {
                            addSuffix: true,
                            locale: nl,
                          })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recentActivity?.classifieds &&
              recentActivity.classifieds.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    Zoekertjes
                  </p>
                  <ul className="space-y-2">
                    {recentActivity.classifieds.map((c) => (
                      <li key={c.id}>
                        <Link
                          href="/zoekertjes"
                          className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                        >
                          <ShoppingBag className="h-4 w-4 text-purple-500" />
                          <span className="truncate font-medium text-foreground">
                            {c.title}
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(c.created_at), {
                              addSuffix: true,
                              locale: nl,
                            })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {!recentActivity?.rumours?.length &&
              !recentActivity?.classifieds?.length && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nog geen recente activiteit. Deel een gerucht of plaats een
                  zoekertje!
                </p>
              )}
          </CardContent>
        </Card>

        {/* Error/Success */}
        {error && (
          <Card className="mb-6 border-red-500 bg-red-500/10">
            <CardContent className="pt-6">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}
        {success && (
          <Card className="mb-6 border-green-500 bg-green-500/10">
            <CardContent className="pt-6">
              <p className="text-green-600 dark:text-green-400">{success}</p>
            </CardContent>
          </Card>
        )}

        {/* Security / Password */}
        <Card className="mb-6 border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Shield className="h-5 w-5 text-accent" />
              Beveiliging
            </CardTitle>
            <p className="text-sm text-muted-foreground">Wachtwoord wijzigen</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <Label htmlFor="current-password">Huidig wachtwoord</Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="Huidige wachtwoord"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={submitting}
                  className="mt-2 border-border bg-background"
                />
              </div>
              <div>
                <Label htmlFor="new-password">Nieuw wachtwoord</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Min. 8 tekens"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={submitting}
                  className="mt-2 border-border bg-background"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">
                  Bevestig nieuw wachtwoord
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Herhaal nieuw wachtwoord"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={submitting}
                  className="mt-2 border-border bg-background"
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Bezig..." : "Wachtwoord wijzigen"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Danger zone – account deletion */}
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <Trash2 className="h-5 w-5" />
              Gevaarzone
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Account permanent verwijderen — deze actie is onomkeerbaar.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteConfirmInput("");
                setDeleteModalOpen(true);
              }}
            >
              Account verwijderen
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete account confirmation dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Account verwijderen
            </DialogTitle>
            <DialogDescription>
              Al je berichten en gesprekken worden permanent verwijderd. Je
              geruchten en zoekertjes blijven zichtbaar maar worden
              geanonimiseerd.
              <br />
              <br />
              Typ <strong>VERWIJDER</strong> om te bevestigen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <Input
              placeholder="VERWIJDER"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              className="border-border bg-background"
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
              >
                Annuleren
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleting || deleteConfirmInput !== "VERWIJDER"}
              >
                {deleting ? "Bezig..." : "Permanent verwijderen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit profile modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bewerk profiel</DialogTitle>
            <DialogDescription>
              Wijzig je gebruikersnaam of profielfoto (URL).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <Label>Avatar URL</Label>
              <div className="mt-2 flex gap-3">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarImage src={avatarUrl || undefined} alt={username} />
                  <AvatarFallback>
                    {username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Input
                  placeholder="https://..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="border-border bg-background"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="modal-username">Gebruikersnaam</Label>
              <Input
                id="modal-username"
                placeholder="Gebruikersnaam"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={2}
                disabled={submitting}
                className="mt-2 border-border bg-background"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Opslaan..." : "Opslaan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
