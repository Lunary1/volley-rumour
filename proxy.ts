import { updateSession } from "@/lib/supabase/proxy";
import { isComingSoon, isOpenDuringComingSoon } from "@/lib/coming-soon";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  if (isComingSoon() && !isOpenDuringComingSoon(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - /auth/callback (OAuth callback — must NOT run getUser() here or it can
     *   trigger an auto-signout race condition and clear the PKCE cookies before
     *   the route handler has a chance to exchange the code for a session)
     */
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
