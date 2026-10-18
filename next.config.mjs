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
