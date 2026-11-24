import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/** Adresse interne de l'API NestJS (réseau Docker ou localhost en développement). */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Politique de contenu : tout vient de notre domaine (l'API est servie sous /api). Les scripts
 * en ligne restent permis : Next.js en produit pour chaque page et un jeton par requête (nonce)
 * imposerait un rendu dynamique partout. Le développement ajoute l'évaluation et le rechargement
 * à chaud.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${PRODUCTION ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${PRODUCTION ? '' : ' ws: wss:'}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(PRODUCTION ? ['upgrade-insecure-requests'] : []),
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  // HTTPS imposé pendant deux ans, en production seulement (le développement reste en HTTP).
  ...(PRODUCTION
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Même origine pour l'interface et l'API : /api est relayé vers NestJS. Les cookies de session
   * restent limités à l'hôte et aucune configuration CORS n'est nécessaire.
   * En production, Nginx route /api directement vers l'API.
   */
  rewrites() {
    return Promise.resolve([
      { source: '/api/:path*', destination: `${API_INTERNAL_URL}/api/:path*` },
    ]);
  },
  headers() {
    return Promise.resolve([
      { source: '/:path*', headers: SECURITY_HEADERS },
      // Pages qui lisent un jeton dans l'URL : aucune fuite par l'en-tête Referer.
      {
        source: '/:locale/(verify-email|reset-password)',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ]);
  },
};

export default createNextIntlPlugin()(nextConfig);
