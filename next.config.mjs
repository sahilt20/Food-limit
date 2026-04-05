/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove X-Powered-By header for security
  poweredByHeader: false,

  // Compress responses
  compress: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },

  // Security & caching headers
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';

    // Content Security Policy
    // Allows Supabase, Google Fonts, and our AI providers.
    // Tighten script-src once inline scripts are eliminated.
    const csp = [
      "default-src 'self'",
      // Scripts: self + Next.js inline runtime (nonce is ideal but complex with App Router)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (Chart.js, Next.js inject inline styles)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self + data URIs (receipt previews) + blob (canvas exports)
      "img-src 'self' data: blob: https://*.supabase.co",
      // Connect: Supabase, AI APIs, own origin
      "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com https://api.openai.com https://integrate.api.nvidia.com",
      // Workers (Tesseract.js uses web workers)
      "worker-src 'self' blob:",
      // Frames: completely deny embedding
      "frame-ancestors 'none'",
      "frame-src 'none'",
      // Objects & embeds
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // Block mixed content in production
      isDev ? '' : 'upgrade-insecure-requests',
    ].filter(Boolean).join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          // ── Security ──────────────────────────────────────────────────────
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: [
              'camera=(self)',          // receipt photo capture
              'microphone=()',
              'geolocation=()',
              'payment=()',
              'usb=()',
              'bluetooth=()',
              'interest-cohort=()',     // disable FLoC/Topics API
            ].join(', '),
          },
          // HSTS — only enable in production (avoids breaking local HTTPS)
          ...(isDev ? [] : [{
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          }]),
          // ── Performance ───────────────────────────────────────────────────
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
      // HTML pages: always revalidate with server (no stale UI after deploys)
      {
        source: '/((?!_next/static|_next/image|favicon\\.ico|icon-)[^.]*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/icon-:size.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // API routes: no caching, CORS locked to same origin
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
