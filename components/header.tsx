import Link from "next/link";
import { Menu, X } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUser } from "@/app/actions/auth";
import { HeaderClient, type NavItem } from "@/components/header-client";
import { isComingSoon, isOpenDuringComingSoon } from "@/lib/coming-soon";

const navItems: NavItem[] = [
  { href: "/", label: "Home" },
  {
    label: "Transfers",
    submenu: [
      { href: "/geruchten", label: "Transfer Talk" },
      { href: "/transfers", label: "Bevestigde Transfers" },
      { href: "/leaderboard", label: "Leaderboard" },
    ],
  },
  { href: "/zoekertjes", label: "Zoekertjes" },
];

// Coming-soon mode: keep only links to pages that are still reachable, and drop
// a submenu group when none of its links are.
function openNavItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => {
    if (item.submenu) {
      const submenu = item.submenu.filter((sub) =>
        isOpenDuringComingSoon(sub.href),
      );
      return submenu.length > 0 ? [{ ...item, submenu }] : [];
    }
    return item.href && isOpenDuringComingSoon(item.href) ? [item] : [];
  });
}

export async function Header() {
  const user = await getCurrentUser();
  const comingSoon = isComingSoon();

  return (
    <HeaderClient
      user={user}
      navItems={comingSoon ? openNavItems(navItems) : navItems}
      showUserMenu={!comingSoon}
    />
  );
}
