import {
  PERMISSIONS,
  SECURITY_EVENT_TYPES,
  type SecurityEventTypeCode,
} from '@opportinities/shared';
import { ChevronRight, RotateCcw, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { EventTypeFilter } from '@/features/admin/event-type-filter';
import { getSecurityEvents } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

const PAGE_SIZE = 50;

/** Couleur du badge : alertes en rouge, actions sensibles en ambre, le reste en neutre. */
function toneFor(type: string): BadgeTone {
  if (['login_failed', 'account_locked', 'mfa_failed'].includes(type)) return 'danger';
  if (
    [
      'password_changed',
      'password_reset_completed',
      'role_granted',
      'role_revoked',
      'mfa_recovery_code_used',
      'logout_all',
    ].includes(type)
  )
    return 'warning';
  if (['login_succeeded', 'email_verified', 'mfa_enabled', 'mfa_verified'].includes(type))
    return 'success';
  return 'neutral';
}

function isEventType(value: unknown): value is SecurityEventTypeCode {
  return typeof value === 'string' && (SECURITY_EVENT_TYPES as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.SECURITY_EVENTS_READ))) return {};
  const t = await getTranslations('common.admin.security');
  return { title: t('title') };
}

/** Journal de sécurité : lecture seule, filtre par type, pagination vers les événements plus anciens. */
export default async function SecurityEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.SECURITY_EVENTS_READ);
  const t = await getTranslations('common.admin');
  const format = await getFormatter();
  const query = await searchParams;
  const type = isEventType(query.type) ? query.type : undefined;
  const before =
    typeof query.before === 'string' && UUID.test(query.before) ? query.before : undefined;

  const events = await getSecurityEvents({ type, before, limit: PAGE_SIZE });
  const last = events?.at(-1);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg">{t('security.title')}</h1>
          <p className="mt-1.5 text-sm text-fg-muted">{t('security.intro')}</p>
        </div>
        <EventTypeFilter value={type ?? 'all'} />
      </div>

      {events === null ? (
        <Alert tone="error">{t('security.unavailable')}</Alert>
      ) : events.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={t('security.empty')}
          description={t('security.emptyBody')}
          className="bg-surface py-14"
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('security.date')}</Th>
              <Th>{t('security.type')}</Th>
              <Th>{t('security.user')}</Th>
              <Th>{t('security.ip')}</Th>
              <Th>{t('security.request')}</Th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <Tr key={event.id}>
                <Td className="whitespace-nowrap text-fg-muted tabular-nums">
                  {format.dateTime(new Date(event.createdAt), {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </Td>
                <Td>
                  <Badge tone={toneFor(event.type)}>
                    {isEventType(event.type) ? t(`events.${event.type}`) : event.type}
                  </Badge>
                </Td>
                <Td className="font-mono text-xs text-fg-muted" title={event.userId ?? undefined}>
                  {event.userId ? event.userId.slice(-8) : '—'}
                </Td>
                <Td className="font-mono text-xs text-fg-muted">{event.ip ?? '—'}</Td>
                <Td
                  className="font-mono text-xs text-fg-subtle"
                  title={event.requestId ?? undefined}
                >
                  {event.requestId ? event.requestId.slice(-8) : '—'}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <div className="flex flex-wrap gap-2">
        {before && (
          <ButtonLink
            href={{ pathname: '/admin/security-events', query: type ? { type } : {} }}
            variant="secondary"
            icon={RotateCcw}
          >
            {t('security.newest')}
          </ButtonLink>
        )}
        {events && events.length === PAGE_SIZE && last && (
          <ButtonLink
            href={{
              pathname: '/admin/security-events',
              query: { ...(type ? { type } : {}), before: last.id },
            }}
            variant="secondary"
            trailingIcon={ChevronRight}
          >
            {t('security.older')}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
