import { User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CLASSIFIED_TYPE_LABELS, isPersonAd } from "@/lib/classifieds-utils";

/**
 * What kind of zoekertje this is (#207). Team ads get a filled label with a
 * group icon, ads by a player or trainer an outlined one with a person icon:
 * told apart by shape, never by hue alone.
 */
export function ClassifiedTypeLabel({ type }: { type: string }) {
  const person = isPersonAd(type);
  const Icon = person ? User : Users;
  return (
    <Badge
      variant={person ? "subtle" : "neutral"}
      size="pill"
      data-type-label={person ? "person" : "team"}
    >
      <Icon aria-hidden />
      {CLASSIFIED_TYPE_LABELS[type] ?? type}
    </Badge>
  );
}
