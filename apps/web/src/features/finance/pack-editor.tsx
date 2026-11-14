'use client';

import { type AdminCreditPackResponse, packPriceWithFees } from '@opportinities/shared';
import {
  Check,
  Coins,
  DollarSign,
  Hash,
  Link2,
  PackagePlus,
  PencilLine,
  Save,
  Tag,
  X,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, FormField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/**
 * Création ou modification d'un pack de crédits. Le prix doit valoir crédits × valeur d'un
 * crédit (contrôlé par l'API) ; sans identifiant de produit Chariow, le pack n'est pas en vente.
 */
export function PackEditor({
  pack,
  unitValueUsd,
  feeRate,
}: {
  pack?: AdminCreditPackResponse;
  /** Valeur interne d'un crédit (paramètre financier). */
  unitValueUsd: number | null;
  /** Frais du prestataire de paiement inclus dans le prix (paramètre financier). */
  feeRate: number | null;
}) {
  const t = useTranslations('common.admin.finance.packs');
  const format = useFormatter();
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState(pack?.sku ?? '');
  const [name, setName] = useState(pack?.name ?? '');
  const [credits, setCredits] = useState(pack ? String(pack.credits) : '');
  const [price, setPrice] = useState(pack?.priceUsd ?? '');
  const [productId, setProductId] = useState(pack?.chariowProductId ?? '');
  const [active, setActive] = useState(pack?.isActive ?? false);
  const [order, setOrder] = useState(pack ? String(pack.sortOrder) : '0');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Aide au prix : valeur des crédits, prix conseillé frais inclus, net estimé pour le prix saisi.
  const creditsNumber = Number(credits);
  const creditsValue =
    unitValueUsd !== null && creditsNumber > 0
      ? Math.round(unitValueUsd * creditsNumber * 100) / 100
      : null;
  const suggested =
    creditsValue !== null && feeRate !== null ? packPriceWithFees(creditsValue, feeRate) : null;
  const typed = Number(price.replace(',', '.'));
  const net = feeRate !== null && typed > 0 ? typed * (1 - feeRate) : null;
  const usd = (value: number) =>
    format.number(value, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      sku: sku.trim(),
      name: name.trim(),
      credits: Number(credits),
      priceUsd: price.replace(',', '.').trim(),
      chariowProductId: productId.trim() || null,
      isActive: active,
      sortOrder: Number(order) || 0,
    };
    try {
      if (pack) await api.put(`/admin/credit-packs/${pack.id}`, body);
      else await api.post('/admin/credit-packs', body);
      toast.success(t('saved'));
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(fromApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {pack ? (
        <Button variant="ghost" size="sm" icon={PencilLine} onClick={() => setOpen(true)}>
          {t('edit')}
        </Button>
      ) : (
        <Button variant="secondary" icon={PackagePlus} onClick={() => setOpen(true)}>
          {t('add')}
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={pack ? t('editTitle', { name: pack.name }) : t('add')}
        description={t('rule')}
      >
        <form className="grid gap-4" onSubmit={submit} noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('sku')}
              name="sku"
              icon={Hash}
              placeholder={t('skuPlaceholder')}
              value={sku}
              onChange={(event) => setSku(event.target.value.toLowerCase())}
              required
            />
            <FormField
              label={t('name')}
              name="name"
              icon={Tag}
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <FormField
              label={t('credits')}
              name="credits"
              inputMode="numeric"
              icon={Coins}
              placeholder={t('creditsPlaceholder')}
              value={credits}
              onChange={(event) => setCredits(event.target.value.replace(/\D/g, ''))}
              required
            />
            <FormField
              label={t('price')}
              name="priceUsd"
              inputMode="decimal"
              icon={DollarSign}
              placeholder={t('pricePlaceholder')}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </div>
          {creditsValue !== null && (
            <div className="grid gap-1 rounded-lg border border-line bg-surface-2/50 p-3 text-[13px]">
              <p>{t('value', { value: usd(creditsValue) })}</p>
              {suggested !== null && feeRate !== null && (
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-fg">
                    {t('suggested', {
                      rate: format.number(feeRate, { style: 'percent' }),
                      price: usd(suggested),
                    })}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={Check}
                    onClick={() => setPrice(suggested.toFixed(2))}
                  >
                    {t('useSuggested')}
                  </Button>
                </p>
              )}
              {net !== null && <p>{t('net', { net: usd(net) })}</p>}
            </div>
          )}
          <FormField
            label={t('productId')}
            name="chariowProductId"
            icon={Link2}
            placeholder={t('productIdPlaceholder')}
            hint={t('productIdHint')}
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <FormField
              label={t('order')}
              name="sortOrder"
              inputMode="numeric"
              icon={Hash}
              placeholder="1"
              value={order}
              onChange={(event) => setOrder(event.target.value.replace(/\D/g, ''))}
            />
            <Checkbox
              name="isActive"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              label={t('active')}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" icon={X} onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" icon={Save} loading={busy}>
              {t('save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
