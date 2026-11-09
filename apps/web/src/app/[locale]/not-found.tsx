import { useTranslations } from 'next-intl';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('common.notFound');
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-fg">{t('title')}</h1>
      <p className="mt-3 text-fg-muted">{t('body')}</p>
      <Link href="/" className={`${buttonClasses('primary')} mt-8`}>
        {t('back')}
      </Link>
    </section>
  );
}
