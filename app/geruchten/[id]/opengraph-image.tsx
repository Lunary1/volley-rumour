import { getPublicRumour } from "@/lib/public-data";
import {
  RUMOUR_STATUS_LABELS,
  rumourHeadline,
  type RumourStatus,
} from "@/lib/rumours";
import { OG_CONTENT_TYPE, OG_SIZE, brandImage } from "@/lib/og-image";

// The preview when a rumour is shared (#99): player, move and status. Never
// the author.

export const alt = "Gerucht op VolleyRumours";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rumour = await getPublicRumour(id);
  if (!rumour) return new Response(null, { status: 404 });

  const { player, move } = rumourHeadline(rumour);
  return brandImage({
    eyebrow: `Gerucht · ${RUMOUR_STATUS_LABELS[rumour.status as RumourStatus]}`,
    title: player,
    subtitle: `${move.charAt(0).toUpperCase()}${move.slice(1)}?`,
  });
}
