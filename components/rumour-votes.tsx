"use client";

import { createContext, useContext, useEffect, useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { voteOnRumour } from "@/app/actions/vote";
import { loadClient, whenInView } from "@/lib/supabase/load-client";
import { useIsClient } from "@/lib/use-is-client";
import {
  LOGIN_TO_VOTE_MESSAGE,
  belief,
  formatBelief,
  type RumourVoteCounts,
  type VoteType,
} from "@/lib/rumours";

// The vote counts and the user's own votes for every rumour card on a page
// (#200). The cards render on the server; their vote buttons and detail
// dialogs read and change these. One Realtime channel per page keeps the
// counts live, where every card used to open its own.

export type RumourVotes = {
  up: number;
  down: number;
  userVote: VoteType | null;
};

type RumourVotesContext = {
  votes: Record<string, RumourVotes>;
  voting: Record<string, boolean>;
  vote: (rumourId: string, voteType: VoteType) => Promise<void>;
};

const VotesContext = createContext<RumourVotesContext | null>(null);

function initialVotes(
  rumours: RumourVoteCounts[],
  userVotes: Record<string, VoteType>,
): Record<string, RumourVotes> {
  return Object.fromEntries(
    rumours.map((rumour) => [
      rumour.id,
      {
        up: rumour.votes_true,
        down: rumour.votes_false,
        userVote: userVotes[rumour.id] ?? null,
      },
    ]),
  );
}

/** The counts once `voteType` replaces the user's current vote. */
function withVote(current: RumourVotes, voteType: VoteType): RumourVotes {
  const changed = current.userVote !== null;
  return {
    up:
      voteType === "up"
        ? current.up + 1
        : changed
          ? Math.max(0, current.up - 1)
          : current.up,
    down:
      voteType === "down"
        ? current.down + 1
        : changed
          ? Math.max(0, current.down - 1)
          : current.down,
    userVote: voteType,
  };
}

interface RumourVotesProviderProps {
  rumours: RumourVoteCounts[];
  /** The user's votes, from getUserVotes() (#129). */
  userVotes: Record<string, VoteType>;
  /** null for visitors: they are asked to log in (#78). */
  currentUserId: string | null;
  children: React.ReactNode;
}

export function RumourVotesProvider({
  rumours,
  userVotes,
  currentUserId,
  children,
}: RumourVotesProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const channelId = useId();
  const [votes, setVotes] = useState(() => initialVotes(rumours, userVotes));
  const [voting, setVoting] = useState<Record<string, boolean>>({});

  // A new render from the server (another page, a refresh after a vote)
  // brings fresh counts.
  const [shown, setShown] = useState(rumours);
  if (shown !== rumours) {
    setShown(rumours);
    setVotes(initialVotes(rumours, userVotes));
  }

  // One channel for all the page's rumours, once the page is idle (#199) and
  // a vote bar is near the screen (#221): a visitor who never scrolls to the
  // rumours loads no Supabase library and holds no Realtime connection.
  const ids = rumours.map((rumour) => rumour.id).join(",");
  useEffect(() => {
    if (!ids) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const subscribe = async () => {
      const supabase = await loadClient();
      if (cancelled) return;

      channel = supabase
        .channel(`rumour-votes:${channelId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rumours",
            filter: `id=in.(${ids})`,
          },
          (payload) => {
            const row = payload.new as Partial<RumourVoteCounts>;
            if (!row.id) return;
            const id = row.id;
            setVotes((all) => {
              const current = all[id];
              if (!current) return all;
              return {
                ...all,
                [id]: {
                  ...current,
                  up: row.votes_true ?? current.up,
                  down: row.votes_false ?? current.down,
                },
              };
            });
          },
        )
        .subscribe();
    };

    const cancelIdle = whenInView("[data-live-votes]", subscribe);
    return () => {
      cancelled = true;
      cancelIdle();
      channel?.unsubscribe();
    };
  }, [ids, channelId]);

  async function vote(rumourId: string, voteType: VoteType) {
    const current = votes[rumourId];
    if (!current || current.userVote === voteType || voting[rumourId]) return;

    // Visitors get a way to log in instead of a vote that bounces (#78).
    if (!currentUserId) {
      toast(LOGIN_TO_VOTE_MESSAGE, {
        action: {
          label: "Inloggen",
          onClick: () =>
            router.push(`/auth/login?next=${encodeURIComponent(pathname)}`),
        },
      });
      return;
    }

    const setOne = (value: RumourVotes) =>
      setVotes((all) => ({ ...all, [rumourId]: value }));

    setVoting((all) => ({ ...all, [rumourId]: true }));
    // Counted before the server has it
    setOne(withVote(current, voteType));
    try {
      const result = await voteOnRumour(rumourId, voteType);
      if (!result.success) {
        setOne(current);
        toast.error(result.error);
      } else {
        // The database's counts, including votes others cast meanwhile
        setOne({
          up: result.data.votes_true,
          down: result.data.votes_false,
          userVote: voteType,
        });
      }
    } finally {
      setVoting((all) => ({ ...all, [rumourId]: false }));
    }
  }

  return (
    <VotesContext.Provider value={{ votes, voting, vote }}>
      {children}
    </VotesContext.Provider>
  );
}

/** One rumour's counts, the user's vote, and a way to vote. */
export function useRumourVotes(rumourId: string) {
  const context = useContext(VotesContext);
  if (!context) {
    throw new Error("useRumourVotes needs a RumourVotesProvider");
  }
  const votes = context.votes[rumourId] ?? { up: 0, down: 0, userVote: null };
  return {
    ...votes,
    isVoting: context.voting[rumourId] ?? false,
    vote: (voteType: VoteType) => context.vote(rumourId, voteType),
  };
}

interface RumourVoteBarProps {
  rumourId: string;
  /** Why the user can't vote on this rumour, if so (#78). */
  closedReason: string | null;
}

/** What voters think (D-005) and the vote buttons, on a rumour card. */
export function RumourVoteBar({ rumourId, closedReason }: RumourVoteBarProps) {
  const { up, down, userVote, isVoting, vote } = useRumourVotes(rumourId);
  // A vote clicked before hydration would be lost; keep the buttons off.
  const isClient = useIsClient();
  const disabled = isVoting || !!closedReason || !isClient;
  // A neutral belief signal (D-005): no good/evil wording, no colours.
  const beliefShare = belief(up, down);

  return (
    <>
      <div
        data-live-votes
        className="flex flex-col items-center gap-2 my-4 py-4 border-y border-border"
      >
        <div
          className="w-24 h-2 bg-muted rounded-full overflow-hidden"
          aria-hidden
        >
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${beliefShare ?? 0}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          {formatBelief(up, down)}
        </p>
      </div>

      <div className="flex items-center justify-center gap-4 mb-4 py-3 border-y border-border">
        <Button
          variant="toggle"
          size="sm"
          onClick={() => vote("up")}
          disabled={disabled}
          aria-pressed={userVote === "up"}
          className="gap-2"
        >
          <ThumbsUp className="h-5 w-5" />
          <span className="sr-only">Waar</span>
          <span className="font-semibold">{up}</span>
        </Button>
        <div className="text-muted-foreground text-sm font-medium">
          {up + down > 0 ? `${up + down} stemmen` : "Wees eerst"}
        </div>
        <Button
          variant="toggle"
          size="sm"
          onClick={() => vote("down")}
          disabled={disabled}
          aria-pressed={userVote === "down"}
          className="gap-2"
        >
          <ThumbsDown className="h-5 w-5" />
          <span className="sr-only">Niet waar</span>
          <span className="font-semibold">{down}</span>
        </Button>
      </div>
      {closedReason && (
        <p className="-mt-2 mb-4 text-center text-xs text-muted-foreground">
          {closedReason}
        </p>
      )}
    </>
  );
}
