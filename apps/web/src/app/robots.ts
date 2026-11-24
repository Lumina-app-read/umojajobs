import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/** Espaces privés, impression et API hors index ; le reste est ouvert aux moteurs. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/*/dashboard', '/*/admin', '/*/print', '/*/design'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
