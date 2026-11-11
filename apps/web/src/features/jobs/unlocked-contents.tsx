'use client';

import { type UnlockedContentsResponse } from '@opportinities/shared';
import { AtSign, ExternalLink, Lightbulb, ListChecks, MapPinned, Phone } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { DocumentViewer } from './document-viewer';

/** Seuls les liens web sont rendus cliquables (jamais javascript:, data:, etc.). */
const isWebUrl = (value: string) => /^https?:\/\//i.test(value);

/** Coordonnées, conseils et documents révélés après déverrouillage (règlement accepté). */
export function UnlockedContents({ contents }: { contents: UnlockedContentsResponse }) {
  const t = useTranslations('jobs.unlock');
  const format = useFormatter();

  const row = 'flex items-start gap-3 text-sm';
  const icon = 'mt-0.5 size-4 shrink-0 text-fg-subtle';

  return (
    <div className="grid gap-4">
      <p className="text-xs text-fg-subtle">
        {t('unlockedOn', {
          date: format.dateTime(new Date(contents.unlockedAt), { dateStyle: 'long' }),
        })}
      </p>
      <dl className="grid gap-3.5">
        {contents.applicationUrl && (
          <div className={row}>
            <ExternalLink className={icon} aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs text-fg-subtle">{t('url')}</dt>
              <dd className="font-medium break-all">
                {isWebUrl(contents.applicationUrl) ? (
                  <a
                    href={contents.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-brand hover:underline"
                  >
                    {contents.applicationUrl}
                  </a>
                ) : (
                  <span className="text-fg">{contents.applicationUrl}</span>
                )}
              </dd>
            </div>
          </div>
        )}
        {contents.applicationEmail && (
          <div className={row}>
            <AtSign className={icon} aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs text-fg-subtle">{t('email')}</dt>
              <dd>
                <a
                  href={`mailto:${contents.applicationEmail}`}
                  className="font-medium break-all text-brand hover:underline"
                >
                  {contents.applicationEmail}
                </a>
              </dd>
            </div>
          </div>
        )}
        {contents.applicationPhone && (
          <div className={row}>
            <Phone className={icon} aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs text-fg-subtle">{t('phone')}</dt>
              <dd>
                <a
                  href={`tel:${contents.applicationPhone}`}
                  className="font-medium text-brand hover:underline"
                >
                  {contents.applicationPhone}
                </a>
              </dd>
            </div>
          </div>
        )}
        {contents.applicationAddress && (
          <div className={row}>
            <MapPinned className={icon} aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs text-fg-subtle">{t('address')}</dt>
              <dd className="font-medium whitespace-pre-line text-fg">
                {contents.applicationAddress}
              </dd>
            </div>
          </div>
        )}
        {contents.applicationInstructions && (
          <div className={row}>
            <ListChecks className={icon} aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs text-fg-subtle">{t('instructions')}</dt>
              <dd className="whitespace-pre-line text-fg">{contents.applicationInstructions}</dd>
            </div>
          </div>
        )}
      </dl>
      {contents.contributorTips && (
        <div className="rounded-lg border border-warning/30 bg-warning-soft/60 p-3.5">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
            <Lightbulb className="size-4 text-warning" aria-hidden="true" />
            {t('tipsTitle', { name: contents.publishedBy })}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-line text-fg-muted">
            {contents.contributorTips}
          </p>
        </div>
      )}
      {contents.files.length > 0 && (
        <DocumentViewer jobOfferId={contents.jobOfferId} files={contents.files} />
      )}
    </div>
  );
}
