import { getTranslations } from 'next-intl/server';
import { type ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { Logo } from './logo';
import { PRIMARY_NAV } from './nav-items';

const linkClasses = 'text-sm text-fg-muted transition-colors hover:text-fg';

function Column({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: ComponentProps<typeof Link>['href'] }[];
}) {
  return (
    <div>
      <h2 className="text-sm sm:text-[13px] font-semibold text-fg">{title}</h2>
      <ul className="mt-4 grid gap-3">
        {links.map(({ label, href }) => (
          <li key={label}>
            <Link href={href} className={linkClasses}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pied de page : marque, trois colonnes de liens, mentions et attributions des licences. */
export async function SiteFooter() {
  const t = await getTranslations('common');

  return (
    <footer className="border-t border-line bg-surface" aria-label={t('footer.label')}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-8">
          <div className="max-w-xs sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="-ml-1 inline-flex rounded-md p-1"
              aria-label={t('nav.homeLabel')}
            >
              <Logo size={32} />
            </Link>
            <p className="mt-4 text-sm font-semibold text-fg">{t('meta.tagline')}</p>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{t('meta.description')}</p>
          </div>
          <Column
            title={t('footer.platform')}
            links={PRIMARY_NAV.map(({ key, href }) => ({
              label: t(`nav.${key}`),
              href,
            }))}
          />
          <Column
            title={t('footer.account')}
            links={[
              { label: t('nav.register'), href: '/register' },
              { label: t('nav.login'), href: '/login' },
              { label: t('nav.dashboard'), href: '/dashboard' },
            ]}
          />
          <Column
            title={t('footer.legal')}
            links={[
              { label: t('footer.terms'), href: '/terms' },
              { label: t('footer.privacy'), href: '/privacy' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-line py-6 text-xs text-fg-subtle md:flex-row md:items-center md:justify-between">
          <p>{t('footer.rights', { year: new Date().getFullYear() })}</p>
          {/* Attributions exigées par les licences CC BY 4.0 de GeoNames et de Twemoji. */}
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="sr-only">{t('footer.credits')} :</span>
            <a
              href="https://www.geonames.org/"
              className="transition-colors hover:text-fg"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t('footer.geonames')}
            </a>
            <a
              href="https://github.com/jdecked/twemoji"
              className="transition-colors hover:text-fg"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t('footer.flags')}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
