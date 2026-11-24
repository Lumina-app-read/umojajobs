import 'server-only';
import {
  type AiUsageResponse,
  type AdminCatalogResponse,
  type AuditLogPage,
  type AdminRolesResponse,
  type AdminUserDetail,
  type BundleResponse,
  type BundleSummary,
  type CareerDocumentResponse,
  type NotificationsPage,
  type PlaceCityResponse,
  type SitemapResponse,
  type CommissionRegistryResponse,
  type PaymentRegistryResponse,
  type UnlockRegistryResponse,
  type UserRegistryResponse,
  type CareerDocumentSummary,
  type CareerExportFilter,
  type CareerExportHistoryResponse,
  type CommissionResponse,
  type CountryResponse,
  type CreditBalanceResponse,
  type CreditCostResponse,
  type FinancialSettingResponse,
  type ServiceCostResponse,
  type UnlockedContentsResponse,
  type UnlockSummaryResponse,
  type AdminCreditPackResponse,
  type AdminWithdrawalResponse,
  type CreditPackResponse,
  type WalletResponse,
  type WithdrawalMethodResponse,
  type WithdrawalResponse,
  type WithdrawalStatus,
  type JobCategoryResponse,
  type JobOfferResponse,
  type JobOfferSummaryResponse,
  type JobSearchResponse,
  type PublicJobOfferDetail,
  type SavedJobResponse,
  type ModerationJobOfferResponse,
  type MeResponse,
  type SecurityEventResponse,
  type SessionResponse,
} from '@opportinities/shared';
import { cookies } from 'next/headers';
import { cache } from 'react';

/** Adresse interne de l'API, utilisée par les Server Components (jamais exposée au navigateur). */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

interface ServerResult<T> {
  status: number;
  data: T | null;
  code: string | null;
}

