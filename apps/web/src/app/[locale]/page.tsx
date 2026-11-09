import { getTranslations } from 'next-intl/server';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default async function HomePage() {
  const t = await getTranslations('common.home');
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
      <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-5xl">{t('title')}</h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-fg-muted">{t('subtitle')}</p>
      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/register" className={buttonClasses('primary', 'lg')}>
          {t('ctaRegister')}
        </Link>
        <Link href="/login" className={buttonClasses('secondary', 'lg')}>
          {t('ctaLogin')}
        </Link>
      </div>
      <p className="mt-10 text-sm text-fg-muted">{t('comingSoon')}</p>
    </section>
  );
}
