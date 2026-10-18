"use client";

import { useState } from "react";
import {
  updateProfile,
  updatePassword,
  uploadAvatar,
  removeAvatar,
  type RecentRumour,
  type RecentClassified,
} from "@/app/actions/profile";
import { deleteAccount, sendPasswordSetupLink } from "@/app/actions/auth";
import { handleServerActionResponse } from "@/lib/client-utils";
import {
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_BYTES,
  AVATAR_SIZE_MESSAGE,
  avatarUrl,
} from "@/lib/avatar";
import { PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE } from "@/lib/schemas";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Flame,
  MessageSquare,
  CheckCircle,
  ShoppingBag,
  Pencil,
  Shield,
  Activity,
  Zap,
  Target,
  Mail,
  Instagram,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsClient } from "@/lib/use-is-client";
import { VerifiedBadge } from "@/components/verified-badge";
import { BlockedUsersCard, type BlockedUser } from "./blocked-users-card";
import {
  REJECTION_REASONS,
  RUMOUR_STATUS_LABELS,
  TRUSTED_SOURCE_MIN_RESOLVED,
  formatTrackRecord,
  type RejectionReason,
  type RumourStatus,
  type TrackRecord,
} from "@/lib/rumours";
import { RelativeTime } from "@/components/relative-time";

export interface Profile extends TrackRecord {
  id: string;
  username: string;
  avatar_path: string | null;
  email?: string;
  is_verified_source?: boolean;
  instagram_url?: string | null;
  source_description?: string | null;
}

export interface Stats {
  rumourCount: number;
  voteCount: number;
  classifiedCount: number;
}

interface ProfileViewProps {
  initialProfile: Profile;
  stats: Stats;
  recentActivity: {
    rumours: RecentRumour[];
    classifieds: RecentClassified[];
  } | null;
  blockedUsers: BlockedUser[];
}

