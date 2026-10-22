import React, { Suspense } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Header } from "@/components/header";
import { HeaderSkeleton } from "@/components/header-skeleton";
import { Footer } from "@/components/footer";
import { SuspensionNotice } from "@/components/suspension-notice";
import { ToasterProvider } from "@/components/toaster-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_URL } from "@/lib/site-url";
import { BASE_OPEN_GRAPH } from "@/lib/seo";

// The only web font, so the only one preloaded. Monospace text (takedown
// reference codes) uses the system font (#211).
const _inter = Inter({ subsets: ["latin"] });

const description =
  "Zoekertjes, transfers en Transfer Talk voor het Belgische volleybal. Vind een club, speler of trainer en stem op de geruchten van de transfermarkt.";

// Defaults for every page (#99). A page sets its own title (the template adds
// the site name) and description; the share image comes from the nearest
// opengraph-image file.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "VolleyRumours - Belgische volleybal transfers en zoekertjes",
    template: "%s | VolleyRumours",
  },
  description,
  openGraph: { ...BASE_OPEN_GRAPH, description },
  twitter: { card: "summary_large_image" },
  // Small, purpose-sized icons (#199): the 2048px logos weighed 180 KB each.
  // Black lines on light browser chrome, white lines on dark.
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "48x48" },
      {
        url: "/icon-dark.png",
        type: "image/png",
        sizes: "48x48",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180" },
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
          <Suspense fallback={null}>
            <SuspensionNotice />
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
