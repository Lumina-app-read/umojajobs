import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CONTRIBUTOR_TERMS_VERSION,
  EDITABLE_JOB_STATUSES,
  ERROR_CODES,
  type JobCategoryResponse,
  type JobOfferResponse,
  type JobOfferSummaryResponse,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { type ClientInfo } from '../common/http/app-request';
import { type JobOfferStatus, type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildSearchText,
  checkValidityDates,
  type DatesProblem,
  duplicateKey,
  parseDateOnly,
  validityWindow,
} from './job-offer-rules';
import {
  dateOnly,
  JOB_OFFER_INCLUDE,
  JOB_OFFER_SUMMARY_SELECT,
  type JobOfferWithRelations,
  toJobOfferResponse,
  toSummary,
} from './job-offer.mapper';
import {
  type JobOfferInputDto,
  type JobOfferSubmitDto,
  type JobOfferUpdateDto,
} from './job-offers.dto';

type Tx = Prisma.TransactionClient;

/** Champs recopiés tels quels de la saisie vers la base. */
const PLAIN_FIELDS = [
  'title',
  'companyName',
  'contractType',
  'workMode',
  'educationLevel',
  'experienceLevel',
  'salaryCurrency',
  'salaryPeriod',
  'description',
  'requirements',
  'contentLanguage',
  'sourceType',
  'sourceUrl',
  'sourceDetails',
  'applicationInstructions',
  'applicationEmail',
  'applicationUrl',
  'applicationAddress',
  'applicationPhone',
  'contributorTips',
] as const;

function validationError(field: string, rule: string): BadRequestException {
  return new BadRequestException({
    code: ERROR_CODES.VALIDATION_FAILED,
    details: [{ field, rules: [rule] }],
  });
}

export function datesError(problem: DatesProblem): BadRequestException {
  return new BadRequestException({
    code:
      problem === 'already_ended'
        ? ERROR_CODES.JOB_OFFER_ALREADY_ENDED
        : ERROR_CODES.JOB_OFFER_INVALID_DATES,
    meta: { problem },
  });
}

/** Entrée de l'historique des statuts, avec le contexte de la requête. */
export function statusChange(
  jobOfferId: string,
  fromStatus: JobOfferStatus | null,
  toStatus: JobOfferStatus,
  auth: AuthContext | null,
  client: ClientInfo | null,
  reason?: string | null,
): Prisma.JobOfferStatusHistoryUncheckedCreateInput {
  return {
    jobOfferId,
    fromStatus,
    toStatus,
    actorId: auth?.user.id ?? null,
    actorRoles: auth ? [...auth.roles].sort() : [],
    reason: reason ?? null,
    ip: client?.ip ?? null,
    userAgent: client?.userAgent ?? null,
    requestId: client?.requestId ?? null,
  };
}

/**
 * Offres côté contributeur : brouillons, modifications et soumission à la modération.
 * Un contributeur ne voit et ne modifie que ses propres offres ; les autres renvoient 404.
 */
