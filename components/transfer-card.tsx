import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Calendar, UserCircle } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

interface TransferCardProps {
  transfer: {
    id: string;
    player_name: string;
    from_club: string | null;
    to_club: string;
    transfer_type: string;
    transfer_date: string;
    is_official: boolean;
  };
}

const transferTypeLabels: Record<string, string> = {
  player_male: "Speler",
  player_female: "Speelster",
  coach_male: "Trainer",
  coach_female: "Trainster",
  player_retirement: "Speler Stopt",
  coach_retirement: "Trainer Stopt",
};

const transferTypeColors: Record<string, string> = {
  player_male: "bg-primary/20 text-primary border-primary/30",
  player_female: "bg-primary/20 text-primary border-primary/30",
  coach_male: "bg-accent/20 text-accent border-accent/30",
  coach_female: "bg-accent/20 text-accent border-accent/30",
  player_retirement: "bg-muted text-muted-foreground border-muted",
  coach_retirement: "bg-muted text-muted-foreground border-muted",
};

export function TransferCard({ transfer }: TransferCardProps) {
  const isRetirement = transfer.transfer_type?.includes("retirement") ?? false;
  const typeColor =
    transferTypeColors[transfer.transfer_type] ||
    "bg-muted text-muted-foreground border-muted";
  const typeLabel = transferTypeLabels[transfer.transfer_type] || "Onbekend";

  return (
    <Card className="bg-card border-border hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <Badge variant="outline" className={typeColor}>
            {typeLabel}
          </Badge>
          {transfer.is_official && (
            <Badge className="bg-primary text-primary-foreground">
              Officieel
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <UserCircle className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-balance">{transfer.player_name}</h3>
        </div>

        <div className="flex items-center gap-2 text-sm mb-3">
          {isRetirement ? (
            <span className="text-muted-foreground">
              {transfer.from_club && `Verlaat ${transfer.from_club}`}
            </span>
          ) : (
            <>
              {transfer.from_club ? (
                <>
                  <span className="text-muted-foreground">
                    {transfer.from_club}
                  </span>
                  <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                </>
              ) : (
                <span className="text-muted-foreground italic">Nieuw</span>
              )}
              <span className="text-foreground font-medium">
                {transfer.to_club}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {format(new Date(transfer.transfer_date), "d MMMM yyyy", {
              locale: nl,
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
