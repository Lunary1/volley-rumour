import React, { Suspense } from "react";
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Header } from "@/components/header";
import { HeaderSkeleton } from "@/components/header-skeleton";
import { Footer } from "@/components/footer";
import { ToasterProvider } from "@/components/toaster-provider";
import { ThemeProvider } from "@/components/theme-provider";

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
        url: "/volleyrumours_logo.png",
        type: "image/png",
      },
    ],
    apple: "/volleyrumours_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <meta
          name="facebook-domain-verification"
          content="rfsxnkp2bfyfjsmsijd0juphva8ibt"
        />
        <link rel="icon" href="/volleyrumours_logo.png" />
        <link rel="shortcut icon" href="/volleyrumours_logo.png" />
      </head>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={<HeaderSkeleton />}>
            <Header />
          </Suspense>
          <main className="flex-1">{children}</main>
          <Footer />
          <Analytics />
          <ToasterProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
