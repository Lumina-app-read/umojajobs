import {
  type JobOfferResponse,
  type JobOfferStatusChangeResponse,
  type JobOfferSummaryResponse,
} from '@opportinities/shared';
import { type Prisma } from '../generated/prisma/client';
import { missingSubmissionFields } from './job-offer-rules';

/** Relations chargées pour présenter une offre complète. */
export const JOB_OFFER_INCLUDE = {
  country: { select: { iso2: true } },
  city: { select: { id: true, name: true } },
  category: { select: { id: true, slug: true, nameFr: true, nameEn: true } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  files: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.JobOfferInclude;

export type JobOfferWithRelations = Prisma.JobOfferGetPayload<{
  include: typeof JOB_OFFER_INCLUDE;
}>;

export const JOB_OFFER_SUMMARY_SELECT = {
  id: true,
  status: true,
  title: true,
  companyName: true,
  endDate: true,
  submittedAt: true,
  updatedAt: true,
  country: { select: { iso2: true } },
} satisfies Prisma.JobOfferSelect;

type JobOfferSummaryRow = Prisma.JobOfferGetPayload<{ select: typeof JOB_OFFER_SUMMARY_SELECT }>;

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);
/** Colonne DATE : la partie calendaire « AAAA-MM-JJ », sans conversion de fuseau. */
export const dateOnly = (date: Date | null): string | null =>
  date ? date.toISOString().slice(0, 10) : null;

export function toSummary(offer: JobOfferSummaryRow): JobOfferSummaryResponse {
  return {
    id: offer.id,
    status: offer.status,
    title: offer.title,
    companyName: offer.companyName,
    countryIso2: offer.country?.iso2 ?? null,
    endDate: dateOnly(offer.endDate),
    submittedAt: iso(offer.submittedAt),
    updatedAt: offer.updatedAt.toISOString(),
  };
}

function toHistory(offer: JobOfferWithRelations): JobOfferStatusChangeResponse[] {
  return offer.statusHistory.map((change) => ({
    id: change.id,
    fromStatus: change.fromStatus,
    toStatus: change.toStatus,
    by:
      change.actorId === null
        ? 'system'
        : change.actorId === offer.contributorId
          ? 'contributor'
          : 'moderator',
    reason: change.reason,
    createdAt: change.createdAt.toISOString(),
  }));
}

/**
 * Offre complète, champs privés compris. Réservée au contributeur propriétaire et à la
 * modération : jamais utilisée pour l'affichage public (phase 2d).
 */
export function toJobOfferResponse(
  offer: JobOfferWithRelations,
  { includeDeletedFiles = false }: { includeDeletedFiles?: boolean } = {},
): JobOfferResponse {
  const salaryMin = offer.salaryMin?.toString() ?? null;
  const salaryMax = offer.salaryMax?.toString() ?? null;
  return {
    id: offer.id,
    status: offer.status,
    version: offer.version,
    title: offer.title,
    companyName: offer.companyName,
    countryIso2: offer.country?.iso2 ?? null,
    cityId: offer.cityId,
    city: offer.city,
    categoryId: offer.categoryId,
    category: offer.category,
    contractType: offer.contractType,
    workMode: offer.workMode,
    educationLevel: offer.educationLevel,
    experienceLevel: offer.experienceLevel,
    salaryMin,
    salaryMax,
    salaryCurrency: offer.salaryCurrency,
    salaryPeriod: offer.salaryPeriod,
    description: offer.description,
    requirements: offer.requirements,
    skills: offer.skills,
    contentLanguage: offer.contentLanguage,
    startDate: dateOnly(offer.startDate),
    endDate: dateOnly(offer.endDate),
    timezone: offer.timezone,
    startsAt: iso(offer.startsAt),
    endsAt: iso(offer.endsAt),
    sourceType: offer.sourceType,
    sourceUrl: offer.sourceUrl,
    sourceDetails: offer.sourceDetails,
    applicationInstructions: offer.applicationInstructions,
    applicationEmail: offer.applicationEmail,
    applicationUrl: offer.applicationUrl,
    applicationAddress: offer.applicationAddress,
    missingFields: missingSubmissionFields({
      title: offer.title,
      companyName: offer.companyName,
      countryIso2: offer.country?.iso2 ?? null,
      categoryId: offer.categoryId,
      contractType: offer.contractType,
      workMode: offer.workMode,
      description: offer.description,
      startDate: dateOnly(offer.startDate),
      endDate: dateOnly(offer.endDate),
      sourceType: offer.sourceType,
      applicationInstructions: offer.applicationInstructions,
      applicationEmail: offer.applicationEmail,
      applicationUrl: offer.applicationUrl,
      salaryMin,
      salaryMax,
      salaryCurrency: offer.salaryCurrency,
      salaryPeriod: offer.salaryPeriod,
    }),
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
    submittedAt: iso(offer.submittedAt),
    reviewedAt: iso(offer.reviewedAt),
    publishedAt: iso(offer.publishedAt),
    expiredAt: iso(offer.expiredAt),
    history: toHistory(offer),
    files: offer.files
      .filter((file) => includeDeletedFiles || file.deletedAt === null)
      .map((file) => ({
        id: file.id,
        kind: file.kind,
        originalName: file.originalName,
        sizeBytes: file.sizeBytes,
        sha256: file.sha256,
        createdAt: file.createdAt.toISOString(),
        deletedAt: iso(file.deletedAt),
      })),
  };
}
