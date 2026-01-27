import Link from "next/link";
import { Menu, X } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUser } from "@/app/actions/auth";
import { HeaderClient } from "@/components/header-client";

const navItems = [
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

export async function Header() {
  const user = await getCurrentUser();

  return <HeaderClient user={user} navItems={navItems} />;
}
