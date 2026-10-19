import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

// The page is a client component, so its metadata lives here (#99).
export const metadata: Metadata = { title: "Inloggen", robots: NO_INDEX };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
