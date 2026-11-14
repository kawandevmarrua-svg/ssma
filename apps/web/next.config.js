/** @type {import('next').NextConfig} */
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseHost = supabaseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
// Supabase local (Docker) roda em http:// — CSP e images precisam acompanhar.
const supabaseIsHttp = supabaseUrl.startsWith('http://');
const sbProto = supabaseIsHttp ? 'http' : 'https';
const sbWsProto = supabaseIsHttp ? 'ws' : 'wss';

// Em dev o Next/HMR exigem unsafe-eval. Em prod nao.
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${sbProto}://${supabaseHost} https://*.supabase.co https://*.tile.openstreetmap.org https://unpkg.com`,
  "font-src 'self' data:",
  isProd
    ? `connect-src 'self' ${sbProto}://${supabaseHost} ${sbWsProto}://${supabaseHost} https://*.supabase.co wss://*.supabase.co`
    : `connect-src 'self' ${sbProto}://${supabaseHost} ${sbWsProto}://${supabaseHost} https://*.supabase.co wss://*.supabase.co http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // upgrade-insecure-requests quebraria o Supabase local em http://
  ...(isProd && !supabaseIsHttp ? ["upgrade-insecure-requests"] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig = {
  // Raiz do monorepo (evita warning de múltiplos lockfiles e corrige tracing)
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // STANDALONE=1 (Dockerfile) gera build standalone p/ container; Vercel ignora.
  ...(process.env.STANDALONE === '1' ? { output: 'standalone' } : {}),
  transpilePackages: ['@marrua/shared'],
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      // Supabase local (Docker): dev OU build prod apontando pra URL http
      ...(!isProd || supabaseIsHttp
        ? [
            { protocol: 'http', hostname: '127.0.0.1' },
            { protocol: 'http', hostname: 'localhost' },
            { protocol: 'http', hostname: 'host.docker.internal' },
          ]
        : []),
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
