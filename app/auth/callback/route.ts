import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  // Only a path on this site, never //other.host
  const next = safeNextPath(searchParams.get("next"));

  // A password-reset link that is expired, already used or opened in another
  // browser (#58). Supabase reports an expired link as access_denied too.
  const isPasswordReset = next === "/auth/update-password";
  const resetLinkInvalidUrl = `${origin}/auth/login?error=reset-link-invalid`;
  if (isPasswordReset && errorParam) {
    return NextResponse.redirect(resetLinkInvalidUrl);
  }

  // A sign-up confirmation link (#89). Supabase confirms the address before
  // it sends the browser here, so if the code can't be exchanged (the link
  // was opened in another browser), the user only has to log in.
  const isSignUpConfirmation = searchParams.get("flow") === "signup";
  const loginUrl = (param: string, value: string) => {
    const url = new URL("/auth/login", origin);
    url.searchParams.set(param, value);
    if (next !== "/") url.searchParams.set("next", next);
    return url.toString();
  };
  if (isSignUpConfirmation && errorParam) {
    // Expired or already used.
    return NextResponse.redirect(loginUrl("error", "confirm-link-invalid"));
  }

  // Handle OAuth provider errors (e.g. user cancelled, access_denied)
  if (errorParam) {
    const loginUrl = new URL("/auth/login", origin);
    if (errorParam === "access_denied") {
      loginUrl.searchParams.set("error", "oauth-cancelled");
    } else {
      loginUrl.searchParams.set("error", "oauth-provider-error");
    }
    if (errorDescription) {
      loginUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(loginUrl.toString());
  }

  if (code) {
    // Collect cookies that Supabase sets during code exchange
    const cookiesToSet: {
      name: string;
      value: string;
      options: Record<string, unknown>;
    }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookies) {
            cookiesToSet.push(...cookies);
            cookies.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(
        "[auth/callback] exchangeCodeForSession failed:",
        error.message,
        { code: error.status, name: error.name },
      );
    }

    if (!error) {
      // CRITICAL: @supabase/auth-js@2.x defers the SIGNED_IN notification
      // via setTimeout(0) inside _exchangeCodeForSession. However,
      // @supabase/ssr@0.8.x only flushes session cookies (via setAll) when
      // the onAuthStateChange handler fires with SIGNED_IN. Without this
      // yield, cookiesToSet is still empty when we build the redirect
      // response — the browser never receives the session cookies and the
      // user appears logged out.
      //
      // Yielding one macrotask tick allows the deferred SIGNED_IN event to
      // fire, which triggers applyServerStorage → setAll → cookiesToSet.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";

      let redirectUrl: string;
      if (isLocalEnv) {
        redirectUrl = `${origin}${next}`;
      } else if (forwardedHost) {
        // `next start` sets x-forwarded-* itself, over plain http locally.
        const forwardedProto =
          request.headers.get("x-forwarded-proto") ?? "https";
        redirectUrl = `${forwardedProto}://${forwardedHost}${next}`;
      } else {
        redirectUrl = `${origin}${next}`;
      }

      const response = NextResponse.redirect(redirectUrl);
      // Apply auth cookies to the redirect response.
      // These MUST be on the response so the browser stores them before
      // hitting the homepage — without them the session is invisible to
      // the server-side Supabase client on the next request.
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
      console.log(
        "[auth/callback] Success — setting",
        cookiesToSet.length,
        "cookies, redirecting to",
        redirectUrl,
      );
      return response;
    }
  }

  if (isPasswordReset) {
    return NextResponse.redirect(resetLinkInvalidUrl);
  }

  if (isSignUpConfirmation) {
    return NextResponse.redirect(loginUrl("bevestigd", "1"));
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=auth-code-error`);
}