export function ProfileView({
  initialProfile,
  stats,
  recentActivity,
  blockedUsers,
}: ProfileViewProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [username, setUsername] = useState(initialProfile.username);
  const [avatarSrc, setAvatarSrc] = useState(
    avatarUrl(initialProfile.avatar_path),
  );
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [setupLinkSending, setSetupLinkSending] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("username", username);

    const result = await updateProfile(formData);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Profiel bijgewerkt!");
      setProfile((p) => ({ ...p, username }));
      setEditModalOpen(false);
    }

    setSubmitting(false);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // picking the same file again still uploads
    if (!file) return;
    // Checked here for a quick answer; the server checks again.
    if (file.size > AVATAR_MAX_BYTES) {
      handleServerActionResponse({
        success: false,
        error: AVATAR_SIZE_MESSAGE,
      });
      return;
    }
    setAvatarBusy(true);
    const formData = new FormData();
    formData.append("avatar", file);
    const data = handleServerActionResponse(await uploadAvatar(formData), {
      successMessage: "Je profielfoto is bijgewerkt.",
    });
    if (data) {
      setAvatarSrc(data.avatarUrl);
      router.refresh();
    }
    setAvatarBusy(false);
  }

  async function handleAvatarRemove() {
    setAvatarBusy(true);
    const result = await removeAvatar();
    handleServerActionResponse(result, {
      successMessage: "Je profielfoto is verwijderd.",
    });
    if (result.success) {
      setAvatarSrc(null);
      router.refresh();
    }
    setAvatarBusy(false);
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
    handleServerActionResponse(result, {
      successMessage: "Je account is verwijderd.",
    });
    if (result.success) {
      router.replace("/");
    } else {
      setDeleting(false);
    }
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

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(PASSWORD_MIN_MESSAGE);
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

  // D-005: how often this contributor was right, counted by the database
  const trackRecord = formatTrackRecord(profile);
  const resolvedCount = profile.rumours_confirmed + profile.rumours_denied;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Profile header */}
        <Card className="mb-6 overflow-hidden border-border bg-card">
          <div className="bg-muted/30 px-6 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-6">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
              <Avatar className="h-24 w-24 border-4 border-background shadow-md sm:h-28 sm:w-28">
                <AvatarImage
                  src={avatarSrc ?? undefined}
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
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-border"
                onClick={() => setEditModalOpen(true)}
                disabled={!isClient}
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
                  {profile.rumours_confirmed}
                </p>
                <p className="text-xs text-muted-foreground">Bevestigd</p>
              </div>
              <Link
                href="/zoekertjes/mijn"
                className="flex flex-col items-center rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40"
              >
                <ShoppingBag className="mb-2 h-6 w-6 text-purple-500" />
                <p className="text-2xl font-bold text-foreground">
                  {stats?.classifiedCount ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Zoekertjes</p>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* My rumours and track record (J-10, #88, D-005) */}
        <Card className="mb-6 border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <CheckCircle className="h-5 w-5 text-accent" />
              Mijn geruchten
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Track record
              </p>
              <p className="text-2xl font-bold text-foreground">
                {trackRecord ?? "Nog geen afgeronde geruchten"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Telt de geruchten die een moderator bevestigde of ontkrachtte.
                Niet bevestigde geruchten en stemmen tellen niet mee.
                {resolvedCount < TRUSTED_SOURCE_MIN_RESOLVED &&
                  ` Vanaf ${TRUSTED_SOURCE_MIN_RESOLVED} afgeronde geruchten kan je bij de betrouwbare bronnen staan.`}
              </p>
            </div>
            {recentActivity?.rumours && recentActivity.rumours.length > 0 ? (
              <div>
                <ul aria-label="Mijn geruchten" className="space-y-2">
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
                          {RUMOUR_STATUS_LABELS[r.status as RumourStatus] ??
                            r.status}
                        </Badge>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          <RelativeTime date={r.created_at} />
                        </span>
                      </Link>
                      {r.status === "rejected" && r.rejection_reason && (
                        <p className="mt-1 px-3 text-xs text-muted-foreground">
                          Reden:{" "}
                          {REJECTION_REASONS[
                            r.rejection_reason as RejectionReason
                          ] ?? r.rejection_reason}
                          {r.rejection_note && ` — ${r.rejection_note}`}
                        </p>
                      )}
                      {/* Neutral on purpose: the author isn't told who asked
                          for the removal (Takedown Process). */}
                      {r.status === "removed" && (
                        <p className="mt-1 px-3 text-xs text-muted-foreground">
                          Een moderator heeft dit gerucht van de site gehaald.
                          {r.removal_note && ` ${r.removal_note}`}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="py-2 text-center text-sm text-muted-foreground">
                Je hebt nog geen geruchten gedeeld.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="mb-6 border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Activity className="h-5 w-5 text-accent" />
              Recente zoekertjes
            </CardTitle>
          </CardHeader>
          {/* Profile → "Mijn zoekertjes" (#72, J-05). */}
          <div className="px-6 pb-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/zoekertjes/mijn">
                <ShoppingBag className="h-4 w-4" aria-hidden />
                Mijn zoekertjes
              </Link>
            </Button>
          </div>
          <CardContent className="space-y-4">
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
                          href="/zoekertjes/mijn"
                          className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                        >
                          <ShoppingBag className="h-4 w-4 text-purple-500" />
                          <span className="truncate font-medium text-foreground">
                            {c.title}
                          </span>
                          {c.removed_at && (
                            <Badge
                              variant="outline"
                              className="ml-auto shrink-0 text-xs"
                            >
                              Verwijderd
                            </Badge>
                          )}
                          <span
                            className={`${c.removed_at ? "" : "ml-auto "}shrink-0 text-xs text-muted-foreground`}
                          >
                            <RelativeTime date={c.created_at} />
                          </span>
                        </Link>
                        {c.removed_at && (
                          <p className="mt-1 px-3 text-xs text-muted-foreground">
                            Een moderator heeft dit zoekertje van de site
                            gehaald.
                            {c.removal_note && ` ${c.removal_note}`}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {!recentActivity?.classifieds?.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nog geen zoekertjes. Plaats er een!
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

        <BlockedUsersCard users={blockedUsers} />

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
                  placeholder={`Min. ${PASSWORD_MIN_LENGTH} tekens`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
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
            {/* #58 – Google-only accounts have no current password to fill in */}
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Via Google aangemeld en nog geen wachtwoord, of je huidige
                wachtwoord vergeten? Dan sturen we je een link om een nieuw
                wachtwoord in te stellen.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={setupLinkSending}
                onClick={async () => {
                  setSetupLinkSending(true);
                  handleServerActionResponse(await sendPasswordSetupLink(), {
                    successMessage:
                      "Check je mailbox voor de link om je wachtwoord in te stellen.",
                  });
                  setSetupLinkSending(false);
                }}
              >
                {setupLinkSending ? "Bezig..." : "Stuur me een link"}
              </Button>
            </div>
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
              disabled={!isClient}
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
              Je profiel, je zoekertjes, je stemmen en al je gesprekken met de
              berichten erin worden permanent verwijderd, net als geruchten die
              nog niet gepubliceerd zijn. Gepubliceerde geruchten blijven
              zichtbaar, zonder je naam.
              <br />
              <br />
              Typ <strong>VERWIJDER</strong> om te bevestigen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <Input
              aria-label="Typ VERWIJDER om te bevestigen"
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
              Wijzig je profielfoto of gebruikersnaam.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <span className="text-sm font-medium">Profielfoto</span>
              <div className="mt-2 flex items-center gap-3">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarImage
                    src={avatarSrc ?? undefined}
                    alt="Je profielfoto"
                  />
                  <AvatarFallback>
                    {username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-2">
                  {/* Uploads as soon as a file is picked; no name, so it is
                      never part of the username form. */}
                  <input
                    id="avatar-file"
                    type="file"
                    accept={AVATAR_ACCEPTED_TYPES.join(",")}
                    onChange={handleAvatarChange}
                    disabled={!isClient || avatarBusy}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor="avatar-file"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "cursor-pointer peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50",
                    )}
                  >
                    {avatarBusy ? "Bezig..." : "Foto kiezen"}
                  </label>
                  {avatarSrc && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAvatarRemove}
                      disabled={!isClient || avatarBusy}
                    >
                      Foto verwijderen
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                JPG, PNG of WebP, maximaal 5 MB. Iedereen kan je profielfoto
                zien.
              </p>
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
