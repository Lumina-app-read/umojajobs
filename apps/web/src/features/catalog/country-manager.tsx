'use client';

import { type AdminCatalogResponse, type AdminCountry } from '@opportinities/shared';
import { Eye, EyeOff, Search, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/feedback';
import { FormField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

const plain = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Pays : recherche et activation. Désactiver demande une confirmation. */
export function CountryManager({ initial }: { initial: AdminCountry[] }) {
  const t = useTranslations('common.admin.catalog');
  const locale = useLocale();
  const { fromApiError } = useFormErrors();
  const [countries, setCountries] = useState(initial);
  const [query, setQuery] = useState('');
  const [disabling, setDisabling] = useState<AdminCountry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const name = (country: AdminCountry) => (locale === 'en' ? country.nameEn : country.nameFr);

  const shown = useMemo(() => {
    const term = plain(query.trim());
    return countries
      .filter((country) =>
        plain(`${country.nameFr} ${country.nameEn} ${country.iso2}`).includes(term),
      )
      .sort((a, b) =>
        (locale === 'en' ? a.nameEn : a.nameFr).localeCompare(
          locale === 'en' ? b.nameEn : b.nameFr,
          locale,
        ),
      );
  }, [countries, query, locale]);
  const active = countries.filter((country) => country.isActive).length;

  async function setActive(country: AdminCountry, isActive: boolean) {
    setBusy(country.iso2);
    try {
      const result = await api.patch<AdminCatalogResponse>(
        `/admin/catalog/countries/${country.iso2}`,
        { isActive },
      );
      setCountries(result.countries);
      setDisabling(null);
      toast.success(t(isActive ? 'countryEnabled' : 'countryDisabled'));
    } catch (caught) {
      toast.error(fromApiError(caught).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-4" aria-label={t('countries')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <FormField
          label={t('searchCountry')}
          name="country-search"
          type="search"
          icon={Search}
          placeholder={t('searchCountryPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="sm:w-80"
        />
        <p className="text-sm text-fg-muted sm:text-[13px]">
          {t('activeCount', { active, total: countries.length })}
        </p>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Search} title={t('noCountry')} className="bg-surface py-10" />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
          {shown.map((country) => (
            <li key={country.iso2} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="text-xl" aria-hidden="true">
                {country.flagEmoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                  {name(country)}
                  {!country.isActive && <Badge tone="neutral">{t('inactive')}</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {[
                    country.dialCode,
                    country.currencyCode,
                    t('users', { count: country.users }),
                    t('offers', { count: country.offers }),
                  ].join(' · ')}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={country.isActive ? EyeOff : Eye}
                loading={busy === country.iso2 && !disabling}
                disabled={busy !== null}
                aria-label={t(country.isActive ? 'disableName' : 'enableName', {
                  name: name(country),
                })}
                onClick={() =>
                  country.isActive ? setDisabling(country) : void setActive(country, true)
                }
              >
                {t(country.isActive ? 'disable' : 'enable')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={disabling !== null}
        onClose={() => busy === null && setDisabling(null)}
        size="sm"
        title={disabling ? t('disableTitle', { name: name(disabling) }) : ''}
        description={t('disableBody')}
        footer={
          <>
            <Button
              variant="secondary"
              icon={X}
              disabled={busy !== null}
              onClick={() => setDisabling(null)}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              icon={EyeOff}
              loading={busy !== null}
              onClick={() => disabling && void setActive(disabling, false)}
            >
              {t('disable')}
            </Button>
          </>
        }
      />
    </section>
  );
}
