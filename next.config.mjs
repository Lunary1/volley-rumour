/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
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