@Injectable()
export class JobOffersService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories(): Promise<JobCategoryResponse[]> {
    return this.prisma.jobCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, slug: true, nameFr: true, nameEn: true },
    });
  }

  async create(
    auth: AuthContext,
    dto: JobOfferInputDto,
    client: ClientInfo,
  ): Promise<JobOfferResponse> {
    this.assertContributorTerms(auth);
    const data = await this.buildData(dto, null);
    const offer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.jobOffer.create({
        data: { ...data, contributorId: auth.user.id },
        select: { id: true },
      });
      await tx.jobOfferStatusHistory.create({
        data: statusChange(created.id, null, 'draft', auth, client),
      });
      return tx.jobOffer.findUniqueOrThrow({
        where: { id: created.id },
        include: JOB_OFFER_INCLUDE,
      });
    });
    return toJobOfferResponse(offer);
  }

  async update(auth: AuthContext, id: string, dto: JobOfferUpdateDto): Promise<JobOfferResponse> {
    const current = await this.findOwned(auth, id);
    this.assertEditable(current);
    const data = await this.buildData(dto, current);
    const offer = await this.prisma.$transaction(async (tx) => {
      await this.bumpVersion(tx, id, dto.version, data);
      return tx.jobOffer.findUniqueOrThrow({ where: { id }, include: JOB_OFFER_INCLUDE });
    });
    return toJobOfferResponse(offer);
  }

  /** Soumission à la modération : contrôles de complétude et de dates, version figée. */
  async submit(
    auth: AuthContext,
    id: string,
    dto: JobOfferSubmitDto,
    client: ClientInfo,
  ): Promise<JobOfferResponse> {
    this.assertContributorTerms(auth);
    const current = await this.findOwned(auth, id);
    this.assertEditable(current);
    const response = toJobOfferResponse(current);
    if (response.missingFields.length > 0) {
      throw new BadRequestException({
        code: ERROR_CODES.JOB_OFFER_INCOMPLETE,
        meta: { missingFields: response.missingFields },
      });
    }
    // Complétude vérifiée : dates et fuseau sont renseignés.
    const problem = checkValidityDates(
      response.startDate as string,
      response.endDate as string,
      current.timezone as string,
      new Date(),
    );
    if (problem) throw datesError(problem);

    const now = new Date();
    const offer = await this.prisma.$transaction(async (tx) => {
      await this.bumpVersion(tx, id, dto.version, {
        status: 'pending_review',
        submittedAt: now,
        declarationAcceptedAt: now,
      });
      const revisions = await tx.jobOfferRevision.count({ where: { jobOfferId: id } });
      // Instantané de la version soumise (sans l'historique) : uniquement des valeurs JSON.
      const { history: _history, ...content } = response;
      const snapshot = JSON.parse(JSON.stringify(content)) as Prisma.InputJsonObject;
      await tx.jobOfferRevision.create({
        data: { jobOfferId: id, number: revisions + 1, authorId: auth.user.id, snapshot },
      });
      await tx.jobOfferStatusHistory.create({
        data: statusChange(id, current.status, 'pending_review', auth, client),
      });
      return tx.jobOffer.findUniqueOrThrow({ where: { id }, include: JOB_OFFER_INCLUDE });
    });
    return toJobOfferResponse(offer);
  }

  async listMine(auth: AuthContext): Promise<JobOfferSummaryResponse[]> {
    const offers = await this.prisma.jobOffer.findMany({
      where: { contributorId: auth.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: JOB_OFFER_SUMMARY_SELECT,
    });
    return offers.map(toSummary);
  }

  async getMine(auth: AuthContext, id: string): Promise<JobOfferResponse> {
    return toJobOfferResponse(await this.findOwned(auth, id));
  }

  // --- Interne ---------------------------------------------------------------------------

  private async findOwned(auth: AuthContext, id: string): Promise<JobOfferWithRelations> {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id, contributorId: auth.user.id },
      include: JOB_OFFER_INCLUDE,
    });
    if (!offer) throw new NotFoundException({ code: ERROR_CODES.JOB_OFFER_NOT_FOUND });
    return offer;
  }

  /** Les conditions de publication en vigueur doivent avoir été acceptées. */
  private assertContributorTerms(auth: AuthContext): void {
    if (auth.user.contributorTermsVersion !== CONTRIBUTOR_TERMS_VERSION) {
      throw new ForbiddenException({ code: ERROR_CODES.CONTRIBUTOR_TERMS_REQUIRED });
    }
  }

  private assertEditable(offer: { status: JobOfferStatus }): void {
    if (!EDITABLE_JOB_STATUSES.includes(offer.status)) {
      throw new ConflictException({ code: ERROR_CODES.JOB_OFFER_NOT_EDITABLE });
    }
  }

  /** Écriture conditionnée à la version lue : refuse si l'offre a changé entre-temps. */
  private async bumpVersion(
    tx: Tx,
    id: string,
    version: number,
    data: Prisma.JobOfferUncheckedUpdateManyInput,
  ): Promise<void> {
    const result = await tx.jobOffer.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new ConflictException({ code: ERROR_CODES.JOB_OFFER_VERSION_CONFLICT });
    }
  }

  /**
   * Fusionne la saisie avec l'offre existante, contrôle les références (pays, ville, catégorie)
   * et recalcule les champs dérivés : fuseau, fenêtre de validité UTC et empreinte de doublon.
   */
  private async buildData(
    dto: JobOfferInputDto,
    current: JobOfferWithRelations | null,
  ): Promise<Omit<Prisma.JobOfferUncheckedCreateInput, 'contributorId'>> {
    const pick = <K extends keyof JobOfferInputDto>(key: K): JobOfferInputDto[K] | null =>
      dto[key] !== undefined ? dto[key] : null;

    const data: Record<string, unknown> = {};
    for (const field of PLAIN_FIELDS) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    if (dto.skills !== undefined) data.skills = dto.skills;
    if (dto.salaryMin !== undefined) data.salaryMin = dto.salaryMin;
    if (dto.salaryMax !== undefined) data.salaryMax = dto.salaryMax;

    // Pays, ville et fuseau horaire.
    let country: { id: string; iso2: string; defaultTimezone: string } | null = null;
    if (dto.countryIso2 !== undefined) {
      if (dto.countryIso2 !== null) {
        country = await this.prisma.country.findFirst({
          where: { iso2: dto.countryIso2, isActive: true },
          select: { id: true, iso2: true, defaultTimezone: true },
        });
        if (!country) throw validationError('countryIso2', 'isIn');
      }
    } else if (current?.countryId) {
      country = await this.prisma.country.findUnique({
        where: { id: current.countryId },
        select: { id: true, iso2: true, defaultTimezone: true },
      });
    }
    data.countryId = country?.id ?? null;

    const requestedCityId = dto.cityId !== undefined ? dto.cityId : (current?.cityId ?? null);
    let city: { id: string; timezone: string } | null = null;
    if (requestedCityId) {
      city = await this.prisma.city.findFirst({
        where: { id: requestedCityId, isActive: true, countryId: country?.id ?? '' },
        select: { id: true, timezone: true },
      });
      // Une ville d'un autre pays est refusée si elle est demandée, oubliée si le pays a changé.
      if (!city && dto.cityId !== undefined) throw validationError('cityId', 'isIn');
    }
    data.cityId = city?.id ?? null;
    const timezone = city?.timezone ?? country?.defaultTimezone ?? null;
    data.timezone = timezone;

    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      const category = await this.prisma.jobCategory.findFirst({
        where: { id: dto.categoryId, isActive: true },
        select: { id: true },
      });
      if (!category) throw validationError('categoryId', 'isIn');
    }
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;

    // Salaire : minimum inférieur ou égal au maximum.
    const salaryMin =
      dto.salaryMin !== undefined ? dto.salaryMin : (current?.salaryMin?.toNumber() ?? null);
    const salaryMax =
      dto.salaryMax !== undefined ? dto.salaryMax : (current?.salaryMax?.toNumber() ?? null);
    if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
      throw validationError('salaryMax', 'min');
    }

    // Dates : contrôlées dès l'enregistrement (cohérence), la date passée l'est à la soumission.
    const startDate =
      dto.startDate !== undefined ? pick('startDate') : dateOnly(current?.startDate ?? null);
    const endDate =
      dto.endDate !== undefined ? pick('endDate') : dateOnly(current?.endDate ?? null);
    if (startDate && !parseDateOnly(startDate)) throw validationError('startDate', 'isDate');
    if (endDate && !parseDateOnly(endDate)) throw validationError('endDate', 'isDate');
    if (startDate && endDate && endDate < startDate) throw datesError('end_before_start');
    data.startDate = startDate ? new Date(`${startDate}T00:00:00Z`) : null;
    data.endDate = endDate ? new Date(`${endDate}T00:00:00Z`) : null;
    const window =
      startDate && endDate && timezone ? validityWindow(startDate, endDate, timezone) : null;
    data.startsAt = window?.startsAt ?? null;
    data.endsAt = window?.endsAt ?? null;

    // Empreinte de doublon.
    const title = dto.title !== undefined ? dto.title : (current?.title ?? null);
    const company =
      dto.companyName !== undefined ? dto.companyName : (current?.companyName ?? null);
    data.duplicateKey =
      title && company && country ? duplicateKey(company, title, country.iso2) : null;

    // Texte de recherche : intitulé, entreprise, compétences, exigences et description.
    const merged = <K extends 'description' | 'requirements'>(key: K): string | null =>
      dto[key] !== undefined ? (dto[key] ?? null) : (current?.[key] ?? null);
    const skills = dto.skills ?? current?.skills ?? [];
    data.searchText = buildSearchText([
      title,
      company,
      ...skills,
      merged('requirements'),
      merged('description'),
    ]);

    return data;
  }
}
