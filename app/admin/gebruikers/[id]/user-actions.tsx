"use client";

import { useId, useState, useTransition } from "react";
import { Ban, BadgeCheck, ShieldCheck, ShieldOff, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  liftSuspension,
  setModerator,
  setVerifiedSource,
  suspendUser,
} from "@/app/actions/users";
import { handleServerActionResponse } from "@/lib/client-utils";
import { useIsClient } from "@/lib/use-is-client";
import {
  SANCTION_NOTE_MAX_LENGTH,
  SUSPENSION_DURATIONS,
  SUSPENSION_REASON_MAX_LENGTH,
  type StaffUserRow,
  type SuspensionDuration,
} from "@/lib/sanctions";

type Form = "suspend" | "lift" | "badge" | "role";

/** Tomorrow as yyyy-mm-dd, the earliest end date the date picker offers. */
function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The admin's controls on a user (#80, D-016): suspend or lift, the verified
 * badge and the moderator role. The database checks again and logs each one.
 */
export function UserActions({
  user,
  isSelf,
}: {
  user: StaffUserRow;
  isSelf: boolean;
}) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Form | null>(null);
  const [duration, setDuration] = useState<SuspensionDuration>("7");
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  // Until hydration a click would do nothing; the buttons say so.
  const hydrated = useIsClient();

  const isStaff = user.role !== "user";
  const canSuspend = !isSelf && !isStaff;
  const canChangeRole = !isSelf && user.role !== "admin";

  function open(next: Form) {
    setForm(next);
    setText("");
    setDuration("7");
    setDate("");
  }

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    startTransition(async () => {
      let result;
      let successMessage;
      switch (form) {
        case "suspend":
          result = await suspendUser({
            userId: user.id,
            duration,
            // End of the picked day, in the admin's own time zone.
            until:
              duration === "date" && date
                ? new Date(`${date}T23:59:59`).toISOString()
                : undefined,
            reason: text,
          });
          successMessage = "Gebruiker geschorst";
          break;
        case "lift":
          result = await liftSuspension({ userId: user.id, note: text });
          successMessage = "Schorsing opgeheven";
          break;
        case "badge":
          result = await setVerifiedSource({
            userId: user.id,
            verified: !user.is_verified_source,
            note: text,
          });
          successMessage = user.is_verified_source
            ? "Badge ingetrokken"
            : "Badge toegekend";
          break;
        case "role":
          result = await setModerator({
            userId: user.id,
            moderator: user.role !== "moderator",
            note: text,
          });
          successMessage =
            user.role === "moderator"
              ? "Moderatorrol afgenomen"
              : "Gebruiker is nu moderator";
          break;
      }
      if (
        handleServerActionResponse(result, { successMessage }) !== undefined
      ) {
        setForm(null);
      }
    });
  }

  if (form) {
    const copy = {
      suspend: {
        title: user.is_suspended ? "Schorsing wijzigen" : "Gebruiker schorsen",
        explain:
          "De gebruiker kan nog inloggen en lezen, maar niets plaatsen, stemmen, berichten sturen of het profiel aanpassen. Bestaande inhoud blijft staan. De gebruiker ziet de reden.",
        textLabel: "Reden (de gebruiker ziet ze)",
        confirm: "Schorsing bevestigen",
      },
      lift: {
        title: "Schorsing opheffen",
        explain: "De gebruiker kan meteen weer alles doen.",
        textLabel: "Notitie voor het logboek (optioneel)",
        confirm: "Opheffen bevestigen",
      },
      badge: {
        title: user.is_verified_source ? "Badge intrekken" : "Badge toekennen",
        explain: user.is_verified_source
          ? "Het geverifieerd-vinkje verdwijnt overal bij deze gebruiker."
          : "Het geverifieerd-vinkje verschijnt bij de zoekertjes, geruchten en het profiel van deze gebruiker. Geef het alleen aan clubs en bronnen die je kon nagaan.",
        textLabel: "Notitie voor het logboek (optioneel)",
        confirm: user.is_verified_source
          ? "Intrekken bevestigen"
          : "Toekennen bevestigen",
      },
      role: {
        title:
          user.role === "moderator"
            ? "Moderatorrol afnemen"
            : "Moderator maken",
        explain:
          user.role === "moderator"
            ? "De gebruiker verliest meteen de toegang tot het beheer."
            : "De gebruiker krijgt toegang tot het beheer: geruchten nakijken, meldingen behandelen en gemelde gesprekken lezen.",
        textLabel: "Notitie voor het logboek (optioneel)",
        confirm: "Rol wijzigen bevestigen",
      },
    }[form];
    const textRequired = form === "suspend";
    const canConfirm =
      (!textRequired || text.trim().length > 0) &&
      (form !== "suspend" || duration !== "date" || date !== "");

    return (
      <form
        onSubmit={confirm}
        className="space-y-3 rounded-md border p-3"
        aria-label={copy.title}
      >
        <p className="font-medium">{copy.title}</p>
        <p className="text-sm">{copy.explain}</p>
        {form === "suspend" && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="space-y-1">
              <Label htmlFor={`${id}-duration`}>Hoe lang?</Label>
              <select
                id={`${id}-duration`}
                value={duration}
                onChange={(e) =>
                  setDuration(e.target.value as SuspensionDuration)
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs sm:w-48 dark:bg-input/30"
              >
                {Object.entries(SUSPENSION_DURATIONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {duration === "date" && (
              <div className="space-y-1">
                <Label htmlFor={`${id}-date`}>Tot en met</Label>
                <Input
                  id={`${id}-date`}
                  type="date"
                  min={tomorrow()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            )}
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor={`${id}-text`}>{copy.textLabel}</Label>
          <Textarea
            id={`${id}-text`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={
              textRequired
                ? SUSPENSION_REASON_MAX_LENGTH
                : SANCTION_NOTE_MAX_LENGTH
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant={
              form === "suspend" ||
              (form === "badge" && user.is_verified_source) ||
              (form === "role" && user.role === "moderator")
                ? "destructive"
                : "default"
            }
            disabled={pending || !canConfirm}
          >
            {copy.confirm}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setForm(null)}
            disabled={pending}
          >
            Annuleren
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canSuspend && (
          <Button
            variant="destructive"
            disabled={!hydrated}
            onClick={() => open("suspend")}
          >
            <Ban className="h-4 w-4" aria-hidden />
            {user.is_suspended ? "Schorsing wijzigen" : "Schorsen"}
          </Button>
        )}
        {user.is_suspended && (
          <Button
            variant="outline"
            disabled={!hydrated}
            onClick={() => open("lift")}
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            Schorsing opheffen
          </Button>
        )}
        <Button
          variant="outline"
          disabled={!hydrated}
          onClick={() => open("badge")}
        >
          <BadgeCheck className="h-4 w-4" aria-hidden />
          {user.is_verified_source ? "Badge intrekken" : "Badge toekennen"}
        </Button>
        {canChangeRole && !(user.role === "user" && user.is_suspended) && (
          <Button
            variant="outline"
            disabled={!hydrated}
            onClick={() => open("role")}
          >
            {user.role === "moderator" ? (
              <ShieldOff className="h-4 w-4" aria-hidden />
            ) : (
              <ShieldCheck className="h-4 w-4" aria-hidden />
            )}
            {user.role === "moderator"
              ? "Moderatorrol afnemen"
              : "Moderator maken"}
          </Button>
        )}
      </div>
      {isSelf ? (
        <p className="text-xs text-muted-foreground">
          Dit ben jij: je eigen rol en schorsing kan je niet wijzigen.
        </p>
      ) : user.role === "admin" ? (
        <p className="text-xs text-muted-foreground">
          Beheerders worden aangesteld door de eigenaar en kunnen niet geschorst
          worden.
        </p>
      ) : user.role === "moderator" ? (
        <p className="text-xs text-muted-foreground">
          Om een moderator te schorsen, neem je eerst de moderatorrol af.
        </p>
      ) : (
        user.is_suspended && (
          <p className="text-xs text-muted-foreground">
            Een geschorste gebruiker kan geen moderator worden.
          </p>
        )
      )}
    </div>
  );
}
