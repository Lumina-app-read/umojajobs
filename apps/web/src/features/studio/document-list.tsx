'use client';

import {
  AVAILABLE_DOCUMENT_TYPES,
  CAREER_DOCUMENT_TYPES,
  type CareerDocumentResponse,
  type CareerDocumentSummary,
  type CareerDocumentType,
  STUDIO_LIMITS,
} from '@opportinities/shared';
import {
  ArrowRight,
  FileText,
  FileUser,
  Languages,
  Mail,
  PenLine,
  Plus,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/feedback';
import { FormSelect } from '@/components/ui/form-controls';
import { FormField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import { cn } from '@/lib/cn';

type DocLanguage = 'fr' | 'en';

const TYPE_ICONS: Record<CareerDocumentType, typeof FileText> = {
  cv: FileUser,
  cover_letter: Mail,
  application_letter: Mail,
  internship_request: Mail,
  recommendation_draft: PenLine,
  resignation_letter: FileText,
  follow_up_letter: Mail,
  thank_you_letter: Mail,
};

/** Création d'un document : titre et langue, puis ouverture de l'éditeur. */
function CreateDialog({ type, onClose }: { type: CareerDocumentType | null; onClose: () => void }) {
  const t = useTranslations('studio.list');
  const locale = useLocale();
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<DocLanguage>(locale === 'en' ? 'en' : 'fr');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!type) return;
    const trimmed = title.trim() || t(`types.${type}`);
    setPending(true);
    setError(null);
    try {
      const created = await api.post<CareerDocumentResponse>('/me/career-documents', {
        type,
        title: trimmed,
        language,
      });
      router.push(`/dashboard/studio/${created.id}`);
    } catch (caught) {
      setError(fromApiError(caught).message);
      setPending(false);
    }
  }

  return (
    <Dialog
      open={type !== null}
      onClose={onClose}
      title={type ? `${t('createTitle')} : ${t(`types.${type}`)}` : ''}
      footer={
        <>
          <Button type="button" variant="secondary" icon={X} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" form="studio-create-form" icon={Plus} loading={pending}>
            {t('create')}
          </Button>
        </>
      }
    >
      <form id="studio-create-form" onSubmit={submit} className="grid gap-5">
        <FormField
          label={t('newTitle')}
          name="title"
          icon={Type}
          placeholder={t('newTitlePlaceholder')}
          hint={t('newTitleHint')}
          maxLength={STUDIO_LIMITS.titleMax}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={error}
          autoFocus
        />
        <FormSelect<DocLanguage>
          label={t('language')}
          icon={Languages}
          placeholder={t('language')}
          value={language}
          onChange={(value) => value && setLanguage(value)}
          options={[
            { value: 'fr', label: t('languages.fr') },
            { value: 'en', label: t('languages.en') },
          ]}
        />
      </form>
    </Dialog>
  );
}

/** Liste des documents et choix du type à créer. */
export function StudioDocuments({ documents }: { documents: CareerDocumentSummary[] }) {
  const t = useTranslations('studio.list');
  const format = useFormatter();
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [creating, setCreating] = useState<CareerDocumentType | null>(null);
  const [deleting, setDeleting] = useState<CareerDocumentSummary | null>(null);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    try {
      await api.delete(`/me/career-documents/${deleting.id}`);
      toast.success(t('deleted'));
      setDeleting(null);
      router.refresh();
    } catch (caught) {
      toast.error(fromApiError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8">
      <section aria-labelledby="studio-create" className="grid gap-3">
        <h2 id="studio-create" className="text-[15px] font-semibold text-fg">
          {t('createTitle')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CAREER_DOCUMENT_TYPES.map((type) => {
            const available = AVAILABLE_DOCUMENT_TYPES.includes(type);
            const Icon = TYPE_ICONS[type];
            return (
              <li key={type}>
                <button
                  type="button"
                  disabled={!available}
                  onClick={() => setCreating(type)}
                  className={cn(
                    'group flex h-full w-full items-start gap-3 rounded-xl border bg-surface p-4 text-left shadow-xs',
                    'transition-[border-color,box-shadow,transform] duration-[120ms]',
                    available
                      ? 'lift border-line hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none'
                      : 'cursor-not-allowed border-dashed border-line opacity-70',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-lg',
                      available ? 'bg-primary-soft text-brand' : 'bg-surface-2 text-fg-subtle',
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-fg">{t(`types.${type}`)}</span>
                      {!available && <Badge tone="neutral">{t('soon')}</Badge>}
                    </span>
                    {type === 'cv' && (
                      <span className="mt-1 block text-[13px] text-fg-muted">
                        {t('typeHints.cv')}
                      </span>
                    )}
                  </span>
                  {available && (
                    <Plus
                      className="size-4 shrink-0 text-fg-subtle transition-colors group-hover:text-brand"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="studio-mine" className="grid gap-3">
        <h2 id="studio-mine" className="text-[15px] font-semibold text-fg">
          {t('myDocuments')}
        </h2>
        {documents.length === 0 ? (
          <EmptyState
            icon={FileUser}
            title={t('empty')}
            description={t('emptyBody')}
            className="bg-surface py-12"
            action={
              <Button icon={Plus} onClick={() => setCreating('cv')}>
                {t('types.cv')}
              </Button>
            }
          />
        ) : (
          <ul className="stagger grid gap-3">
            {documents.map((document) => {
              const Icon = TYPE_ICONS[document.type];
              return (
                <li
                  key={document.id}
                  className="lift flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs sm:flex-row sm:items-center"
                >
                  <span className="hidden size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand sm:grid">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[15px] font-semibold text-fg">{document.title}</p>
                      <Badge tone="primary">{t(`types.${document.type}`)}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-fg-muted">
                      {[
                        t(`languages.${document.language}`),
                        t('updated', {
                          date: format.dateTime(new Date(document.updatedAt), {
                            dateStyle: 'medium',
                          }),
                        }),
                      ].join(' · ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <ButtonLink
                      href={`/dashboard/studio/${document.id}`}
                      variant="secondary"
                      trailingIcon={ArrowRight}
                    >
                      {t('open')}
                    </ButtonLink>
                    <Button
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => setDeleting(document)}
                      aria-label={`${t('delete')} : ${document.title}`}
                    >
                      <span className="sm:sr-only">{t('delete')}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <CreateDialog key={creating ?? 'none'} type={creating} onClose={() => setCreating(null)} />

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        size="sm"
        title={deleting ? t('deleteTitle', { title: deleting.title }) : ''}
        description={t('deleteBody')}
        footer={
          <>
            <Button variant="secondary" icon={X} onClick={() => setDeleting(null)}>
              {t('cancel')}
            </Button>
            <Button variant="danger" icon={Trash2} loading={pending} onClick={confirmDelete}>
              {t('delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}
