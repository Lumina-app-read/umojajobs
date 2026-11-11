import { countryName, type JobOfferStatus, PERMISSIONS } from '@opportinities/shared';
import { ArrowLeft, Copy, FileText, Paperclip, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { type ReactNode } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { DecisionPanel, ModerationDownload } from '@/features/moderation/decision-panel';
import { getModerationOffer } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

const STATUS_TONE: Record<JobOfferStatus, BadgeTone> = {
  draft: 'neutral',
  pending_review: 'primary',
  needs_correction: 'warning',
  scheduled: 'primary',
  active: 'success',
  expired: 'neutral',
  rejected: 'danger',
  suspended: 'danger',
  archived: 'neutral',
};

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.JOBS_MODERATE))) return {};
  const t = await getTranslations('jobs.moderation');
  return { title: t('title') };
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Liste de définitions : une ligne par information, « Non renseigné » si elle manque. */
function Details({ rows, empty }: { rows: [string, ReactNode][]; empty: string }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr] sm:gap-4">
          <dt className="text-[13px] text-fg-muted">{label}</dt>
          <dd className="text-sm text-fg break-words whitespace-pre-line">
            {value === null || value === undefined || value === '' ? (
              <span className="text-fg-subtle">{empty}</span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Fiche de modération : tout le contenu (privé compris), doublons, documents, historique. */
export default async function ModerationOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.JOBS_MODERATE);
  const { id } = await params;
  const offer = /^[0-9a-f-]{36}$/i.test(id) ? await getModerationOffer(id) : null;
  if (!offer) notFound();

  const t = await getTranslations('jobs');
  const format = await getFormatter();
  const locale = await getLocale();
  const empty = t('moderation.notProvided');
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { dateStyle: 'long' });
  const money = (value: string) => format.number(Number(value), { maximumFractionDigits: 2 });
  const currency = offer.salaryCurrency ?? '';
  const salary =
    offer.salaryMin && offer.salaryMax
      ? t('moderation.salaryRange', {
          min: money(offer.salaryMin),
          max: money(offer.salaryMax),
          currency,
        })
      : offer.salaryMin
        ? t('moderation.salaryFrom', { min: money(offer.salaryMin), currency })
        : offer.salaryMax
          ? t('moderation.salaryUpTo', { max: money(offer.salaryMax), currency })
          : null;
  const by = {
    contributor: t('moderation.byContributor'),
    moderator: t('moderation.byModerator'),
    system: t('moderation.bySystem'),
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <ButtonLink href="/admin/moderation" variant="ghost" size="sm" icon={ArrowLeft}>
            {t('moderation.back')}
          </ButtonLink>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            {offer.title ?? t('publications.untitled')}
          </h1>
          <Badge tone={STATUS_TONE[offer.status]} dot>
            {t(`enums.status.${offer.status}`)}
          </Badge>
        </div>
        <p className="text-sm text-fg-muted">
          {[
            offer.companyName,
            offer.city?.name,
            offer.countryIso2 && countryName(offer.countryIso2, locale),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="grid gap-6">
          <Panel title={t('moderation.details')}>
            <Details
              empty={empty}
              rows={[
                [
                  t('form.fields.category'),
                  offer.category
                    ? locale === 'fr'
                      ? offer.category.nameFr
                      : offer.category.nameEn
                    : null,
                ],
                [
                  t('form.fields.contractType'),
                  offer.contractType ? t(`enums.contractType.${offer.contractType}`) : null,
                ],
                [
                  t('form.fields.workMode'),
                  offer.workMode ? t(`enums.workMode.${offer.workMode}`) : null,
                ],
                [
                  t('form.fields.experienceLevel'),
                  offer.experienceLevel
                    ? t(`enums.experienceLevel.${offer.experienceLevel}`)
                    : null,
                ],
                [
                  t('form.fields.educationLevel'),
                  offer.educationLevel ? t(`enums.educationLevel.${offer.educationLevel}`) : null,
                ],
                [
                  t('form.sections.validity'),
                  offer.startDate && offer.endDate
                    ? t('moderation.validity', {
                        start: day(offer.startDate),
                        end: day(offer.endDate),
                      })
                    : null,
                ],
                [t('form.sections.salary'), salary],
                [t('form.fields.description'), offer.description],
                [t('form.fields.requirements'), offer.requirements],
                [t('form.fields.skills'), offer.skills.length > 0 ? offer.skills.join(', ') : null],
                [
                  t('form.fields.sourceType'),
                  offer.sourceType ? t(`enums.sourceType.${offer.sourceType}`) : null,
                ],
                [
                  t('form.fields.sourceUrl'),
                  offer.sourceUrl ? (
                    <a
                      href={offer.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-brand underline-offset-2 hover:underline"
                    >
                      {offer.sourceUrl}
                    </a>
                  ) : null,
                ],
                [t('form.fields.sourceDetails'), offer.sourceDetails],
              ]}
            />
          </Panel>

          <Panel title={t('moderation.privateInfo')}>
            <Details
              empty={empty}
              rows={[
                [t('form.fields.applicationInstructions'), offer.applicationInstructions],
                [t('form.fields.applicationEmail'), offer.applicationEmail],
                [t('form.fields.applicationUrl'), offer.applicationUrl],
                [t('form.fields.applicationAddress'), offer.applicationAddress],
                [t('form.fields.applicationPhone'), offer.applicationPhone],
                [t('form.fields.contributorTips'), offer.contributorTips],
              ]}
            />
          </Panel>

          <Panel title={t('moderation.documents')}>
            {offer.files.length === 0 ? (
              <p className="text-sm text-fg-muted">{t('moderation.noDocuments')}</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {offer.files.map((file) => (
                  <li key={file.id} className="flex items-center gap-3 px-3.5 py-3">
                    {file.kind === 'original' ? (
                      <FileText className="size-[18px] text-brand" aria-hidden="true" />
                    ) : (
                      <Paperclip className="size-[18px] text-fg-subtle" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{file.originalName}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                        {file.kind === 'original'
                          ? t('form.upload.originalLabel')
                          : t('form.upload.attachmentLabel')}
                        {file.deletedAt && (
                          <Badge tone="warning">{t('moderation.removedDoc')}</Badge>
                        )}
                      </p>
                    </div>
                    <ModerationDownload
                      offerId={offer.id}
                      fileId={file.id}
                      label={`${t('moderation.download')} ${file.originalName}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t('moderation.history')}>
            <ol className="grid gap-3">
              {offer.history.map((change) => (
                <li key={change.id} className="flex gap-3">
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-fg">
                      <span className="font-semibold">{t(`enums.status.${change.toStatus}`)}</span>
                      <span className="text-fg-muted"> · {by[change.by]}</span>
                    </p>
                    <p className="text-xs text-fg-subtle">
                      {format.dateTime(new Date(change.createdAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    {change.reason && (
                      <p className="mt-1 text-[13px] text-fg-muted">{change.reason}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="grid gap-6 lg:sticky lg:top-24">
          <DecisionPanel offer={offer} isOwnOffer={offer.contributor.id === user.id} />

          <Panel title={t('moderation.contributor')}>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-brand">
                <UserRound className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">
                  {offer.contributor.firstName} {offer.contributor.lastName}
                </p>
                <p className="truncate text-xs text-fg-muted">{offer.contributor.email}</p>
              </div>
            </div>
          </Panel>

          <Panel title={t('moderation.duplicates')}>
            <p className="-mt-2 mb-3 text-[13px] text-fg-muted">{t('moderation.duplicatesHint')}</p>
            {offer.duplicates.length === 0 ? (
              <p className="text-sm text-fg-muted">{t('moderation.noDuplicates')}</p>
            ) : (
              <ul className="grid gap-2">
                {offer.duplicates.map((duplicate) => (
                  <li key={duplicate.id}>
                    <a
                      href={`/${locale}/admin/moderation/${duplicate.id}`}
                      className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:bg-surface-2"
                    >
                      <Copy className="size-4 text-warning" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-fg">
                        {duplicate.title ?? t('publications.untitled')}
                      </span>
                      <Badge tone={STATUS_TONE[duplicate.status]}>
                        {t(`enums.status.${duplicate.status}`)}
                      </Badge>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
