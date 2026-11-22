'use client';

import {
  type CareerExportResponse,
  type CareerPackCandidate,
  type CareerPackInfoResponse,
  type CareerPackResponse,
} from '@opportinities/shared';
import {
  CircleAlert,
  CircleCheck,
  Coins,
  Download,
  FileUser,
  Mail,
  Package,
  RefreshCw,
  Sparkles,
  Tag,
  Wallet,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/feedback';
import { FormSelect } from '@/components/ui/form-controls';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import { randomUuid } from '@/lib/uuid';
import { startDownload } from './export-download';

interface PackPdf {
  documentId: string;
  title: string;
  state: 'exporting' | 'ready' | 'failed';
  exportId: string | null;
  error: string | null;
}

function Line({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="font-semibold text-fg">{value}</span>
    </p>
  );
}

/**
 * Pack CV + lettre : un paiement, deux PDF. Le paiement et les exports sont deux étapes distinctes ;
 * si la création d'un PDF échoue, elle se relance sans nouveau débit.
 */
export function PackButton() {
  const t = useTranslations('studio.pack');
  const tExport = useTranslations('studio.export');
  const tTypes = useTranslations('studio.list.types');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<CareerPackInfoResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [cvId, setCvId] = useState<string | null>(null);
  const [letterId, setLetterId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfs, setPdfs] = useState<PackPdf[] | null>(null);
  /** Une clé par choix de documents : relancer après une coupure rejoue le même paiement. */
  const attempt = useRef<{ pair: string; key: string } | null>(null);

  const eligible = (info?.documents ?? []).filter((entry) => entry.complete && !entry.covered);
  const cvs = eligible.filter((entry) => entry.type === 'cv');
  const letters = eligible.filter((entry) => entry.type !== 'cv');
  const cv = cvs.find((entry) => entry.id === cvId);
  const letter = letters.find((entry) => entry.id === letterId);
  const cost = info?.cost ?? null;
  const separate = info && letter && letter.type !== 'cv' ? info.separateCosts[letter.type] : null;
  const saving = separate !== null && cost !== null ? separate - cost : 0;
  const insufficient = cost !== null && (info?.balance ?? 0) < cost;
  const busy = paying || (pdfs ?? []).some((pdf) => pdf.state === 'exporting');

  async function openDialog() {
    setOpen(true);
    setError(null);
    setPdfs(null);
    setInfo(null);
    setLoadError(false);
    attempt.current = null;
    try {
      const loaded = await api.get<CareerPackInfoResponse>('/me/career-packs/info');
      const usable = loaded.documents.filter((entry) => entry.complete && !entry.covered);
      setInfo(loaded);
      setCvId(usable.find((entry) => entry.type === 'cv')?.id ?? null);
      setLetterId(usable.find((entry) => entry.type !== 'cv')?.id ?? null);
    } catch {
      setLoadError(true);
    }
  }

  function close() {
    if (busy) return;
    setOpen(false);
    // Les PDF créés rejoignent l'historique et le solde affiché change.
    if (pdfs) router.refresh();
  }

  async function exportOne(documentId: string) {
    const update = (change: Partial<PackPdf>) =>
      setPdfs((current) =>
        (current ?? []).map((pdf) => (pdf.documentId === documentId ? { ...pdf, ...change } : pdf)),
      );
    update({ state: 'exporting', error: null });
    try {
      const result = await api.post<CareerExportResponse>(
        `/me/career-documents/${documentId}/exports`,
        { idempotencyKey: randomUuid() },
      );
      update({ state: 'ready', exportId: result.id });
    } catch (caught) {
      update({ state: 'failed', error: fromApiError(caught).message });
    }
  }

  async function pay() {
    if (!cv || !letter) return;
    const pair = `${cv.id}:${letter.id}`;
    if (attempt.current?.pair !== pair) attempt.current = { pair, key: randomUuid() };
    setPaying(true);
    setError(null);
    try {
      await api.post<CareerPackResponse>('/me/career-packs', {
        cvDocumentId: cv.id,
        letterDocumentId: letter.id,
        idempotencyKey: attempt.current.key,
      });
    } catch (caught) {
      setError(fromApiError(caught).message);
      setPaying(false);
      return;
    }
    setPaying(false);
    setPdfs(
      [cv, letter].map((entry) => ({
        documentId: entry.id,
        title: entry.title,
        state: 'exporting',
        exportId: null,
        error: null,
      })),
    );
    // L'un après l'autre : chaque PDF mobilise un navigateur d'impression côté serveur.
    await exportOne(cv.id);
    await exportOne(letter.id);
  }

  async function download(exportId: string) {
    try {
      await startDownload(exportId);
    } catch (caught) {
      toast.error(fromApiError(caught).message);
    }
  }

  const label = (entry: CareerPackCandidate) =>
    entry.type === 'cv' ? entry.title : `${entry.title} (${tTypes(entry.type)})`;
  const icon = 'size-4 text-fg-subtle';

  return (
    <>
      <Button variant="secondary" icon={Package} onClick={() => void openDialog()}>
        {t('open')}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={t('title')}
        description={pdfs ? t('paidIntro') : t('intro')}
        footer={
          <>
            <Button variant="secondary" icon={X} disabled={busy} onClick={close}>
              {t('close')}
            </Button>
            {!pdfs && (
              <Button
                icon={Package}
                loading={paying}
                loadingLabel={t('paying')}
                disabled={!cv || !letter || cost === null || insufficient}
                onClick={() => void pay()}
              >
                {cost === null ? t('open') : t('pay', { count: cost })}
              </Button>
            )}
          </>
        }
      >
        {pdfs ? (
          <ul
            className="grid divide-y divide-line rounded-lg border border-line"
            aria-live="polite"
          >
            {pdfs.map((pdf) => (
              <li key={pdf.documentId} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                {pdf.state === 'exporting' && <Spinner className="size-4 shrink-0" />}
                {pdf.state === 'ready' && (
                  <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                )}
                {pdf.state === 'failed' && (
                  <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-fg">{pdf.title}</p>
                  <p className="text-[13px]">
                    {pdf.state === 'failed'
                      ? (pdf.error ?? t('failed'))
                      : pdf.state === 'ready'
                        ? tExport('ready')
                        : tExport('exporting')}
                  </p>
                </div>
                {pdf.exportId && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Download}
                    onClick={() => void download(pdf.exportId!)}
                  >
                    {tExport('download')}
                  </Button>
                )}
                {pdf.state === 'failed' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={RefreshCw}
                    disabled={busy}
                    onClick={() => void exportOne(pdf.documentId)}
                  >
                    {t('retry')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid gap-4">
            {loadError && <Alert tone="error">{tExport('loadError')}</Alert>}
            {!info && !loadError && <Skeleton className="h-40" />}
            {info && (cvs.length === 0 || letters.length === 0) && (
              <Alert tone="info">
                <div className="grid justify-items-start gap-3">
                  <span>{cvs.length === 0 ? t('noCv') : t('noLetter')}</span>
                  <ButtonLink
                    href="/dashboard/studio"
                    size="sm"
                    variant="secondary"
                    icon={Sparkles}
                  >
                    {t('toStudio')}
                  </ButtonLink>
                </div>
              </Alert>
            )}
            {info && cvs.length > 0 && letters.length > 0 && (
              <>
                <FormSelect
                  label={t('cv')}
                  icon={FileUser}
                  placeholder={t('cvPlaceholder')}
                  value={cvId}
                  onChange={setCvId}
                  options={cvs.map((entry) => ({ value: entry.id, label: label(entry) }))}
                />
                <FormSelect
                  label={t('letter')}
                  icon={Mail}
                  placeholder={t('letterPlaceholder')}
                  hint={t('eligibleHint')}
                  value={letterId}
                  onChange={setLetterId}
                  options={letters.map((entry) => ({ value: entry.id, label: label(entry) }))}
                />
                {cost === null ? (
                  <Alert tone="warning">{t('priceMissing')}</Alert>
                ) : (
                  <div className="grid gap-2 rounded-lg border border-line bg-surface-2/50 p-3.5">
                    <Line
                      icon={<Coins className={icon} aria-hidden="true" />}
                      label={t('cost')}
                      value={tExport('credits', { count: cost })}
                    />
                    {saving > 0 && (
                      <Line
                        icon={<Tag className={icon} aria-hidden="true" />}
                        label={t('saving')}
                        value={tExport('credits', { count: saving })}
                      />
                    )}
                    <Line
                      icon={<Wallet className={icon} aria-hidden="true" />}
                      label={tExport('balance')}
                      value={tExport('credits', { count: info.balance })}
                    />
                    <p className="text-sm sm:text-[13px]">
                      {tExport('window', { days: info.reexportWindowDays })}
                    </p>
                  </div>
                )}
                {insufficient && (
                  <Alert tone="warning">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>{t('insufficient')}</span>
                      <ButtonLink
                        href="/dashboard/credits"
                        size="sm"
                        variant="secondary"
                        icon={Coins}
                      >
                        {tExport('topUp')}
                      </ButtonLink>
                    </div>
                  </Alert>
                )}
              </>
            )}
            {error && <Alert tone="error">{error}</Alert>}
          </div>
        )}
      </Dialog>
    </>
  );
}
