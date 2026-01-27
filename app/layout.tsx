import React, { Suspense } from "react";
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Header } from "@/components/header";
import { HeaderSkeleton } from "@/components/header-skeleton";
import { Footer } from "@/components/footer";
import { ToasterProvider } from "@/components/toaster-provider";

const _inter = Inter({ subsets: ["latin"] });
const _spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VolleyRumours - Belgische Volleybal Transfers & Transfer Talk",
  description:
    "Ontdek de nieuwste volleybal transfers, Transfer Talk en zoekertjes in België. Stem op transfers, verdien punten en word een betrouwbare bron in de community.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/favicon.ico",
        sizes: "any",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.svg" />
      </head>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <Suspense fallback={<HeaderSkeleton />}>
          <Header />
        </Suspense>
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
        <ToasterProvider />
      </body>
    </html>
  );
}
