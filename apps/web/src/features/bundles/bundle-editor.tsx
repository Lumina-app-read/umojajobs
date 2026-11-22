'use client';

import {
  BUNDLE_LIMITS,
  type BundleExportResponse,
  type BundleFileResponse,
  type BundleResponse,
  type CareerExportDownloadResponse,
  DOCUMENT_FILE_ACCEPT,
} from '@opportinities/shared';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarCheck,
  Coins,
  Download,
  FileDown,
  FilePlus2,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type DragEvent, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/feedback';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api, apiUpload } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/use-form-errors';
import { randomUuid } from '@/lib/uuid';

/**
 * Dossier rassemblé : les fichiers sont envoyés un par un, ordonnés librement, puis exportés en un
 * seul PDF payé en crédits. Ajout, ordre et retrait sont gratuits.
 */
export function BundleEditor({ initial }: { initial: BundleResponse }) {
  const t = useTranslations('bundles');
  const tExport = useTranslations('studio.export');
  const format = useFormatter();
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const input = useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = useState(initial);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [rejected, setRejected] = useState<{ name: string; message: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dialog, setDialog] = useState<'export' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Une clé par tentative : un double clic rejoue la même demande au lieu de payer deux fois. */
  const attempt = useRef<string | null>(null);

  const path = `/me/document-bundles/${bundle.id}`;
  const working = uploading !== null || busy !== null;
  const pages = bundle.files.reduce((sum, file) => sum + file.pageCount, 0);
  const enough = bundle.files.length >= BUNDLE_LIMITS.filesMin;
  const full = bundle.files.length >= BUNDLE_LIMITS.filesMax;
  const covered = bundle.coveredUntil ? new Date(bundle.coveredUntil) : null;
  const insufficient = !covered && bundle.cost !== null && bundle.balance < bundle.cost;
  const canPay = covered !== null || (bundle.cost !== null && !insufficient);
  const size = (bytes: number) =>
    bytes < 1024 * 1024
      ? t('kilobytes', { size: format.number(Math.max(1, Math.round(bytes / 1024))) })
      : t('megabytes', {
          size: format.number(bytes / 1024 / 1024, { maximumFractionDigits: 1 }),
        });
  const day = (value: string | Date) => format.dateTime(new Date(value), { dateStyle: 'medium' });

  async function upload(files: File[]) {
    if (files.length === 0 || working) return;
    const problems: { name: string; message: string }[] = [];
    setRejected([]);
    for (const [index, file] of files.entries()) {
      setUploading({ done: index + 1, total: files.length });
      if (file.size > BUNDLE_LIMITS.fileMaxBytes) {
        problems.push({ name: file.name, message: t('tooLarge') });
        continue;
      }
      try {
        const form = new FormData();
        form.append('file', file);
        setBundle(await apiUpload<BundleResponse>(`${path}/files`, form));
      } catch (caught) {
        problems.push({ name: file.name, message: fromApiError(caught).message });
      }
    }
    setUploading(null);
    setRejected(problems);
    if (problems.length < files.length) toast.success(t('added'));
    if (input.current) input.current.value = '';
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void upload([...event.dataTransfer.files]);
  }

  async function change(key: string, action: () => Promise<BundleResponse>) {
    setBusy(key);
    try {
      setBundle(await action());
    } catch (caught) {
      toast.error(fromApiError(caught).message);
    } finally {
      setBusy(null);
    }
  }

  function move(index: number, step: 1 | -1) {
    const ids = bundle.files.map((file) => file.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + step, 0, moved!);
    void change(`move-${moved}`, () => api.patch<BundleResponse>(path, { fileIds: ids }));
  }

  async function download(exportId: string) {
    try {
      const { url } = await api.get<CareerExportDownloadResponse>(
        `${path}/exports/${exportId}/download`,
      );
      window.location.assign(url);
    } catch (caught) {
      toast.error(fromApiError(caught).message);
    }
  }

  async function exportPdf() {
    attempt.current ??= randomUuid();
    setBusy('export');
    setError(null);
    try {
      const result = await api.post<BundleExportResponse>(`${path}/exports`, {
        idempotencyKey: attempt.current,
      });
      attempt.current = null;
      setBundle(result.bundle);
      setDialog(null);
      toast.success(t('exported'));
      await download(result.id);
    } catch (caught) {
      // Une nouvelle tentative reçoit une nouvelle clé (sans second débit côté API).
      attempt.current = null;
      setError(fromApiError(caught).message);
      await api
        .get<BundleResponse>(path)
        .then(setBundle)
        .catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('delete');
    try {
      await api.delete(path);
      toast.success(t('deleted'));
      router.push('/dashboard/bundles');
      router.refresh();
    } catch (caught) {
      toast.error(fromApiError(caught).message);
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <ButtonLink href="/dashboard/bundles" variant="link" size="sm" icon={ArrowLeft}>
            {t('back')}
          </ButtonLink>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] break-words text-fg sm:text-[28px]">
            {bundle.title}
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            {[t('files', { count: bundle.files.length }), t('pages', { count: pages })].join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:shrink-0">
          <Button
            variant="secondary"
            icon={Trash2}
            disabled={working}
            onClick={() => setDialog('delete')}
          >
            {t('delete')}
          </Button>
          <Button
            icon={FileDown}
            disabled={!enough || working}
            onClick={() => {
              setError(null);
              attempt.current = null;
              setDialog('export');
            }}
          >
            {t('export')}
          </Button>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          'grid justify-items-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary-soft' : 'border-line-strong bg-surface',
        )}
      >
        <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-brand">
          <Upload className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-fg">{t('addTitle')}</p>
          <p className="mt-1 text-sm text-fg-muted sm:text-[13px]">{t('addHint')}</p>
        </div>
        <Button
          variant="secondary"
          icon={FilePlus2}
          disabled={full || working}
          loading={uploading !== null}
          loadingLabel={uploading ? t('uploading', uploading) : undefined}
          onClick={() => input.current?.click()}
        >
          {t('add')}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept={DOCUMENT_FILE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => void upload([...(event.target.files ?? [])])}
        />
      </div>

      {rejected.length > 0 && (
        <Alert tone="error">
          <ul className="grid gap-1">
            {rejected.map((problem, index) => (
              <li key={index} className="break-words">
                <span className="font-semibold">{problem.name}</span> : {problem.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <section aria-labelledby="bundle-files" className="grid gap-3">
        <div>
          <h2 id="bundle-files" className="text-[15px] font-semibold text-fg">
            {t('order')}
          </h2>
          <p className="mt-0.5 text-sm text-fg-muted sm:text-[13px]">{t('orderHint')}</p>
        </div>
        {bundle.files.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t('noFiles')}
            description={t('noFilesBody')}
            className="bg-surface py-10"
          />
        ) : (
          <ol className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
            {bundle.files.map((file, index) => (
              <FileRow
                key={file.id}
                file={file}
                position={index + 1}
                detail={[t('pages', { count: file.pageCount }), size(file.sizeBytes)].join(' · ')}
                first={index === 0}
                last={index === bundle.files.length - 1}
                disabled={working}
                removing={busy === `remove-${file.id}`}
                onMove={(step) => move(index, step)}
                onRemove={() =>
                  void change(`remove-${file.id}`, () =>
                    api.delete<BundleResponse>(`${path}/files/${file.id}`),
                  )
                }
              />
            ))}
          </ol>
        )}
        {!enough && bundle.files.length > 0 && (
          <p className="text-sm text-fg-muted sm:text-[13px]">{t('tooFew')}</p>
        )}
      </section>

      {bundle.exports.length > 0 && (
        <section aria-labelledby="bundle-exports" className="grid gap-3">
          <h2 id="bundle-exports" className="text-[15px] font-semibold text-fg">
            {t('exports')}
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
            {bundle.exports.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-fg">
                    {[
                      format.dateTime(new Date(entry.createdAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                      entry.pageCount === null ? null : t('pages', { count: entry.pageCount }),
                      entry.sizeBytes === null ? null : size(entry.sizeBytes),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="mt-1.5 flex gap-1.5">
                    <Badge
                      dot
                      tone={
                        entry.status === 'ready'
                          ? 'success'
                          : entry.status === 'failed'
                            ? 'danger'
                            : 'primary'
                      }
                    >
                      {tExport(entry.status)}
                    </Badge>
                    {entry.status === 'ready' && (
                      <Badge tone="neutral">
                        {entry.charged ? tExport('paid') : tExport('included')}
                      </Badge>
                    )}
                  </div>
                </div>
                {entry.status === 'ready' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Download}
                    onClick={() => void download(entry.id)}
                  >
                    {tExport('download')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="flex items-start gap-2 text-sm text-fg-subtle sm:text-[13px]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t('privacy')}
      </p>

      <Dialog
        open={dialog === 'export'}
        onClose={() => busy !== 'export' && setDialog(null)}
        title={t('exportTitle')}
        description={t('exportIntro', { files: bundle.files.length, pages })}
        footer={
          <>
            <Button
              variant="secondary"
              icon={X}
              disabled={busy === 'export'}
              onClick={() => setDialog(null)}
            >
              {t('cancel')}
            </Button>
            <Button
              icon={FileDown}
              loading={busy === 'export'}
              loadingLabel={tExport('exporting')}
              disabled={!canPay}
              onClick={() => void exportPdf()}
            >
              {covered || bundle.cost === null
                ? tExport('exportFree')
                : tExport('pay', { count: bundle.cost })}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {covered ? (
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-soft p-3.5">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <div>
                <p className="font-semibold text-fg">
                  {tExport('covered', { date: day(covered) })}
                </p>
                <p className="mt-0.5 text-sm sm:text-[13px]">{t('coveredBody')}</p>
              </div>
            </div>
          ) : bundle.cost === null ? (
            <Alert tone="warning">{tExport('priceMissing')}</Alert>
          ) : (
            <div className="grid gap-2 rounded-lg border border-line bg-surface-2/50 p-3.5">
              <p className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Coins className="size-4 text-fg-subtle" aria-hidden="true" />
                  {tExport('cost')}
                </span>
                <span className="font-semibold text-fg">
                  {tExport('credits', { count: bundle.cost })}
                </span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Wallet className="size-4 text-fg-subtle" aria-hidden="true" />
                  {tExport('balance')}
                </span>
                <span className="font-semibold text-fg">
                  {tExport('credits', { count: bundle.balance })}
                </span>
              </p>
              <p className="text-sm sm:text-[13px]">
                {tExport('window', { days: bundle.reexportWindowDays })}
              </p>
            </div>
          )}
          {insufficient && (
            <Alert tone="warning">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{tExport('insufficient')}</span>
                <ButtonLink href="/dashboard/credits" size="sm" variant="secondary" icon={Coins}>
                  {tExport('topUp')}
                </ButtonLink>
              </div>
            </Alert>
          )}
          {error && <Alert tone="error">{error}</Alert>}
        </div>
      </Dialog>

      <Dialog
        open={dialog === 'delete'}
        onClose={() => busy !== 'delete' && setDialog(null)}
        size="sm"
        title={t('deleteTitle')}
        description={t('deleteBody')}
        footer={
          <>
            <Button
              variant="secondary"
              icon={X}
              disabled={busy === 'delete'}
              onClick={() => setDialog(null)}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              loading={busy === 'delete'}
              onClick={() => void remove()}
            >
              {t('delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}

function FileRow({
  file,
  position,
  detail,
  first,
  last,
  disabled,
  removing,
  onMove,
  onRemove,
}: {
  file: BundleFileResponse;
  position: number;
  detail: string;
  first: boolean;
  last: boolean;
  disabled: boolean;
  removing: boolean;
  onMove: (step: 1 | -1) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('bundles');
  const Icon = file.kind === 'image' ? ImageIcon : FileText;
  return (
    <li className="flex items-center gap-3 px-3.5 py-3">
      <span className="w-5 shrink-0 text-center text-sm font-semibold text-fg-subtle tabular-nums">
        {position}
      </span>
      <span className="hidden size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand sm:grid">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{file.originalName}</p>
        <p className="mt-0.5 text-xs text-fg-muted">{detail}</p>
      </div>
      <div className="flex shrink-0">
        <IconButton
          icon={ArrowUp}
          label={t('moveUp', { name: file.originalName })}
          disabled={disabled || first}
          onClick={() => onMove(-1)}
        />
        <IconButton
          icon={ArrowDown}
          label={t('moveDown', { name: file.originalName })}
          disabled={disabled || last}
          onClick={() => onMove(1)}
        />
        <IconButton
          icon={Trash2}
          label={t('removeFile', { name: file.originalName })}
          loading={removing}
          disabled={disabled}
          onClick={onRemove}
        />
      </div>
    </li>
  );
}
