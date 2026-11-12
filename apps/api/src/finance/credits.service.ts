import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type CreditBalanceResponse,
  type CreditGrantResponse,
  ERROR_CODES,
  FINANCE_LIMITS,
  type FinanceUserLookupResponse,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { type ClientInfo } from '../common/http/app-request';
import { type CreditService, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventsService } from '../security-events/security-events.service';
import { allocateFifo, type LotAllocation, sumUsd } from './finance-rules';
import { FinancialSettingsService } from './financial-settings.service';
import { LEDGER_ACCOUNTS, LedgerService } from './ledger.service';

type Tx = Prisma.TransactionClient;

export interface ConsumeRequest {
  userId: string;
  service: CreditService;
  credits: number;
  idempotencyKey: string;
  referenceType: string;
  referenceId: string;
}

export interface ConsumeResult {
  movementId: string;
  balance: number;
  allocations: LotAllocation[];
  /** Valeur interne totale consommée (base d'une éventuelle commission). */
  valueUsd: Prisma.Decimal;
  /** Part de la valeur provenant de lots commissionnables (recharges payées). */
  commissionableValueUsd: Prisma.Decimal;
}

const DOCUMENT_SERVICES: readonly CreditService[] = [
  'doc_cv',
  'doc_cover_letter',
  'doc_application_letter',
  'doc_pack',
];

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Registre des crédits : solde en cache verrouillé à chaque mouvement, lots FIFO,
 * mouvements et affectations en ajout seul, écritures comptables dans la même transaction.
 */
