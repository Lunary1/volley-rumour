"use client";

import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  readReportedConversation,
  type ReportedMessage,
} from "@/app/actions/reports";
import { formatDate } from "@/lib/dates";

/**
 * The messages of a reported conversation, loaded only when the moderator
 * asks: every read is written to the audit log (#69).
 */
export function ReportedConversation({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  const [messages, setMessages] = useState<ReportedMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function read() {
    setError(null);
    startTransition(async () => {
      const result = await readReportedConversation({ reportId });
      if (result.success) setMessages(result.data);
      else setError(result.error);
    });
  }

  if (!messages) {
    return (
      <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
        <p className="text-muted-foreground">
          Berichten zijn privé. Je leest dit gesprek alleen via deze melding, en
          dat komt in het logboek.
        </p>
        <Button variant="outline" size="sm" onClick={read} disabled={pending}>
          <Eye className="h-4 w-4" aria-hidden />
          Gesprek lezen
        </Button>
        {error && (
          <p role="alert" className="text-destructive-text">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <section
      aria-label="Gemeld gesprek"
      className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm"
    >
      <p className="text-xs text-muted-foreground">Je inzage is gelogd.</p>
      {messages.length === 0 ? (
        <p className="text-muted-foreground">
          Dit gesprek heeft geen berichten.
        </p>
      ) : (
        <ol className="max-h-96 space-y-2 overflow-y-auto">
          {messages.map((message) => (
            <li
              key={message.message_id}
              className="rounded-md bg-background p-2"
            >
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {message.sender_username ?? "Verwijderd account"}
                </span>{" "}
                · {formatDate(message.sent_at, "d MMM yyyy HH:mm")}
              </p>
              <p className="whitespace-pre-line wrap-break-word">
                {message.body}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
