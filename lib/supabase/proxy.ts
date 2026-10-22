import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isComingSoon } from "@/lib/coming-soon";
import { isOpenWithoutTerms, TERMS_COOKIE, WELCOME_PATH } from "@/lib/terms";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to
  // debug issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  // getClaims() refreshes an expired session, then verifies the JWT against
  // the project's public signing key in the process, so a request makes no
  // call to Supabase Auth (#212). The key is cached for 10 minutes.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  // Age and terms gate (#75). Coming-soon mode closes these routes anyway,
  // and /welkom with them, so the gate waits for the launch.
  if (
    userId &&
    !isComingSoon() &&
    !isOpenWithoutTerms(request.nextUrl.pathname) &&
    request.cookies.get(TERMS_COOKIE)?.value !== userId
  ) {
    const { data: accepted, error } = await supabase.rpc("has_accepted_terms");
    if (accepted === true) {
      supabaseResponse.cookies.set(TERMS_COOKIE, userId, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
      });
    } else if (!error) {
      // A failed check lets the request through: the gate is a declaration,
      // not a security boundary, and shouldn't lock everyone out.
      const url = request.nextUrl.clone();
      url.pathname = WELCOME_PATH;
      url.search = "";
      url.searchParams.set(
        "next",
        request.nextUrl.pathname + request.nextUrl.search,
      );
      const redirect = NextResponse.redirect(url);
      supabaseResponse.cookies
        .getAll()
        .forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