@Injectable()
export class CreditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: FinancialSettingsService,
    private readonly ledger: LedgerService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  async balance(userId: string): Promise<CreditBalanceResponse> {
    const account = await this.prisma.creditAccount.findUnique({
      where: { userId },
      select: {
        balance: true,
        movements: {
          orderBy: { createdAt: 'desc' },
          take: FINANCE_LIMITS.movementsPageSize,
          select: {
            id: true,
            type: true,
            quantity: true,
            balanceAfter: true,
            referenceType: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    });
    return {
      balance: account?.balance ?? 0,
      movements: (account?.movements ?? []).map((movement) => ({
        ...movement,
        createdAt: movement.createdAt.toISOString(),
      })),
    };
  }

  /** Bénéficiaire d'une dotation, retrouvé par son adresse exacte (insensible à la casse). */
  async lookupUser(email: string): Promise<FinanceUserLookupResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        creditAccount: { select: { balance: true } },
      },
    });
    if (!user) throw new NotFoundException({ code: ERROR_CODES.USER_NOT_FOUND });
    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      balance: user.creditAccount?.balance ?? 0,
    };
  }

  /**
   * Dotation gratuite par l'administration : lot non commissionnable (arbitrage A2),
   * valeur interne en vigueur figée sur le lot. Rejouer la même clé ne crédite qu'une fois.
   */
  async grant(
    auth: AuthContext,
    input: { userId: string; credits: number; reason: string; idempotencyKey: string },
    client: ClientInfo,
  ): Promise<CreditGrantResponse> {
    // Séparation des tâches : un administrateur ne s'attribue jamais de crédits à lui-même.
    if (input.userId === auth.user.id) {
      throw new ForbiddenException({ code: ERROR_CODES.CREDIT_SELF_GRANT });
    }
    const key = `grant:${input.idempotencyKey}`;
    const replay = await this.findReplay(key, input.userId);
    if (replay) return replay;

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException({ code: ERROR_CODES.USER_NOT_FOUND });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const unitValue = await this.settings.require('credit_unit_value_usd', tx);
        const account = await this.lockAccount(tx, input.userId);
        const balance = account.balance + input.credits;
        const value = unitValue.mul(input.credits);

        const movement = await tx.creditMovement.create({
          data: {
            accountId: account.id,
            type: 'grant',
            quantity: input.credits,
            balanceAfter: balance,
            idempotencyKey: key,
            actorId: auth.user.id,
            reason: input.reason,
          },
          select: { id: true },
        });
        const lot = await tx.creditLot.create({
          data: {
            accountId: account.id,
            origin: 'grant',
            creditsTotal: input.credits,
            creditsRemaining: input.credits,
            creditUnitValueUsd: unitValue,
            commissionable: false,
          },
          select: { id: true },
        });
        await tx.creditLotAllocation.create({
          data: { movementId: movement.id, lotId: lot.id, credits: input.credits, valueUsd: value },
        });
        await tx.creditAccount.update({ where: { id: account.id }, data: { balance } });
        await this.ledger.post(tx, {
          type: 'credit_grant',
          idempotencyKey: key,
          referenceType: 'credit_movement',
          referenceId: movement.id,
          actorId: auth.user.id,
          reason: input.reason,
          lines: [
            { account: LEDGER_ACCOUNTS.promotionalCredits, debit: value },
            { account: LEDGER_ACCOUNTS.customerCredits, credit: value },
          ],
        });
        await this.securityEvents.record(
          {
            type: 'credits_granted',
            userId: auth.user.id,
            client,
            metadata: { beneficiaryId: input.userId, credits: input.credits },
          },
          tx,
        );
        return { movementId: movement.id, balance };
      });
    } catch (error) {
      // Deux requêtes simultanées avec la même clé : la seconde renvoie le résultat de la première.
      if (isUniqueViolation(error)) {
        const again = await this.findReplay(key, input.userId);
        if (again) return again;
      }
      throw error;
    }
  }

  /**
   * Consommation de crédits pour un service (déverrouillage, export). Appelée par le module
   * métier dans sa propre transaction ; la clé d'idempotence est unique en base.
   */
  async consume(tx: Tx, request: ConsumeRequest): Promise<ConsumeResult> {
    const account = await this.lockAccount(tx, request.userId);
    if (account.balance < request.credits) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.INSUFFICIENT_CREDITS });
    }
    const lots = await tx.creditLot.findMany({
      where: { accountId: account.id, creditsRemaining: { gt: 0 } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, creditsRemaining: true, creditUnitValueUsd: true, commissionable: true },
    });
    const allocations = allocateFifo(lots, request.credits);
    if (!allocations) {
      // Solde en cache et lots divergent : refus et signalement par la réconciliation.
      throw new ConflictException({ code: ERROR_CODES.INSUFFICIENT_CREDITS });
    }

    const balance = account.balance - request.credits;
    const movement = await tx.creditMovement.create({
      data: {
        accountId: account.id,
        type: 'consume',
        quantity: -request.credits,
        balanceAfter: balance,
        idempotencyKey: request.idempotencyKey,
        referenceType: request.referenceType,
        referenceId: request.referenceId,
      },
      select: { id: true },
    });
    for (const allocation of allocations) {
      await tx.creditLot.update({
        where: { id: allocation.lotId },
        data: { creditsRemaining: { decrement: allocation.credits } },
      });
      await tx.creditLotAllocation.create({
        data: {
          movementId: movement.id,
          lotId: allocation.lotId,
          credits: allocation.credits,
          valueUsd: allocation.valueUsd,
        },
      });
    }
    await tx.creditAccount.update({ where: { id: account.id }, data: { balance } });

    const valueUsd = sumUsd(allocations.map((allocation) => allocation.valueUsd));
    const commissionable = new Set(lots.filter((lot) => lot.commissionable).map((lot) => lot.id));
    const commissionableValueUsd = sumUsd(
      allocations.filter((a) => commissionable.has(a.lotId)).map((a) => a.valueUsd),
    );
    await this.ledger.post(tx, {
      type: 'credit_consumption',
      idempotencyKey: request.idempotencyKey,
      referenceType: request.referenceType,
      referenceId: request.referenceId,
      lines: [
        { account: LEDGER_ACCOUNTS.customerCredits, debit: valueUsd },
        {
          account: DOCUMENT_SERVICES.includes(request.service)
            ? LEDGER_ACCOUNTS.revenueDocuments
            : LEDGER_ACCOUNTS.revenueUnlocks,
          credit: valueUsd,
        },
      ],
    });
    return { movementId: movement.id, balance, allocations, valueUsd, commissionableValueUsd };
  }

  /** Crée le compte au besoin, puis verrouille sa ligne jusqu'à la fin de la transaction. */
  private async lockAccount(tx: Tx, userId: string): Promise<{ id: string; balance: number }> {
    await tx.creditAccount.upsert({ where: { userId }, create: { userId }, update: {} });
    const rows = await tx.$queryRaw<{ id: string; balance: number }[]>`
      SELECT "id", "balance" FROM "credit_accounts" WHERE "user_id" = ${userId}::uuid FOR UPDATE`;
    const row = rows[0];
    if (!row) throw new Error(`Compte de crédits introuvable pour ${userId}`);
    return row;
  }

  private async findReplay(key: string, userId: string): Promise<CreditGrantResponse | null> {
    const movement = await this.prisma.creditMovement.findUnique({
      where: { idempotencyKey: key },
      select: { id: true, balanceAfter: true, account: { select: { userId: true } } },
    });
    if (!movement) return null;
    // Une clé déjà utilisée pour un autre bénéficiaire n'est jamais réinterprétée.
    if (movement.account.userId !== userId) {
      throw new ConflictException({ code: ERROR_CODES.BAD_REQUEST });
    }
    return { movementId: movement.id, balance: movement.balanceAfter };
  }
}
