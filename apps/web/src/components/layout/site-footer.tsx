import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function SiteFooter() {
  const t = await getTranslations('common.footer');
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t('rights', { year: new Date().getFullYear() })}</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/terms" className="hover:text-fg">
            {t('terms')}
          </Link>
          <Link href="/privacy" className="hover:text-fg">
            {t('privacy')}
          </Link>
          {/* Attributions exigées par les licences CC BY 4.0 de GeoNames et de Twemoji. */}
          <a
            href="https://www.geonames.org/"
            className="hover:text-fg"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('geonames')}
          </a>
          <a
            href="https://github.com/jdecked/twemoji"
            className="hover:text-fg"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('flags')}
          </a>
        </nav>
      </div>
    </footer>
  );
}
