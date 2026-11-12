import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CANDIDATE_TERMS_VERSION,
  type CommissionResponse,
  type DocumentPagesResponse,
  type CreditCostResponse,
  CREDIT_SERVICES,
  ERROR_CODES,
  type UnlockedContentsResponse,
  type UnlockResponse,
  type UnlockSummaryResponse,
  type WalletResponse,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { type ClientInfo } from '../common/http/app-request';
import { uuidv7 } from '../common/uuid-v7';
import {
  DocumentRenderService,
  MAX_RENDERED_PAGES,
  type RenderSource,
} from '../documents/document-render.service';
import { CreditsService } from '../finance/credits.service';
import { commissionAmount } from '../finance/finance-rules';
import { FinancialSettingsService } from '../finance/financial-settings.service';
import { LedgerService } from '../finance/ledger.service';
import { Prisma } from '../generated/prisma/client';
import { PUBLIC_SELECT, toPublicSummary } from '../jobs/job-search.service';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/** Le service facturé pour un déverrouillage (offre premium : non défini à ce stade). */
const UNLOCK_SERVICE = 'unlock_standard' as const;

const CONTENTS_SELECT = {
  id: true,
  applicationEmail: true,
  applicationUrl: true,
  applicationAddress: true,
  applicationInstructions: true,
  applicationPhone: true,
  contributorTips: true,
  contributor: { select: { firstName: true, lastName: true } },
  files: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, kind: true, originalName: true, sizeBytes: true },
  },
} satisfies Prisma.JobOfferSelect;

type ContentsRow = Prisma.JobOfferGetPayload<{ select: typeof CONTENTS_SELECT }>;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Déverrouillage d'une offre contre des crédits (CLAUDE.md §10), dans une seule transaction :
 * contrôle de l'offre, consommation FIFO, déverrouillage, commission éventuelle et écritures.
 * Un utilisateur ne paie jamais deux fois la même offre (unicité utilisateur + offre en base).
 */
