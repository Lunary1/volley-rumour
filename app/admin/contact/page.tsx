import Link from "next/link";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  CONTACT_CATEGORIES,
  type ContactCategory,
  type ContactStatus,
} from "@/lib/contact";
import { When } from "../meldingen/shared";
import { ContactActions } from "./contact-actions";

// Messages from the contact form (#81, D-017), oldest open first, then the
// latest handled ones. Staff answer by email, by hand, and mark the message
// handled; that goes in the audit log. The admin layout already let only
// staff through; RLS shows the table to staff only.

const OPEN_LIMIT = 50;
const HANDLED_LIMIT = 20;

interface ContactMessageRow {
  id: string;
  category: ContactCategory;
  sender_name: string | null;
  sender_email: string | null;
  message: string | null;
  user_id: string | null;
  status: ContactStatus;
  handled_note: string | null;
  handled_at: string | null;
  created_at: string;
  account: { username: string } | null;
}

const MESSAGE_COLUMNS =
  "id, category, sender_name, sender_email, message, user_id, status, handled_note, handled_at, created_at, account:user_id(username)";

function MessageCard({ message }: { message: ContactMessageRow }) {
  const mailto =
    message.sender_email &&
    `mailto:${message.sender_email}?subject=${encodeURIComponent(
      "Je bericht aan VolleyRumours",
    )}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {CONTACT_CATEGORIES[message.category] ?? message.category}
          </Badge>
          {message.status === "handled" && (
            <Badge variant="secondary">Afgehandeld</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            Ontvangen <When date={message.created_at} />
            {message.handled_at && (
              <>
                {" "}
                · afgehandeld <When date={message.handled_at} />
              </>
            )}
          </span>
        </div>
        <CardTitle className="text-lg">
          <h3>{message.sender_name ?? "Gewist na 12 maanden"}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          {message.sender_email && mailto && (
            <>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="min-w-0">
                <a
                  href={mailto}
                  className="inline-flex items-center gap-1 break-all text-primary underline underline-offset-2"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {message.sender_email}
                </a>
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Account</dt>
          <dd>
            {message.user_id ? (
              <Link
                href={`/admin/gebruikers/${message.user_id}`}
                className="text-primary underline underline-offset-2"
              >
                {message.account?.username ?? "Bekijk gebruiker"}
              </Link>
            ) : (
              "Niet ingelogd"
            )}
          </dd>
        </dl>
        {message.message && (
          <p className="whitespace-pre-line text-sm">{message.message}</p>
        )}
        {message.handled_note && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Interne notitie</p>
            <p className="whitespace-pre-line text-muted-foreground">
              {message.handled_note}
            </p>
          </div>
        )}

        {message.status === "open" && <ContactActions messageId={message.id} />}
      </CardContent>
    </Card>
  );
}

export default async function ContactMessagesPage() {
  const supabase = await createClient();
  const [open, handled] = await Promise.all([
    supabase
      .from("contact_messages")
      .select(MESSAGE_COLUMNS, { count: "exact" })
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(OPEN_LIMIT),
    supabase
      .from("contact_messages")
      .select(MESSAGE_COLUMNS)
      .eq("status", "handled")
      .order("handled_at", { ascending: false })
      .limit(HANDLED_LIMIT),
  ]);
  const failed = Boolean(open.error || handled.error);
  const openMessages = (open.data ?? []) as unknown as ContactMessageRow[];
  const handledMessages = (handled.data ??
    []) as unknown as ContactMessageRow[];
  const count = open.count ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Contact</h2>
        <p className="text-sm text-muted-foreground">
          Berichten uit het contactformulier, oudste eerst. Antwoord per mail en
          markeer het bericht daarna als afgehandeld; dat komt in het logboek.
          Naam, e-mailadres en bericht worden 12 maanden na het afhandelen
          gewist.
        </p>
      </div>

      {failed ? (
        <p className="text-destructive-text">
          De berichten konden niet geladen worden.
        </p>
      ) : (
        <>
          <section className="space-y-4" aria-labelledby="open-berichten">
            <h3 id="open-berichten" className="text-lg font-semibold">
              Open
            </h3>
            {openMessages.length === 0 ? (
              <p className="text-muted-foreground">Geen open berichten.</p>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {count === 1
                    ? "1 bericht wacht op antwoord."
                    : `${count} berichten wachten op antwoord.`}
                </p>
                <ul aria-label="Open berichten" className="space-y-4">
                  {openMessages.map((message) => (
                    <li key={message.id}>
                      <MessageCard message={message} />
                    </li>
                  ))}
                </ul>
                {count > OPEN_LIMIT && (
                  <p className="text-xs text-muted-foreground">
                    De oudste {OPEN_LIMIT} worden getoond.
                  </p>
                )}
              </>
            )}
          </section>

          {handledMessages.length > 0 && (
            <section className="space-y-4" aria-labelledby="afgehandeld">
              <h3 id="afgehandeld" className="text-lg font-semibold">
                Recent afgehandeld
              </h3>
              <ul aria-label="Afgehandelde berichten" className="space-y-4">
                {handledMessages.map((message) => (
                  <li key={message.id}>
                    <MessageCard message={message} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
