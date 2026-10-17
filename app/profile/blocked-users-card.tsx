import { Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UnblockButton } from "@/components/block-user-dialog";
import { formatDate } from "@/lib/dates";

export interface BlockedUser {
  id: string;
  username: string;
  blockedAt: string;
}

/** The users I blocked, each with "Deblokkeren" (#73, J-07). */
export function BlockedUsersCard({ users }: { users: BlockedUser[] }) {
  return (
    <Card className="mb-6 border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <Ban className="h-5 w-5 text-accent" />
          Geblokkeerde gebruikers
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Wie je blokkeert, kan je geen berichten sturen en jij hen ook niet.
        </p>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Je hebt niemand geblokkeerd.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {user.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Geblokkeerd op {formatDate(user.blockedAt, "d MMMM yyyy")}
                  </p>
                </div>
                <UnblockButton
                  userId={user.id}
                  userName={user.username}
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
