"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import Image from "next/image";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  href?: string;
  label: string;
  submenu?: Array<{ href: string; label: string }>;
}

interface HeaderClientProps {
  user: {
    id: string;
    username: string;
    trust_score: number;
    avatar_url: string | null;
  } | null;
  navItems: NavItem[];
}

export function HeaderClient({ user, navItems }: HeaderClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Listen for auth state changes so the header re-renders when the user
  // signs out (or signs in via another tab). This eliminates the stale-user
  // split-brain state where the header still shows the old user data.
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        router.refresh(); // Force server component tree to re-render
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

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
        {/* Main Header */}
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/volleyrumours_logo_text.png"
              alt="VolleyRumours"
              width={320}
              height={48}
              className="h-8 w-auto dark:hidden"
            />
            <Image
              src="/volleyrumours_logo_text_inverted.png"
              alt="VolleyRumours"
              width={320}
              height={48}
              className="h-8 w-auto hidden dark:block"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
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

          <div className="hidden md:flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
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
          <div className="md:hidden py-4 border-t border-border">
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
              <UserMenu user={user} isMobile={true} />
              <div className="px-4 pt-2">
                <ThemeToggle />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
