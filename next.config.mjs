/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Shared hosting (CloudLinux LVE) caps process count. Next spawns one build
  // worker per CPU core, and on a many-core shared box that hits the cap and
  // fails with `spawn ... EAGAIN` during "Collecting page data".
  experimental: { cpus: 1, workerThreads: false },
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

  /*
   * Security headers. There were none at all before this.
   *
   * These are the browser-enforced half of the job: they cannot stop an attack
   * on the server, but they close the classes of attack that need the victim's
   * own browser to cooperate — clickjacking, MIME sniffing, referrer leakage,
   * and silent downgrade to http.
   *
   * No Content-Security-Policy yet, deliberately. A CSP added without auditing
   * every inline script and third-party origin (Flutterwave and PayPal both
   * inject their own) breaks checkout, and a payment page that silently stops
   * working is worse than the risk it removes. It wants its own change with a
   * report-only run first.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          /*
           * Two years and preload-eligible. HSTS is the one header here with
           * teeth against a real network attacker: it stops the first-request
           * downgrade that TLS alone cannot.
           */
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // No framing: nothing here should ever be embedded, and this is what
          // stops a clickjack overlaying the admin or the pay buttons.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          // Stops a browser guessing a type we did not send — the reason the
          // og-image proxy also refuses non-image upstreams.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Send the origin off-site, never the full path: order confirmation
          // and unsubscribe URLs carry identifiers that must not leak.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // We ask for none of these; deny them so an injected script cannot.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
      {
        // Admin and the account-adjacent pages must never be cached by a shared
        // proxy — the store sits behind a CDN, and a cached admin page is a
        // data leak to the next visitor.
        source: '/admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;