@Injectable()
export class UnlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly settings: FinancialSettingsService,
    private readonly ledger: LedgerService,
    private readonly documents: DocumentRenderService,
  ) {}

  /** Coûts publics des services (affichés avant toute action payante). */
  async costs(): Promise<CreditCostResponse[]> {
    return Promise.all(
      CREDIT_SERVICES.map(async (service) => ({
        service,
        credits: await this.settings.requireCost(service).catch(() => null),
      })),
    );
  }

  async unlock(auth: AuthContext, jobOfferId: string): Promise<UnlockResponse> {
    const existing = await this.findUnlock(auth.user.id, jobOfferId);
    if (existing) return this.alreadyUnlocked(auth.user.id, jobOfferId);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Verrou partagé : l'offre ne peut pas changer d'état pendant le déverrouillage.
        const offers = await tx.$queryRaw<
          { id: string; status: string; ends_at: Date | null; contributor_id: string }[]
        >`SELECT "id", "status", "ends_at", "contributor_id" FROM "job_offers"
          WHERE "id" = ${jobOfferId}::uuid FOR SHARE`;
        const offer = offers[0];
        if (!offer) throw new NotFoundException({ code: ERROR_CODES.JOB_OFFER_NOT_FOUND });
        if (offer.contributor_id === auth.user.id) {
          throw new ForbiddenException({ code: ERROR_CODES.JOB_UNLOCK_OWN_OFFER });
        }
        if (offer.status !== 'active' || !offer.ends_at || offer.ends_at <= new Date()) {
          throw new ConflictException({ code: ERROR_CODES.JOB_UNLOCK_UNAVAILABLE });
        }

        const cost = await this.settings.requireCost(UNLOCK_SERVICE, tx);
        const unlockId = uuidv7();
        const consumed = await this.credits.consume(tx, {
          userId: auth.user.id,
          service: UNLOCK_SERVICE,
          credits: cost,
          idempotencyKey: `unlock:${auth.user.id}:${jobOfferId}`,
          referenceType: 'job_unlock',
          referenceId: unlockId,
        });
        await tx.jobUnlock.create({
          data: {
            id: unlockId,
            userId: auth.user.id,
            jobOfferId,
            service: UNLOCK_SERVICE,
            credits: cost,
            movementId: consumed.movementId,
            valueUsd: consumed.valueUsd,
          },
        });
        if (consumed.commissionableValueUsd.gt(0)) {
          await this.accrueCommission(tx, {
            unlockId,
            jobOfferId,
            contributorId: offer.contributor_id,
            base: consumed.commissionableValueUsd,
          });
        }
        return { balance: consumed.balance };
      });
      return { jobOfferId, balance: result.balance, charged: true };
    } catch (error) {
      // Double clic ou requêtes simultanées : la contrainte d'unicité a joué, rien n'est débité.
      if (isUniqueViolation(error)) {
        const again = await this.findUnlock(auth.user.id, jobOfferId);
        if (again) return this.alreadyUnlocked(auth.user.id, jobOfferId);
      }
      throw error;
    }
  }

  /**
   * Coordonnées d'une offre déverrouillée. Le règlement des candidats (présenté après le
   * paiement, jamais avant) doit avoir été accepté.
   */
  async contents(auth: AuthContext, jobOfferId: string): Promise<UnlockedContentsResponse> {
    const userId = auth.user.id;
    const unlock = await this.prisma.jobUnlock.findUnique({
      where: { userId_jobOfferId: { userId, jobOfferId } },
      select: { createdAt: true, credits: true, jobOffer: { select: CONTENTS_SELECT } },
    });
    if (!unlock) throw new NotFoundException({ code: ERROR_CODES.JOB_UNLOCK_NOT_FOUND });
    assertCandidateTerms(auth);
    return toContents(unlock.jobOffer, unlock.createdAt, unlock.credits);
  }

  async list(userId: string): Promise<UnlockSummaryResponse[]> {
    const unlocks = await this.prisma.jobUnlock.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { createdAt: true, credits: true, jobOffer: { select: PUBLIC_SELECT } },
    });
    return unlocks.flatMap((unlock) => {
      const offer = toPublicSummary(unlock.jobOffer);
      return offer
        ? [{ unlockedAt: unlock.createdAt.toISOString(), credits: unlock.credits, offer }]
        : [];
    });
  }

  /**
   * Portefeuille calculé à partir des commissions (source de vérité) : en attente, disponible,
   * payé. Les commissions annulées ne comptent pas. Montants exacts, jamais de flottant.
   */
  async wallet(userId: string): Promise<WalletResponse> {
    const [groups, allocated, withdrawals, minimum, holdDays] = await Promise.all([
      this.prisma.commission.groupBy({
        by: ['status'],
        where: { contributorId: userId },
        _sum: { amountUsd: true },
        _count: { _all: true },
      }),
      // Part des commissions disponibles déjà affectée à des retraits (en cours ou payés).
      this.prisma.withdrawalCommissionAllocation.aggregate({
        where: { releasedAt: null, commission: { contributorId: userId, status: 'available' } },
        _sum: { amountUsd: true },
      }),
      this.prisma.withdrawalRequest.groupBy({
        by: ['status'],
        where: { userId, status: { not: 'rejected' } },
        _sum: { amountUsd: true },
      }),
      this.settings.require('withdrawal_min_usd').catch(() => null),
      this.settings.require('commission_hold_days').catch(() => null),
    ]);
    const sum = (status: string) =>
      groups.find((group) => group.status === status)?._sum.amountUsd ?? new Prisma.Decimal(0);
    const pending = sum('pending');
    const available = sum('available').sub(allocated._sum.amountUsd ?? 0);
    const paid = sum('paid');
    const zero = new Prisma.Decimal(0);
    const reserved = withdrawals
      .filter((group) => group.status !== 'paid')
      .reduce((total, group) => total.add(group._sum.amountUsd ?? zero), zero);
    const withdrawn = withdrawals.find((group) => group.status === 'paid')?._sum.amountUsd ?? zero;
    return {
      currency: 'USD',
      pendingUsd: pending.toFixed(6),
      availableUsd: available.toFixed(6),
      reservedUsd: reserved.toFixed(6),
      totalEarnedUsd: pending.add(sum('available')).add(paid).toFixed(6),
      totalWithdrawnUsd: withdrawn.toFixed(6),
      withdrawalMinUsd: minimum ? minimum.toFixed(2) : null,
      holdConfigured: holdDays !== null,
      commissionCount: groups
        .filter((group) => group.status !== 'reversed')
        .reduce((count, group) => count + group._count._all, 0),
    };
  }

  /** Commissions du contributeur connecté, des plus récentes aux plus anciennes. */
  async commissions(userId: string): Promise<CommissionResponse[]> {
    const rows = await this.prisma.commission.findMany({
      where: { contributorId: userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        status: true,
        amountUsd: true,
        rate: true,
        createdAt: true,
        availableAt: true,
        jobOffer: { select: { id: true, title: true, slug: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      amountUsd: row.amountUsd.toFixed(6),
      rate: row.rate.toString(),
      createdAt: row.createdAt.toISOString(),
      availableAt: row.availableAt?.toISOString() ?? null,
      offer: { id: row.jobOffer.id, title: row.jobOffer.title ?? '', slug: row.jobOffer.slug },
    }));
  }

  /**
   * Commission en attente sur la part payée des crédits consommés. Elle ne deviendra
   * disponible qu'après règlement de la recharge et délai de sécurité (étape 3d).
   */
  private async accrueCommission(
    tx: Tx,
    input: { unlockId: string; jobOfferId: string; contributorId: string; base: Prisma.Decimal },
  ): Promise<void> {
    const rate = await this.settings.require('contributor_commission_rate', tx);
    const amount = commissionAmount(input.base, rate);
    if (amount.lte(0)) return;
    const transactionId = await this.ledger.post(tx, {
      type: 'commission_accrual',
      idempotencyKey: `commission:${input.unlockId}`,
      referenceType: 'job_unlock',
      referenceId: input.unlockId,
      lines: [
        { account: { code: 'contributor_commissions', type: 'expense' }, debit: amount },
        {
          account: {
            code: `contributor_pending:${input.contributorId}`,
            type: 'liability',
            ownerUserId: input.contributorId,
          },
          credit: amount,
        },
      ],
    });
    const commission = await tx.commission.create({
      data: {
        unlockId: input.unlockId,
        contributorId: input.contributorId,
        jobOfferId: input.jobOfferId,
        baseValueUsd: input.base,
        rate,
        amountUsd: amount,
        ledgerTransactionId: transactionId,
      },
      select: { id: true },
    });
    await tx.commissionEvent.create({
      data: { commissionId: commission.id, fromStatus: null, toStatus: 'pending' },
    });
  }

  private findUnlock(userId: string, jobOfferId: string) {
    return this.prisma.jobUnlock.findUnique({
      where: { userId_jobOfferId: { userId, jobOfferId } },
      select: { id: true },
    });
  }

  private async alreadyUnlocked(userId: string, jobOfferId: string): Promise<UnlockResponse> {
    const account = await this.prisma.creditAccount.findUnique({
      where: { userId },
      select: { balance: true },
    });
    return { jobOfferId, balance: account?.balance ?? 0, charged: false };
  }

  // --- Documents : consultation dans le site uniquement ---------------------------------------

  /** Nombre de pages d'un document ; chaque ouverture est journalisée. */
  async documentPages(
    auth: AuthContext,
    jobOfferId: string,
    fileId: string,
    client: ClientInfo,
  ): Promise<DocumentPagesResponse> {
    const source = await this.documentSource(auth, jobOfferId, fileId);
    await this.prisma.fileDownloadLog.create({
      data: {
        fileId,
        userId: auth.user.id,
        purpose: 'unlock',
        ip: client.ip,
        userAgent: client.userAgent,
        requestId: client.requestId,
      },
    });
    return { fileId, pageCount: await this.documents.pageCount(source) };
  }

  async documentPage(
    auth: AuthContext,
    jobOfferId: string,
    fileId: string,
    page: number,
  ): Promise<Buffer> {
    const source = await this.documentSource(auth, jobOfferId, fileId);
    if (page < 1 || page > MAX_RENDERED_PAGES || page > (await this.documents.pageCount(source))) {
      throw new NotFoundException({ code: ERROR_CODES.FILE_NOT_FOUND });
    }
    return this.documents.page(source, page);
  }

  /** Document d'une offre déverrouillée par l'utilisateur, règlement accepté, non retiré. */
  private async documentSource(
    auth: AuthContext,
    jobOfferId: string,
    fileId: string,
  ): Promise<RenderSource> {
    const file = await this.prisma.jobOfferFile.findFirst({
      where: {
        id: fileId,
        jobOfferId,
        deletedAt: null,
        jobOffer: { unlocks: { some: { userId: auth.user.id } } },
      },
      select: {
        id: true,
        storageKey: true,
        jobOffer: { select: { contributor: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!file) throw new NotFoundException({ code: ERROR_CODES.FILE_NOT_FOUND });
    assertCandidateTerms(auth);
    return {
      fileId: file.id,
      storageKey: file.storageKey,
      watermark: `Publiée par ${publisherName(file.jobOffer.contributor)} sur Umoja Jobs`,
    };
  }
}

function toContents(row: ContentsRow, unlockedAt: Date, credits: number): UnlockedContentsResponse {
  return {
    jobOfferId: row.id,
    unlockedAt: unlockedAt.toISOString(),
    credits,
    applicationEmail: row.applicationEmail,
    applicationUrl: row.applicationUrl,
    applicationAddress: row.applicationAddress,
    applicationInstructions: row.applicationInstructions,
    applicationPhone: row.applicationPhone,
    contributorTips: row.contributorTips,
    publishedBy: publisherName(row.contributor),
    files: row.files.map((file) => ({
      id: file.id,
      kind: file.kind,
      originalName: file.originalName,
      sizeBytes: file.sizeBytes,
    })),
  };
}

/** Prénom et initiale du nom : le contributeur est crédité sans exposer son identité complète. */
function publisherName(contributor: { firstName: string; lastName: string }): string {
  const initial = contributor.lastName.trim().charAt(0).toUpperCase();
  return initial ? `${contributor.firstName} ${initial}.` : contributor.firstName;
}

function assertCandidateTerms(auth: AuthContext): void {
  if (auth.user.candidateTermsVersion !== CANDIDATE_TERMS_VERSION) {
    throw new ForbiddenException({ code: ERROR_CODES.CANDIDATE_TERMS_REQUIRED });
  }
}
