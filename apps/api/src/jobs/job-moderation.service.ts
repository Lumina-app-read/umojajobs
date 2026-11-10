import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ERROR_CODES,
  type JobOfferSummaryResponse,
  type ModerationJobOfferResponse,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { type ClientInfo } from '../common/http/app-request';
import { type JobOfferStatus, type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { canTransition, checkValidityDates, statusAfterApproval } from './job-offer-rules';
import {
  dateOnly,
  JOB_OFFER_INCLUDE,
  JOB_OFFER_SUMMARY_SELECT,
  type JobOfferWithRelations,
  toJobOfferResponse,
  toSummary,
} from './job-offer.mapper';
import { type ModerationDecisionDto, type ModerationQueueQueryDto } from './job-offers.dto';
import { datesError, statusChange } from './job-offers.service';

export type ModerationAction = 'approve' | 'reject' | 'request-correction' | 'suspend';

/** Statut d'arrivée et exigence de motif de chaque décision (hors validation, calculée). */
const DECISIONS: Record<
  Exclude<ModerationAction, 'approve'>,
  { to: JobOfferStatus; from: readonly JobOfferStatus[] }
> = {
  reject: { to: 'rejected', from: ['pending_review'] },
  'request-correction': { to: 'needs_correction', from: ['pending_review'] },
  suspend: { to: 'suspended', from: ['scheduled', 'active'] },
};

/**
 * Modération des offres (cahier des charges §7.4) : file d'attente, doublons potentiels,
 * validation, rejet, demande de correction et suspension. Chaque décision est historisée
 * avec l'acteur, ses rôles, le motif, l'IP, le User-Agent et l'identifiant de requête.
 */
@Injectable()
export class JobModerationService {
  constructor(private readonly prisma: PrismaService) {}

  /** File de modération : les plus anciennes soumissions d'abord. */
  async queue(query: ModerationQueueQueryDto): Promise<JobOfferSummaryResponse[]> {
    const offers = await this.prisma.jobOffer.findMany({
      where: {
        status: query.status ?? 'pending_review',
        ...(query.after ? { id: { gt: query.after } } : {}),
      },
      orderBy: { id: 'asc' },
      take: query.limit ?? 50,
      select: JOB_OFFER_SUMMARY_SELECT,
    });
    return offers.map(toSummary);
  }

  async get(id: string): Promise<ModerationJobOfferResponse> {
    const offer = await this.prisma.jobOffer.findUnique({
      where: { id },
      include: {
        ...JOB_OFFER_INCLUDE,
        contributor: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { revisions: true } },
      },
    });
    if (!offer || offer.status === 'draft') {
      // Les brouillons restent privés : la modération ne voit que les offres soumises.
      throw new NotFoundException({ code: ERROR_CODES.JOB_OFFER_NOT_FOUND });
    }
    return {
      ...toJobOfferResponse(offer),
      contributor: offer.contributor,
      duplicates: await this.findDuplicates(offer),
      revisionCount: offer._count.revisions,
    };
  }

  async decide(
    auth: AuthContext,
    id: string,
    action: ModerationAction,
    dto: ModerationDecisionDto,
    client: ClientInfo,
  ): Promise<ModerationJobOfferResponse> {
    const offer = await this.prisma.jobOffer.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        version: true,
        contributorId: true,
        startDate: true,
        endDate: true,
        timezone: true,
        startsAt: true,
      },
    });
    if (!offer || offer.status === 'draft') {
      throw new NotFoundException({ code: ERROR_CODES.JOB_OFFER_NOT_FOUND });
    }
    // Conflit d'intérêts : personne ne modère ses propres offres (commissions en jeu).
    if (offer.contributorId === auth.user.id) {
      throw new ForbiddenException({ code: ERROR_CODES.JOB_OFFER_SELF_MODERATION });
    }

    const now = new Date();
    let to: JobOfferStatus;
    const data: Prisma.JobOfferUncheckedUpdateManyInput = {};

    if (action === 'approve') {
      if (offer.status !== 'pending_review') throw this.invalidTransition(offer.status);
      const problem = checkValidityDates(
        dateOnly(offer.startDate) ?? '',
        dateOnly(offer.endDate) ?? '',
        offer.timezone ?? 'UTC',
        now,
      );
      if (problem) throw datesError(problem);
      to = statusAfterApproval(offer.startsAt ?? now, now);
      if (to === 'active') data.publishedAt = now;
    } else {
      const decision = DECISIONS[action];
      if (!decision.from.includes(offer.status)) throw this.invalidTransition(offer.status);
      if (!dto.reason) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          details: [{ field: 'reason', rules: ['isNotEmpty'] }],
        });
      }
      to = decision.to;
    }
    if (!canTransition(offer.status, to)) throw this.invalidTransition(offer.status);

    await this.prisma.$transaction(async (tx) => {
      // La version et le statut lus conditionnent l'écriture : deux modérateurs ne peuvent
      // pas décider en même temps sur la même version.
      const result = await tx.jobOffer.updateMany({
        where: { id, version: dto.version, status: offer.status },
        data: {
          ...data,
          status: to,
          reviewedAt: now,
          reviewedById: auth.user.id,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new ConflictException({ code: ERROR_CODES.JOB_OFFER_VERSION_CONFLICT });
      }
      await tx.jobOfferStatusHistory.create({
        data: statusChange(id, offer.status, to, auth, client, dto.reason),
      });
    });
    return this.get(id);
  }

  private invalidTransition(status: JobOfferStatus): ConflictException {
    return new ConflictException({
      code: ERROR_CODES.JOB_OFFER_INVALID_TRANSITION,
      meta: { status },
    });
  }

  /**
   * Doublons potentiels présentés au modérateur : même empreinte (entreprise, intitulé, pays)
   * ou même lien source, parmi les offres déjà soumises.
   */
  private async findDuplicates(offer: JobOfferWithRelations): Promise<JobOfferSummaryResponse[]> {
    const criteria: Prisma.JobOfferWhereInput[] = [];
    if (offer.duplicateKey) criteria.push({ duplicateKey: offer.duplicateKey });
    if (offer.sourceUrl) criteria.push({ sourceUrl: offer.sourceUrl });
    if (criteria.length === 0) return [];
    const duplicates = await this.prisma.jobOffer.findMany({
      where: { id: { not: offer.id }, status: { not: 'draft' }, OR: criteria },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: JOB_OFFER_SUMMARY_SELECT,
    });
    return duplicates.map(toSummary);
  }
}
