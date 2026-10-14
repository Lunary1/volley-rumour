import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type StaffUserRow } from "@/lib/sanctions";

/** Role, badge and suspension at a glance, for the list and detail page. */
export function UserStatusBadges({ user }: { user: StaffUserRow }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {user.role !== "user" && (
        <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
      )}
      {user.is_verified_source && <Badge variant="outline">Geverifieerd</Badge>}
      {user.is_suspended && <Badge variant="destructive">Geschorst</Badge>}
    </span>
  );
}
