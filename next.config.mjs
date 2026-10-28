/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      // Profile pictures up to 5 MB go through a server action (#92).
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      // Security headers on every response (#266). No other site may frame
      // ours (clickjacking on forms like account deletion and reports). A full
      // CSP for scripts and connections is a follow-up, report-only first.
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // The points leaderboard became "Betrouwbare bronnen" (#88, D-005).
      {
        source: "/leaderboard",
        destination: "/betrouwbare-bronnen",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
