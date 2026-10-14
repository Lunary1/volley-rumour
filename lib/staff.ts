import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/response";

// Staff = profiles.role 'moderator' or 'admin' (D-006). The database decides,
// through public.is_staff(); RLS policies use the same function. The role
// column itself isn't readable through the API (#111).

/**
 * The signed-in staff user, or null for visitors and non-staff. Admin pages
 * call notFound() on null; admin server actions use requireStaff().
 */
export const getStaffUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: isStaff, error } = await supabase.rpc("is_staff");
  if (error || isStaff !== true) return null;

  return user;
});

/**
 * Guard for admin server actions. Returns the Supabase client and staff user,
 * or an error response to return as-is:
 *
 *   const staff = await requireStaff();
 *   if (!staff.ok) return staff.response;
 */
export async function requireStaff() {
  const user = await getStaffUser();
  if (!user) {
    return { ok: false as const, response: errorResponse("Geen toegang") };
  }
  return { ok: true as const, user, supabase: await createClient() };
}
