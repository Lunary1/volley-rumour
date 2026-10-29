"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import Image from "next/image";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  hasSessionCookie,
  loadClient,
  whenIdle,
} from "@/lib/supabase/load-client";

export interface NavItem {
  href?: string;
  label: string;
  submenu?: Array<{ href: string; label: string }>;
}

interface HeaderClientProps {
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
    is_staff?: boolean;
  } | null;
  navItems: NavItem[];
  /** False in coming-soon mode: login, sign-up and account links are closed. */
  showUserMenu?: boolean;
}

export function HeaderClient({
  user,
  navItems,
  showUserMenu = true,
}: HeaderClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const hasUser = user !== null;

  // Listen for auth state changes so the header re-renders when the user
  // signs out (or signs in via another tab). This eliminates the stale-user
  // split-brain state where the header still shows the old user data.
  //
  // IMPORTANT: We also handle INITIAL_SESSION for the OAuth redirect case.
  // After Google OAuth, the browser does a full-page navigation to /. The
  // Supabase browser client fires INITIAL_SESSION (not SIGNED_IN) because
  // it's detecting the session for the first time. If the server render
  // missed the session (race between cookie storage and SSR), we need to
  // force a refresh so the header picks up the authenticated state.
  //
  // The Supabase library loads once the page is idle, not with the page
  // (#199), and not at all in coming-soon mode, where nobody can log in.
  // A visitor without a session cookie doesn't load it either (#221): when
  // the tab is shown again and a cookie has appeared (a login in another
  // tab), a refresh picks up the user.
  useEffect(() => {
    if (!showUserMenu) return;

    if (!hasUser && !hasSessionCookie()) {
      const onVisible = () => {
        if (document.visibilityState === "visible" && hasSessionCookie()) {
          router.refresh();
        }
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }

    let cancelled = false;
    let unsubscribe = () => {};
    const cancelIdle = whenIdle(async () => {
      const supabase = await loadClient();
      if (cancelled) return;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (
          event === "SIGNED_OUT" ||
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED"
        ) {
          router.refresh(); // Force server component tree to re-render
        }

        // Recovery: server rendered without auth but client detects a valid
        // session from cookies → force server re-render to pick up the user.
        if (event === "INITIAL_SESSION" && session && !hasUser) {
          router.refresh();
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    });
    return () => {
      cancelled = true;
      cancelIdle();
      unsubscribe();
    };
  }, [router, hasUser, showUserMenu]);

  // Determine active main nav item and its submenu
  const activeMainItem = useMemo(() => {
    for (const item of navItems) {
      if (item.submenu) {
        if (
          item.submenu.some(
            (sub) =>
              pathname === sub.href || pathname.startsWith(sub.href + "/"),
          )
        ) {
          return item;
        }
      } else if (
        item.href &&
        (pathname === item.href || pathname.startsWith(item.href + "/"))
      ) {
        return item;
      }
    }
    return null;
  }, [pathname, navItems]);

  return (
    <header
      className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
      suppressHydrationWarning
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Header. On desktop the logo and the controls each take an
            equal share of the leftover width, so the nav sits on the page's
            centre however wide the user menu is, or with no menu at all in
            coming-soon mode (#228). Below lg the menu sits behind the
            hamburger: a logged-in menu doesn't fit beside the nav there. */}
        <div className="flex h-16 items-center justify-between">
          <div className="flex lg:flex-1 lg:basis-0">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <Image
                src="/logo-text-header.png"
                alt="VolleyRumours"
                width={320}
                height={65}
                className="h-8 w-auto dark:hidden"
              />
              <Image
                src="/logo-text-header-inverted.png"
                alt="VolleyRumours"
                width={320}
                height={65}
                className="h-8 w-auto hidden dark:block"
              />
            </Link>
          </div>

          <nav
            aria-label="Hoofdmenu"
            className="hidden lg:flex items-center gap-1"
          >
            {navItems.map((item) => {
              const isActive = item === activeMainItem;
              return (
                <div key={item.label} className="relative group">
                  <Link
                    href={item.href || "#"}
                    className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-1 rounded-md ${
                      isActive
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {item.label}
                    {item.submenu && (
                      <ChevronDown className="h-4 w-4 opacity-60" />
                    )}
                  </Link>

                  {/* Dropdown Menu */}
                  {item.submenu && (
                    <div className="absolute left-0 mt-0 w-48 bg-background border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      {item.submenu.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={`block px-4 py-2 text-sm transition-colors first:rounded-t-md last:rounded-b-md ${
                            pathname === sub.href ||
                            pathname.startsWith(sub.href + "/")
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="hidden lg:flex flex-1 basis-0 items-center justify-end gap-1">
            <ThemeToggle />
            {showUserMenu && <UserMenu user={user} />}
          </div>

          <button
            type="button"
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
            aria-label={mobileMenuOpen ? "Menu sluiten" : "Menu openen"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <div key={item.label}>
                  {item.submenu ? (
                    <>
                      <div className="px-4 py-2 text-sm font-medium text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="pl-4 flex flex-col gap-1">
                        {item.submenu.map((sub) => (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`px-3 py-2 text-sm rounded-md transition-colors ${
                              pathname.startsWith(sub.href)
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Link
                      href={item.href || "#"}
                      className={`px-4 py-2 text-sm font-medium rounded-md block transition-colors ${
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/")
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
              {showUserMenu && <UserMenu user={user} isMobile={true} />}
              <div className="px-4">
                <ThemeToggle isMobile />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
