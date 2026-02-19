import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/")) {
    // if "next" is not a relative URL, use the default
    next = "/";
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
      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";

      let redirectUrl: string;
      if (isLocalEnv) {
        redirectUrl = `${origin}${next}`;
      } else if (forwardedHost) {
        redirectUrl = `https://${forwardedHost}${next}`;
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

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=auth-code-error`);
}
