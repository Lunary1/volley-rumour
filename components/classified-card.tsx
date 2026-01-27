import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

interface ClassifiedCardProps {
  classified: {
    id: string;
    title: string;
    classified_type: string;
    description: string;
    location: string | null;
    contact_email: string;
    created_at: string;
    author: {
      username: string;
    };
  };
}

const classifiedTypeLabels: Record<string, string> = {
  player_seeking_team: "Speler zoekt team",
  team_seeking_player: "Team zoekt speler",
  coach_seeking_team: "Trainer zoekt team",
  team_seeking_coach: "Team zoekt trainer",
};

const classifiedTypeColors: Record<string, string> = {
  player_seeking_team: "bg-primary/20 text-primary border-primary/30",
  team_seeking_player: "bg-accent/20 text-accent border-accent/30",
  coach_seeking_team: "bg-chart-3/20 text-chart-3 border-chart-3/30",
  team_seeking_coach: "bg-chart-4/20 text-chart-4 border-chart-4/30",
};

export function ClassifiedCard({ classified }: ClassifiedCardProps) {
  const isFeatured = classified.featured_until && new Date(classified.featured_until) > new Date();
  return (
    <Card className={`bg-card border-border dark:border-neon-magenta/30 hover:dark:border-neon-magenta/60 transition-all dark:hover:shadow-[0_0_20px_rgba(216,180,254,0.15)] ${
      isFeatured ? "featured-item-glow" : ""
    }`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <Badge
            variant="outline"
            className={classifiedTypeColors[classified.classified_type]}
          >
            {classifiedTypeLabels[classified.classified_type]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(classified.created_at), {
              addSuffix: true,
              locale: nl,
            })}
          </span>
        </div>

        <h3 className="text-lg font-semibold mb-2 text-balance">
          {classified.title}
        </h3>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {classified.description}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-4">
          {classified.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>{classified.location}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>Door {classified.author.username}</span>
          </div>
        </div>

        <Button
          size="sm"
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Mail className="mr-2 h-4 w-4" />
          Contact opnemen
        </Button>
      </CardContent>
    </Card>
  );
}
