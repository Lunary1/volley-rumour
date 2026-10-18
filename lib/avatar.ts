// Profile pictures (#92). Profiles store a path in the public `avatars`
// bucket, never a URL, so a picture can only come from our own Storage.

export const AVATAR_BUCKET = "avatars";

/** What a user may pick; the server re-encodes it to a small WebP. */
export const AVATAR_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPE_MESSAGE = "Kies een foto in JPG, PNG of WebP.";
export const AVATAR_SIZE_MESSAGE = "Je foto mag maximaal 5 MB groot zijn.";

/** The public URL of a stored picture, or null when there is none. */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}
