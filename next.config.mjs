/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standalone is opt-in, for the Docker image only. On Passenger hosts
  // (DirectAdmin / CloudLinux) it must stay OFF: Passenger boots ./server.js at
  // the app root and would never reach .next/standalone/server.js.
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  images: {
    // Supplier media (AliExpress / Alibaba / 1688 CDNs) is hotlinked until it is
    // re-hosted. Anything served from our own storage passes through too.
    remotePatterns: [
      { protocol: 'https', hostname: '**.alicdn.com' },
      { protocol: 'https', hostname: '**.aliexpress.com' },
      { protocol: 'https', hostname: '**.alibaba.com' },
      { protocol: 'https', hostname: '**.1688.com' },
      { protocol: 'https', hostname: '**.shopify.com' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
