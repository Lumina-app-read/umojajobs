'use client';

import {
  type AdminCatalogResponse,
  type AdminCategory,
  CATALOG_LIMITS,
} from '@opportinities/shared';
import { ArrowDown, ArrowUp, Eye, EyeOff, Languages, Pencil, Plus, Save, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/** Catégories : ajout, noms dans les deux langues, ordre et activation. Aucune suppression. */
export function CategoryManager({ initial }: { initial: AdminCategory[] }) {
  const t = useTranslations('common.admin.catalog');
  const { fromApiError } = useFormErrors();
  const [categories, setCategories] = useState(initial);
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<AdminCatalogResponse>, message: string) {
    setBusy(key);
    try {
      setCategories((await action()).categories);
      toast.success(message);
    } catch (caught) {
      toast.error(fromApiError(caught).message);
    } finally {
      setBusy(null);
    }
  }

  function move(index: number, step: 1 | -1) {
    const ids = categories.map((category) => category.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + step, 0, moved!);
    void run('order', () => api.put('/admin/catalog/categories/order', { ids }), t('ordered'));
  }

  return (
    <section className="grid gap-3" aria-label={t('categories')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fg-muted sm:text-[13px]">{t('categoriesHint')}</p>
        <Button icon={Plus} className="sm:shrink-0" onClick={() => setEditing('new')}>
          {t('add')}
        </Button>
      </div>
      <ol className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
        {categories.map((category, index) => (
          <li
            key={category.id}
            className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                {category.nameFr}
                {!category.isActive && <Badge tone="neutral">{t('inactive')}</Badge>}
              </p>
              <p className="mt-0.5 text-xs text-fg-muted">
                {[category.nameEn, t('offers', { count: category.offers })].join(' · ')}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <IconButton
                icon={ArrowUp}
                label={t('moveUp', { name: category.nameFr })}
                disabled={busy !== null || index === 0}
                onClick={() => move(index, -1)}
              />
              <IconButton
                icon={ArrowDown}
                label={t('moveDown', { name: category.nameFr })}
                disabled={busy !== null || index === categories.length - 1}
                onClick={() => move(index, 1)}
              />
              <IconButton
                icon={Pencil}
                label={t('editName', { name: category.nameFr })}
                disabled={busy !== null}
                onClick={() => setEditing(category)}
              />
              <IconButton
                icon={category.isActive ? EyeOff : Eye}
                label={t(category.isActive ? 'disableName' : 'enableName', {
                  name: category.nameFr,
                })}
                loading={busy === category.id}
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    category.id,
                    () =>
                      api.patch(`/admin/catalog/categories/${category.id}`, {
                        isActive: !category.isActive,
                      }),
                    t(category.isActive ? 'disabled' : 'enabled'),
                  )
                }
              />
            </div>
          </li>
        ))}
      </ol>
      <CategoryDialog
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
        category={editing}
        onClose={() => setEditing(null)}
        onSaved={(next) => {
          setCategories(next);
          setEditing(null);
          toast.success(t('saved'));
        }}
      />
    </section>
  );
}

function CategoryDialog({
  category,
  onClose,
  onSaved,
}: {
  category: AdminCategory | 'new' | null;
  onClose: () => void;
  onSaved: (categories: AdminCategory[]) => void;
}) {
  const t = useTranslations('common.admin.catalog');
  const { fromApiError } = useFormErrors();
  const current = category === 'new' ? null : category;
  const [nameFr, setNameFr] = useState(current?.nameFr ?? '');
  const [nameEn, setNameEn] = useState(current?.nameEn ?? '');
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const short = (value: string) => value.trim().length < CATALOG_LIMITS.nameMin;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setChecked(true);
    if (short(nameFr) || short(nameEn)) return;
    setBusy(true);
    setError(null);
    const body = { nameFr: nameFr.trim(), nameEn: nameEn.trim() };
    try {
      const result = current
        ? await api.patch<AdminCatalogResponse>(`/admin/catalog/categories/${current.id}`, body)
        : await api.post<AdminCatalogResponse>('/admin/catalog/categories', body);
      onSaved(result.categories);
    } catch (caught) {
      setError(fromApiError(caught).message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={category !== null}
      onClose={() => !busy && onClose()}
      title={current ? t('editTitle') : t('add')}
      description={t('dialogHint')}
      footer={
        <>
          <Button variant="secondary" icon={X} disabled={busy} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" form="category-form" icon={Save} loading={busy}>
            {t('save')}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="grid gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <FormField
          label={t('nameFr')}
          name="nameFr"
          icon={Languages}
          placeholder={t('nameFrPlaceholder')}
          maxLength={CATALOG_LIMITS.nameMax}
          value={nameFr}
          onChange={(event) => setNameFr(event.target.value)}
          error={checked && short(nameFr) ? t('nameRequired') : null}
          autoFocus
        />
        <FormField
          label={t('nameEn')}
          name="nameEn"
          icon={Languages}
          placeholder={t('nameEnPlaceholder')}
          maxLength={CATALOG_LIMITS.nameMax}
          value={nameEn}
          onChange={(event) => setNameEn(event.target.value)}
          error={checked && short(nameEn) ? t('nameRequired') : null}
        />
      </form>
    </Dialog>
  );
}