/** Appel de l'API côté serveur, en transmettant les cookies de la requête (session). */
async function serverGet<T>(path: string): Promise<ServerResult<T>> {
  const cookieStore = await cookies();
  const response = await fetch(`${API_INTERNAL_URL}/api/v1${path}`, {
    headers: { Accept: 'application/json', Cookie: cookieStore.toString() },
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const code = (body as { code?: unknown } | null)?.code;
    return { status: response.status, data: null, code: typeof code === 'string' ? code : null };
  }
  return { status: response.status, data: body as T, code: null };
}

/** Durées de mise en cache des lectures publiques (alignées sur l'en-tête Cache-Control de l'API). */
const OFFERS_TTL = 60;
const REFERENCE_TTL = 300;

/**
 * Lecture publique, identique pour tous les visiteurs : aucun cookie n'est transmis et la réponse
 * est conservée par le cache de données de Next.js pendant `revalidate` secondes. Réservée aux
 * routes @Public() de l'API qui ne dépendent pas de l'utilisateur ; jamais pour les prix, qui
 * doivent toujours être à jour.
 */
async function publicGet<T>(path: string, revalidate: number): Promise<ServerResult<T>> {
  const response = await fetch(`${API_INTERNAL_URL}/api/v1${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate },
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const code = (body as { code?: unknown } | null)?.code;
    return { status: response.status, data: null, code: typeof code === 'string' ? code : null };
  }
  return { status: response.status, data: body as T, code: null };
}

/**
 * Utilisateur connecté, ou état d'authentification à traiter par la page appelante.
 * Mis en cache pour la durée d'une requête : en-tête, mise en page et page partagent un seul appel.
 */
export const getCurrentUser = cache((): Promise<ServerResult<MeResponse>> =>
  serverGet<MeResponse>('/auth/me'),
);

/** Pays actifs (référentiel administrable). */
export async function getCountries(): Promise<CountryResponse[]> {
  const result = await publicGet<CountryResponse[]>('/countries', REFERENCE_TTL);
  if (!result.data) {
    throw new Error(`Référentiel des pays indisponible (HTTP ${result.status}).`);
  }
  return result.data;
}

/** Sessions actives de l'utilisateur connecté (liste vide si l'API ne répond pas). */
export async function getSessions(): Promise<SessionResponse[]> {
  const result = await serverGet<SessionResponse[]>('/auth/sessions').catch(() => null);
  return result?.data ?? [];
}

/** Journal de sécurité (administration). data null si l'API refuse ou ne répond pas. */
export async function getSecurityEvents(query: {
  type?: string;
  before?: string;
  limit: number;
}): Promise<SecurityEventResponse[] | null> {
  const params = new URLSearchParams({ limit: String(query.limit) });
  if (query.type) params.set('type', query.type);
  if (query.before) params.set('before', query.before);
  const result = await serverGet<SecurityEventResponse[]>(
    `/admin/security-events?${params.toString()}`,
  ).catch(() => null);
  return result?.data ?? null;
}

/** Catégories actives des offres (liste vide si l'API ne répond pas). */
export async function getJobCategories(): Promise<JobCategoryResponse[]> {
  const result = await publicGet<JobCategoryResponse[]>('/job-categories', REFERENCE_TTL).catch(
    () => null,
  );
  return result?.data ?? [];
}

/** Offres du contributeur connecté. null si l'API ne répond pas. */
export async function getMyJobOffers(): Promise<JobOfferSummaryResponse[] | null> {
  const result = await serverGet<JobOfferSummaryResponse[]>('/me/job-offers').catch(() => null);
  return result?.data ?? null;
}

/** Une offre du contributeur connecté (null si elle n'existe pas ou ne lui appartient pas). */
export async function getMyJobOffer(id: string): Promise<JobOfferResponse | null> {
  const result = await serverGet<JobOfferResponse>(`/me/job-offers/${id}`).catch(() => null);
  return result?.data ?? null;
}

/** File de modération pour un statut (null si l'API refuse ou ne répond pas). */
export async function getModerationQueue(
  status: string,
): Promise<JobOfferSummaryResponse[] | null> {
  const result = await serverGet<JobOfferSummaryResponse[]>(
    `/admin/job-offers?status=${encodeURIComponent(status)}&limit=100`,
  ).catch(() => null);
  return result?.data ?? null;
}

/** Offre vue par la modération (null si introuvable ou non autorisée). */
export async function getModerationOffer(id: string): Promise<ModerationJobOfferResponse | null> {
  const result = await serverGet<ModerationJobOfferResponse>(`/admin/job-offers/${id}`).catch(
    () => null,
  );
  return result?.data ?? null;
}

/** Recherche publique (chaîne de requête déjà construite). null si l'API ne répond pas. */
export async function searchJobs(query: string): Promise<JobSearchResponse | null> {
  const result = await publicGet<JobSearchResponse>(`/job-offers?${query}`, OFFERS_TTL).catch(
    () => null,
  );
  return result?.data ?? null;
}

/** Offres actives et lieux ou catégories qui en ont (mis en cache : une lecture par requête). */
export const getSitemapData = cache(async (): Promise<SitemapResponse | null> => {
  const result = await publicGet<SitemapResponse>('/job-offers/sitemap', REFERENCE_TTL).catch(
    () => null,
  );
  return result?.data ?? null;
});

/** Ville désignée par son adresse publique, ou null. */
export async function getPlaceCity(iso2: string, slug: string): Promise<PlaceCityResponse | null> {
  const result = await publicGet<PlaceCityResponse>(
    `/job-offers/places/${encodeURIComponent(iso2)}/cities/${encodeURIComponent(slug)}`,
    REFERENCE_TTL,
  ).catch(() => null);
  return result?.data ?? null;
}

/** Archives publiques des offres expirées. */
export async function getJobArchives(page: number): Promise<JobSearchResponse | null> {
  const result = await publicGet<JobSearchResponse>(
    `/job-offers/archives?page=${page}`,
    REFERENCE_TTL,
  ).catch(() => null);
  return result?.data ?? null;
}

/** Fiche publique d'une offre (null si introuvable ou non publique). */
export const getPublicJob = cache(async (slug: string): Promise<PublicJobOfferDetail | null> => {
  const result = await publicGet<PublicJobOfferDetail>(
    `/job-offers/${encodeURIComponent(slug)}`,
    OFFERS_TTL,
  ).catch(() => null);
  return result?.data ?? null;
});

/** Offres enregistrées de l'utilisateur connecté (null si l'API ne répond pas). */
export async function getSavedJobs(): Promise<SavedJobResponse[] | null> {
  const result = await serverGet<SavedJobResponse[]>('/me/saved-jobs').catch(() => null);
  return result?.data ?? null;
}

/** Solde et derniers mouvements de crédits (null si l'API ne répond pas). */
export const getCreditBalance = cache(async (): Promise<CreditBalanceResponse | null> => {
  const result = await serverGet<CreditBalanceResponse>('/me/credits').catch(() => null);
  return result?.data ?? null;
});

/** Coûts publics des services en crédits (liste vide si l'API ne répond pas). */
export const getCreditCosts = cache(async (): Promise<CreditCostResponse[]> => {
  const result = await serverGet<CreditCostResponse[]>('/credit-costs').catch(() => null);
  return result?.data ?? [];
});

/** Coordonnées d'une offre déverrouillée par l'utilisateur (null : pas déverrouillée). */
export async function getUnlockedContents(
  jobOfferId: string,
): Promise<UnlockedContentsResponse | null> {
  const result = await serverGet<UnlockedContentsResponse>(
    `/me/unlocks/${encodeURIComponent(jobOfferId)}`,
  ).catch(() => null);
  return result?.data ?? null;
}

/** Offres déverrouillées par l'utilisateur connecté (null si l'API ne répond pas). */
export const getUnlocks = cache(async (): Promise<UnlockSummaryResponse[] | null> => {
  const result = await serverGet<UnlockSummaryResponse[]>('/me/unlocks').catch(() => null);
  return result?.data ?? null;
});

/** Commissions du contributeur connecté (null si l'API ne répond pas). */
export async function getCommissions(): Promise<CommissionResponse[] | null> {
  const result = await serverGet<CommissionResponse[]>('/me/commissions').catch(() => null);
  return result?.data ?? null;
}

/** Paramètres financiers en vigueur (administration ; null si l'API refuse ou ne répond pas). */
export async function getFinancialSettings(): Promise<FinancialSettingResponse[] | null> {
  const result = await serverGet<FinancialSettingResponse[]>('/admin/finance/settings').catch(
    () => null,
  );
  return result?.data ?? null;
}

/** Coûts des services en crédits, avec leur historique d'auteur (administration). */
export async function getServiceCosts(): Promise<ServiceCostResponse[] | null> {
  const result = await serverGet<ServiceCostResponse[]>('/admin/finance/service-costs').catch(
    () => null,
  );
  return result?.data ?? null;
}

/** Portefeuille du contributeur connecté (null si l'API ne répond pas). */
export const getWallet = cache(async (): Promise<WalletResponse | null> => {
  const result = await serverGet<WalletResponse>('/me/wallet').catch(() => null);
  return result?.data ?? null;
});

/** Moyens de retrait de l'utilisateur connecté (null si l'API ne répond pas). */
export async function getWithdrawalMethods(): Promise<WithdrawalMethodResponse[] | null> {
  const result = await serverGet<WithdrawalMethodResponse[]>('/me/withdrawal-methods').catch(
    () => null,
  );
  return result?.data ?? null;
}

/** Demandes de retrait de l'utilisateur connecté. */
export async function getMyWithdrawals(): Promise<WithdrawalResponse[] | null> {
  const result = await serverGet<WithdrawalResponse[]>('/me/withdrawals').catch(() => null);
  return result?.data ?? null;
}

/** File des retraits (administration) : en cours par défaut, ou un état précis. */
export async function getAdminWithdrawals(
  status: WithdrawalStatus | null,
): Promise<AdminWithdrawalResponse[] | null> {
  const query = status ? `?status=${status}` : '';
  const result = await serverGet<AdminWithdrawalResponse[]>(`/admin/withdrawals${query}`).catch(
    () => null,
  );
  return result?.data ?? null;
}

export async function getAdminWithdrawal(id: string): Promise<AdminWithdrawalResponse | null> {
  const result = await serverGet<AdminWithdrawalResponse>(
    `/admin/withdrawals/${encodeURIComponent(id)}`,
  ).catch(() => null);
  return result?.data ?? null;
}

/** Packs de crédits en vente (liste vide si le paiement est fermé ou l'API ne répond pas). */
export async function getCreditPacks(): Promise<CreditPackResponse[]> {
  const result = await serverGet<CreditPackResponse[]>('/credit-packs').catch(() => null);
  return result?.data ?? [];
}

/** Tous les packs, actifs ou non (administration financière). */
export async function getAdminCreditPacks(): Promise<AdminCreditPackResponse[] | null> {
  const result = await serverGet<AdminCreditPackResponse[]>('/admin/credit-packs').catch(
    () => null,
  );
  return result?.data ?? null;
}

/** Documents du Career Studio de l'utilisateur connecté (null si l'API ne répond pas). */
export async function getCareerDocuments(): Promise<CareerDocumentSummary[] | null> {
  const result = await serverGet<CareerDocumentSummary[]>('/me/career-documents').catch(() => null);
  return result?.data ?? null;
}

/** Un document du Career Studio (null s'il n'existe pas ou n'appartient pas à l'utilisateur). */
export async function getCareerDocument(id: string): Promise<CareerDocumentResponse | null> {
  const result = await serverGet<CareerDocumentResponse>(`/me/career-documents/${id}`).catch(
    () => null,
  );
  return result?.data ?? null;
}

/** PDF exportés par l'utilisateur (null si l'API ne répond pas). */
export async function getCareerExports(
  filter: CareerExportFilter | null,
  page: number,
): Promise<CareerExportHistoryResponse | null> {
  const query = new URLSearchParams({ page: String(page), ...(filter && { type: filter }) });
  const result = await serverGet<CareerExportHistoryResponse>(
    `/me/career-exports?${query.toString()}`,
  ).catch(() => null);
  return result?.data ?? null;
}

/** Dossiers rassemblés de l'utilisateur (null si l'API ne répond pas). */
export async function getBundles(): Promise<BundleSummary[] | null> {
  const result = await serverGet<BundleSummary[]>('/me/document-bundles').catch(() => null);
  return result?.data ?? null;
}

/** Un dossier (null s'il n'existe pas ou n'appartient pas à l'utilisateur). */
export async function getBundle(id: string): Promise<BundleResponse | null> {
  const result = await serverGet<BundleResponse>(
    `/me/document-bundles/${encodeURIComponent(id)}`,
  ).catch(() => null);
  return result?.data ?? null;
}

interface RegistryFilter {
  q?: string;
  status?: string;
  page: number;
}

async function getRegistry<T>(path: string, filter: RegistryFilter): Promise<T | null> {
  const query = new URLSearchParams({ page: String(filter.page) });
  if (filter.q) query.set('q', filter.q);
  if (filter.status) query.set('status', filter.status);
  const result = await serverGet<T>(`${path}?${query.toString()}`).catch(() => null);
  return result?.data ?? null;
}

/** Registres financiers de l'administration (null si l'API refuse ou ne répond pas). */
export const getPaymentRegistry = (filter: RegistryFilter) =>
  getRegistry<PaymentRegistryResponse>('/admin/payments', filter);
export const getUnlockRegistry = (filter: RegistryFilter) =>
  getRegistry<UnlockRegistryResponse>('/admin/unlocks', filter);
export const getCommissionRegistry = (filter: RegistryFilter) =>
  getRegistry<CommissionRegistryResponse>('/admin/commissions', filter);
export const getUserRegistry = (filter: RegistryFilter) =>
  getRegistry<UserRegistryResponse>('/admin/users', filter);

/** Fiche d'un compte (null si l'API refuse, ne répond pas, ou si le compte n'existe pas). */
export async function getAdminUser(id: string): Promise<AdminUserDetail | null> {
  const result = await serverGet<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`).catch(
    () => null,
  );
  return result?.data ?? null;
}

/** Notifications de l'utilisateur connecté (null si l'API ne répond pas). */
export async function getNotifications(before?: string): Promise<NotificationsPage | null> {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  const result = await serverGet<NotificationsPage>(`/me/notifications${query}`).catch(() => null);
  return result?.data ?? null;
}

/** Journal d'audit (administration ; null si l'API refuse ou ne répond pas). */
export async function getAuditLogs(filter: {
  before?: string;
  result?: string;
  actor?: string;
}): Promise<AuditLogPage | null> {
  const query = new URLSearchParams();
  if (filter.before) query.set('before', filter.before);
  if (filter.result) query.set('result', filter.result);
  if (filter.actor) query.set('actor', filter.actor);
  const text = query.toString();
  const result = await serverGet<AuditLogPage>(`/admin/audit-logs${text ? `?${text}` : ''}`).catch(
    () => null,
  );
  return result?.data ?? null;
}

/** Catégories et pays, actifs ou non (administration). */
export async function getAdminCatalog(): Promise<AdminCatalogResponse | null> {
  const result = await serverGet<AdminCatalogResponse>('/admin/catalog').catch(() => null);
  return result?.data ?? null;
}

/** Rôles, permissions et membres de l'équipe. */
export async function getAdminRoles(): Promise<AdminRolesResponse | null> {
  const result = await serverGet<AdminRolesResponse>('/admin/roles').catch(() => null);
  return result?.data ?? null;
}

/** Usage de l'IA du Career Studio (administration ; null si l'API refuse ou ne répond pas). */
export async function getAiUsage(days: number): Promise<AiUsageResponse | null> {
  const result = await serverGet<AiUsageResponse>(`/admin/studio/ai-usage?days=${days}`).catch(
    () => null,
  );
  return result?.data ?? null;
}
