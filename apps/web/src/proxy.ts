import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Redirige vers la langue préférée (cookie, puis Accept-Language) et préfixe les URLs.
 * Les routes /api (proxifiées vers NestJS) et les fichiers statiques sont exclus.
 */
export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
