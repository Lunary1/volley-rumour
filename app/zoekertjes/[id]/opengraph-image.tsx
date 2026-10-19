import { createPublicClient } from "@/lib/supabase/server";
import {
  CLASSIFIED_TYPE_LABELS,
  getDivisionLabel,
  getProvinceLabel,
} from "@/lib/classifieds-utils";
import { OG_CONTENT_TYPE, OG_SIZE, brandImage } from "@/lib/og-image";

// The preview when a zoekertje is shared (#99): its title, type, division and
// province. Never the poster's or contact's name.

export const alt = "Zoekertje op VolleyRumours";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Read as a visitor: RLS only shows online ads.
  const { data: ad } = await createPublicClient()
    .from("classifieds")
    .select("title, type, division, province")
    .eq("id", id)
    .eq("is_active", true)
    .is("removed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!ad) return new Response(null, { status: 404 });

  return brandImage({
    eyebrow: `Zoekertje · ${CLASSIFIED_TYPE_LABELS[ad.type] ?? ""}`,
    title: ad.title || "Zoekertje",
    subtitle:
      [getDivisionLabel(ad.division), getProvinceLabel(ad.province)]
        .filter(Boolean)
        .join(" · ") || undefined,
  });
}
