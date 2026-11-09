import { House } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ButtonLink } from '@/components/ui/button-link';

/** Page 404 traduite, dans la structure du site public. */
export default async function NotFound() {
  const t = await getTranslations('common.notFound');
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold text-fg">{t('title')}</h1>
          <p className="mt-3 text-fg-muted">{t('body')}</p>
          <ButtonLink href="/" icon={House} className="mt-8">
            {t('back')}
          </ButtonLink>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
