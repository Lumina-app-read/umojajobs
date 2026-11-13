'use client';

import {
  type CareerExportDownloadResponse,
  type CareerExportResponse,
  type CareerExportsResponse,
  type CareerExportSummary,
  type CvTemplate,
} from '@opportinities/shared';
import { CalendarCheck, Coins, Download, FileDown, Wallet, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/feedback';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

const STATUS_TONE: Record<CareerExportSummary['status'], BadgeTone> = {
  ready: 'success',
  pending: 'primary',
  failed: 'danger',
};

/** Lance le téléchargement du PDF (lien signé de courte durée, servi en pièce jointe). */
async function startDownload(exportId: string): Promise<void> {
  const { url } = await api.get<CareerExportDownloadResponse>(
    `/me/career-exports/${exportId}/download`,
  );
  window.location.assign(url);
}

/**
 * Export PDF payé en crédits. Le coût et le solde sont affichés avant toute action ; pendant la
 * période de ré-export gratuit, aucun crédit n'est débité. Le PDF reflète le document enregistré :
 * l'export attend la fin de l'enregistrement automatique.
 */
export function ExportDialog({
  documentId,
  saved,
  disabled,
}: {
  documentId: string;
  /** Toutes les modifications sont enregistrées (le PDF part du document enregistré). */
  saved: boolean;
  disabled: boolean;
}) {
  const t = useTranslations('studio.export');
  const tTemplates = useTranslations('studio.editor.templates');
  const format = useFormatter();
  const { fromApiError } = useFormErrors();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<CareerExportsResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Une clé par tentative : un double clic rejoue la même demande au lieu de payer deux fois. */
  const attemptKey = useRef<string | null>(null);

  async function load() {
    setLoadError(false);
    try {
      setInfo(await api.get<CareerExportsResponse>(`/me/career-documents/${documentId}/exports`));
    } catch {
      setLoadError(true);
    }
  }

  function openDialog() {
    setOpen(true);
    setError(null);
    attemptKey.current = null;
    void load();
  }

  async function exportPdf() {
    attemptKey.current ??= crypto.randomUUID();
    setPending(true);
    setError(null);
    try {
      const result = await api.post<CareerExportResponse>(
        `/me/career-documents/${documentId}/exports`,
        { idempotencyKey: attemptKey.current },
      );
      attemptKey.current = null;
      toast.success(t('done'));
      await startDownload(result.id);
      await load();
    } catch (caught) {
      // Après une erreur, une nouvelle tentative reçoit une nouvelle clé (sans double débit côté API).
      attemptKey.current = null;
      setError(fromApiError(caught).message);
      await load();
    } finally {
      setPending(false);
    }
  }

  async function download(exportId: string) {
    try {
      await startDownload(exportId);
    } catch (caught) {
      toast.error(fromApiError(caught).message);
    }
  }

  const covered = info?.coveredUntil ? new Date(info.coveredUntil) : null;
  const cost = info?.cost ?? null;
  const insufficient = !covered && cost !== null && (info?.balance ?? 0) < cost;
  const canExport =
    Boolean(info) && saved && (covered !== null || (cost !== null && !insufficient));
  const day = (value: string | Date) => format.dateTime(new Date(value), { dateStyle: 'medium' });

  return (
    <>
      <Button icon={FileDown} disabled={disabled} onClick={openDialog}>
        {t('open')}
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t('title')}
        description={t('intro')}
        footer={
          <>
            <Button variant="secondary" icon={X} disabled={pending} onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              icon={FileDown}
              loading={pending}
              loadingLabel={t('exporting')}
              disabled={!canExport}
              onClick={exportPdf}
            >
              {covered || cost === null ? t('exportFree') : t('pay', { count: cost })}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {loadError && <Alert tone="error">{t('loadError')}</Alert>}
          {!info && !loadError && <Skeleton className="h-24" />}

          {info && covered && (
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-soft p-3.5">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <div>
                <p className="font-semibold text-fg">{t('covered', { date: day(covered) })}</p>
                <p className="mt-0.5 text-[13px]">{t('coveredBody')}</p>
              </div>
            </div>
          )}

          {info && !covered && cost === null && <Alert tone="warning">{t('priceMissing')}</Alert>}

          {info && !covered && cost !== null && (
            <div className="grid gap-2 rounded-lg border border-line bg-surface-2/50 p-3.5">
              <p className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Coins className="size-4 text-fg-subtle" aria-hidden="true" />
                  {t('cost')}
                </span>
                <span className="font-semibold text-fg">{t('credits', { count: cost })}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Wallet className="size-4 text-fg-subtle" aria-hidden="true" />
                  {t('balance')}
                </span>
                <span className="font-semibold text-fg">
                  {t('credits', { count: info.balance })}
                </span>
              </p>
              <p className="text-[13px]">{t('window', { days: info.reexportWindowDays })}</p>
            </div>
          )}

          {insufficient && (
            <Alert tone="warning">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{t('insufficient')}</span>
                <ButtonLink href="/dashboard/credits" size="sm" variant="secondary" icon={Coins}>
                  {t('topUp')}
                </ButtonLink>
              </div>
            </Alert>
          )}
          {!saved && <p className="text-[13px] text-warning">{t('saving')}</p>}
          {error && <Alert tone="error">{error}</Alert>}

          {info && info.exports.length > 0 && (
            <section aria-labelledby="export-history" className="grid gap-2">
              <h3 id="export-history" className="text-[13px] font-semibold text-fg">
                {t('history')}
              </h3>
              <ul className="grid divide-y divide-line rounded-lg border border-line">
                {info.exports.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-fg">
                        {day(entry.createdAt)} · {tTemplates(entry.templateKey as CvTemplate)}
                      </p>
                      <div className="mt-1 flex gap-1.5">
                        <Badge tone={STATUS_TONE[entry.status]} dot>
                          {t(entry.status)}
                        </Badge>
                        {entry.status === 'ready' && (
                          <Badge tone="neutral">{entry.charged ? t('paid') : t('included')}</Badge>
                        )}
                      </div>
                    </div>
                    {entry.status === 'ready' && (
                      <IconButton
                        icon={Download}
                        label={t('download')}
                        onClick={() => void download(entry.id)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Dialog>
    </>
  );
}
