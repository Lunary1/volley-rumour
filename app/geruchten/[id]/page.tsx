import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RumourCard } from "@/components/rumour-card";
import { RumourVotesProvider } from "@/components/rumour-votes";
import { getUserVotes } from "@/lib/votes";
import { getPublicRumour } from "@/lib/public-data";
import {
  RUMOUR_STATUS_LABELS,
  rumourHeadline,
  voteCounts,
  type RumourStatus,
} from "@/lib/rumours";
import { BASE_OPEN_GRAPH, NO_INDEX } from "@/lib/seo";

// One approved rumour, so a share link opens it and shows a preview (#99).
// Shared but never indexed (D-035): a player's name shouldn't turn up in
// search results next to a rumour. Pending, rejected and removed rumours 404.

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const rumour = await getPublicRumour(id);
  if (!rumour) return { title: "Gerucht", robots: NO_INDEX };

  const { player, move } = rumourHeadline(rumour);
  const title = `${player} ${move}?`;
  const description = `${RUMOUR_STATUS_LABELS[rumour.status as RumourStatus]} gerucht op Transfer Talk. Stem of je denkt dat het klopt.`;
  return {
    title,
    description,
    robots: NO_INDEX,
    openGraph: {
      ...BASE_OPEN_GRAPH,
      title,
      description,
      url: `/geruchten/${rumour.id}`,
    },
  };
}

export default async function RumourPage({ params }: Props) {
  const { id } = await params;
  const rumour = await getPublicRumour(id);
  if (!rumour) notFound();

  const userVotes = await getUserVotes([rumour.id]);
  const { player, move } = rumourHeadline(rumour);

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-xl px-4 sm:px-6">
        <Link
          href="/geruchten"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Alle geruchten
        </Link>
        <h1 className="sr-only">
          Gerucht: {player} {move}
        </h1>
        <RumourVotesProvider
          rumours={voteCounts([rumour])}
          userVotes={userVotes.votes}
          currentUserId={userVotes.userId}
        >
          <RumourCard
            rumour={{
              id: rumour.id,
              player_name: rumour.player_name,
              from_club_name: rumour.from_club_name,
              to_club_name: rumour.to_club_name,
              category: rumour.category,
              description: rumour.description,
              source_type: rumour.source_type,
              source_url: rumour.source_url,
              resolution_source_url: rumour.resolution_source_url,
              created_at: rumour.created_at,
              status: rumour.status,
              creator_id: rumour.creator_id,
              creator: rumour.creator,
            }}
            currentUserId={userVotes.userId}
          />
        </RumourVotesProvider>
      </div>
    </div>
  );
}
