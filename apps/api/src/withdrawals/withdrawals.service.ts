import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AdminWithdrawalResponse,
  ERROR_CODES,
  isAfricanCountryIso2,
  PHONE_E164,
  type WithdrawalDecisionInput,
  type WithdrawalMethodInput,
  type WithdrawalMethodResponse,
  type WithdrawalResponse,
  type WithdrawalStatus,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { EncryptionService } from '../common/crypto/encryption.service';
import { type ClientInfo } from '../common/http/app-request';
import { uuidv7 } from '../common/uuid-v7';
import { sumUsd } from '../finance/finance-rules';
import { FinancialSettingsService } from '../finance/financial-settings.service';
import { LedgerService } from '../finance/ledger.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventsService } from '../security-events/security-events.service';

type Tx = Prisma.TransactionClient;

const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;
const OPEN: WithdrawalStatus[] = ['pending', 'under_review', 'approved', 'processing'];

/** Transitions permises par action (audit §7.1). */
const TRANSITIONS: Record<
  WithdrawalDecisionInput['action'],
  { from: WithdrawalStatus[]; to: WithdrawalStatus }
> = {
  review: { from: ['pending'], to: 'under_review' },
  approve: { from: ['pending', 'under_review'], to: 'approved' },
  process: { from: ['approved'], to: 'processing' },
  fail: { from: ['processing'], to: 'approved' },
  pay: { from: ['processing'], to: 'paid' },
  reject: { from: OPEN, to: 'rejected' },
};

const contributorAccount = (kind: 'available' | 'reserved', userId: string) => ({
  code: `contributor_${kind}:${userId}`,
  type: 'liability' as const,
  ownerUserId: userId,
});
const PAYOUT_TREASURY = { code: 'payout_treasury', type: 'asset' as const };

const REQUEST_INCLUDE = {
  method: true,
  events: { orderBy: { createdAt: 'asc' } },
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  paidBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.WithdrawalRequestInclude;

type RequestRow = Prisma.WithdrawalRequestGetPayload<{ include: typeof REQUEST_INCLUDE }>;
type MethodRow = Prisma.WithdrawalMethodGetPayload<object>;

interface MethodDetails {
  accountHolder: string;
  accountNumber: string;
}

const fullName = (user: { firstName: string; lastName: string }) =>
  `${user.firstName} ${user.lastName}`;

/**
 * Retraits des contributeurs (CLAUDE.md §11, audit §7) : le montant est réservé dès la demande,
 * affecté aux commissions disponibles les plus anciennes, puis versé manuellement par
 * l'administration. « paid » exige la référence du versement ; au-delà du seuil, deux
 * administrateurs distincts approuvent et confirment. Chaque étape est historisée.
 */
@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: FinancialSettingsService,
    private readonly ledger: LedgerService,
    private readonly encryption: EncryptionService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  // --- Moyens de retrait --------------------------------------------------------------------

  async methods(userId: string): Promise<WithdrawalMethodResponse[]> {
    const rows = await this.prisma.withdrawalMethod.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toMethod);
  }

  async addMethod(
    auth: AuthContext,
    input: WithdrawalMethodInput,
  ): Promise<WithdrawalMethodResponse> {
    const country = input.countryIso2.toUpperCase();
    const account = input.accountNumber.replace(/[\s.-]/g, '');
    if (!isAfricanCountryIso2(country)) throw validation('countryIso2', 'isIn');
    if (input.type === 'mobile_money' && !PHONE_E164.test(account)) {
      throw validation('accountNumber', 'matches');
    }
    if (input.type === 'bank_transfer' && !/^[A-Za-z0-9]{6,34}$/.test(account)) {
      throw validation('accountNumber', 'matches');
    }
    const details: MethodDetails = {
      accountHolder: input.accountHolder.trim(),
      accountNumber: account,
    };
    const row = await this.prisma.withdrawalMethod.create({
      data: {
        userId: auth.user.id,
        type: input.type,
        countryIso2: country,
        provider: input.provider.trim(),
        maskedAccount: `••• ${account.slice(-4)}`,
        detailsEncrypted: this.encryption.encrypt(JSON.stringify(details)),
      },
    });
    return toMethod(row);
  }

  /** Retrait d'un moyen : conservé (historique des demandes), simplement archivé. */
  async archiveMethod(auth: AuthContext, methodId: string): Promise<void> {
    const result = await this.prisma.withdrawalMethod.updateMany({
      where: { id: methodId, userId: auth.user.id, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException({ code: ERROR_CODES.WITHDRAWAL_METHOD_NOT_FOUND });
    }
  }

  // --- Demandes ------------------------------------------------------------------------------

  async mine(userId: string): Promise<WithdrawalResponse[]> {
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: REQUEST_INCLUDE,
    });
    return rows.map(toWithdrawal);
  }

  async request(
    auth: AuthContext,
    input: { methodId: string; amountUsd: string },
    client: ClientInfo,
  ): Promise<WithdrawalResponse> {
    if (!AMOUNT.test(input.amountUsd.trim())) throw validation('amountUsd', 'matches');
    const amount = new Prisma.Decimal(input.amountUsd.trim());
    const userId = auth.user.id;

    const id = await this.prisma.$transaction(async (tx) => {
      // Une demande à la fois par utilisateur : les calculs de solde sont sérialisés.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`withdrawal:${userId}`}))`;
      const method = await tx.withdrawalMethod.findFirst({
        where: { id: input.methodId, userId, archivedAt: null },
        select: { id: true },
      });
      if (!method) throw new NotFoundException({ code: ERROR_CODES.WITHDRAWAL_METHOD_NOT_FOUND });
      if (await tx.withdrawalRequest.count({ where: { userId, status: { in: OPEN } } })) {
        throw new ConflictException({ code: ERROR_CODES.WITHDRAWAL_ALREADY_OPEN });
      }
      const minimum = await this.settings.require('withdrawal_min_usd', tx);
      if (amount.lt(minimum) || amount.lte(0)) {
        throw new UnprocessableEntityException({ code: ERROR_CODES.WITHDRAWAL_BELOW_MINIMUM });
      }

      // Commissions disponibles, des plus anciennes aux plus récentes, moins ce qui est déjà affecté.
      const commissions = await tx.commission.findMany({
        where: { contributorId: userId, status: 'available' },
        orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          amountUsd: true,
          withdrawalAllocations: { where: { releasedAt: null }, select: { amountUsd: true } },
        },
      });
      const allocations: { commissionId: string; amountUsd: Prisma.Decimal }[] = [];
      let missing = amount;
      for (const commission of commissions) {
        if (missing.lte(0)) break;
        const remaining = commission.amountUsd.sub(
          sumUsd(commission.withdrawalAllocations.map((allocation) => allocation.amountUsd)),
        );
        if (remaining.lte(0)) continue;
        const taken = Prisma.Decimal.min(remaining, missing);
        allocations.push({ commissionId: commission.id, amountUsd: taken });
        missing = missing.sub(taken);
      }
      if (missing.gt(0)) {
        throw new UnprocessableEntityException({ code: ERROR_CODES.WITHDRAWAL_INSUFFICIENT_FUNDS });
      }

      const requestId = uuidv7();
      const reserveId = await this.ledger.post(tx, {
        type: 'withdrawal_reserve',
        idempotencyKey: `withdrawal-reserve:${requestId}`,
        referenceType: 'withdrawal_request',
        referenceId: requestId,
        actorId: userId,
        lines: [
          { account: contributorAccount('available', userId), debit: amount },
          { account: contributorAccount('reserved', userId), credit: amount },
        ],
      });
      await tx.withdrawalRequest.create({
        data: {
          id: requestId,
          userId,
          methodId: method.id,
          amountUsd: amount,
          reserveTransactionId: reserveId,
        },
      });
      await tx.withdrawalCommissionAllocation.createMany({
        data: allocations.map((allocation) => ({ withdrawalId: requestId, ...allocation })),
      });
      await tx.withdrawalEvent.create({
        data: { withdrawalId: requestId, toStatus: 'pending', actorId: userId },
      });
      await this.securityEvents.record(
        {
          type: 'withdrawal_requested',
          userId,
          client,
          metadata: { withdrawalId: requestId, amountUsd: amount.toFixed(2) },
        },
        tx,
      );
      return requestId;
    });
    return toWithdrawal(await this.load(id));
  }

  // --- Administration --------------------------------------------------------------------------

  async adminList(status?: WithdrawalStatus): Promise<AdminWithdrawalResponse[]> {
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: status ? { status } : { status: { in: OPEN } },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: REQUEST_INCLUDE,
    });
    const threshold = await this.threshold();
    return rows.map((row) => this.toAdmin(row, threshold));
  }

  async adminGet(id: string): Promise<AdminWithdrawalResponse> {
    return this.toAdmin(await this.load(id), await this.threshold());
  }

  async decide(
    auth: AuthContext,
    id: string,
    input: WithdrawalDecisionInput,
    client: ClientInfo,
  ): Promise<AdminWithdrawalResponse> {
    const rule = TRANSITIONS[input.action];
    const note = input.note?.trim() || null;
    if ((input.action === 'reject' || input.action === 'fail') && (!note || note.length < 10)) {
      throw validation('note', 'length');
    }

    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "withdrawal_requests" WHERE "id" = ${id}::uuid FOR UPDATE`;
      if (!rows[0]) throw new NotFoundException({ code: ERROR_CODES.WITHDRAWAL_NOT_FOUND });
      const request = await tx.withdrawalRequest.findUniqueOrThrow({ where: { id } });
      if (request.userId === auth.user.id) {
        throw new ForbiddenException({ code: ERROR_CODES.WITHDRAWAL_SELF_REVIEW });
      }
      if (!rule.from.includes(request.status)) {
        throw new ConflictException({ code: ERROR_CODES.WITHDRAWAL_INVALID_TRANSITION });
      }

      const data: Prisma.WithdrawalRequestUpdateInput = { status: rule.to };
      if (input.action === 'approve') {
        data.approvedBy = { connect: { id: auth.user.id } };
        data.approvedAt = new Date();
      }
      if (input.action === 'pay') {
        const reference = input.payoutReference?.trim();
        if (!reference) throw validation('payoutReference', 'isNotEmpty');
        if (!input.paidOn || !/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) {
          throw validation('paidOn', 'isDateString');
        }
        const threshold = await this.settings.require('withdrawal_dual_approval_usd', tx);
        if (request.amountUsd.gte(threshold) && request.approvedById === auth.user.id) {
          throw new ForbiddenException({ code: ERROR_CODES.WITHDRAWAL_DUAL_APPROVAL });
        }
        data.paidBy = { connect: { id: auth.user.id } };
        data.paidAt = new Date(`${input.paidOn}T12:00:00Z`);
        data.payoutReference = reference;
        await this.ledger.post(tx, {
          type: 'withdrawal_payout',
          idempotencyKey: `withdrawal-payout:${id}`,
          referenceType: 'withdrawal_request',
          referenceId: id,
          actorId: auth.user.id,
          reason: reference,
          lines: [
            { account: contributorAccount('reserved', request.userId), debit: request.amountUsd },
            { account: PAYOUT_TREASURY, credit: request.amountUsd },
          ],
        });
      }
      if (input.action === 'reject') {
        data.rejectionReason = note;
        await tx.withdrawalCommissionAllocation.updateMany({
          where: { withdrawalId: id, releasedAt: null },
          data: { releasedAt: new Date() },
        });
        await this.ledger.post(tx, {
          type: 'withdrawal_release',
          idempotencyKey: `withdrawal-release:${id}`,
          referenceType: 'withdrawal_request',
          referenceId: id,
          actorId: auth.user.id,
          reason: note,
          lines: [
            { account: contributorAccount('reserved', request.userId), debit: request.amountUsd },
            { account: contributorAccount('available', request.userId), credit: request.amountUsd },
          ],
        });
      }

      await tx.withdrawalRequest.update({ where: { id }, data });
      await tx.withdrawalEvent.create({
        data: {
          withdrawalId: id,
          fromStatus: request.status,
          toStatus: rule.to,
          actorId: auth.user.id,
          note,
        },
      });
      if (input.action === 'pay') await this.settleCommissions(tx, id);
      await this.securityEvents.record(
        {
          type: 'withdrawal_status_changed',
          userId: auth.user.id,
          client,
          metadata: { withdrawalId: id, from: request.status, to: rule.to },
        },
        tx,
      );
    });
    return this.adminGet(id);
  }

  /** Après versement : les commissions entièrement couvertes par des retraits payés passent à « paid ». */
  private async settleCommissions(tx: Tx, withdrawalId: string): Promise<void> {
    const allocations = await tx.withdrawalCommissionAllocation.findMany({
      where: { withdrawalId },
      select: {
        commission: {
          select: {
            id: true,
            status: true,
            amountUsd: true,
            withdrawalAllocations: {
              where: { releasedAt: null, withdrawal: { status: 'paid' } },
              select: { amountUsd: true },
            },
          },
        },
      },
    });
    for (const { commission } of allocations) {
      const covered = sumUsd(
        commission.withdrawalAllocations.map((allocation) => allocation.amountUsd),
      );
      if (commission.status === 'available' && covered.gte(commission.amountUsd)) {
        await tx.commission.update({ where: { id: commission.id }, data: { status: 'paid' } });
        await tx.commissionEvent.create({
          data: { commissionId: commission.id, fromStatus: 'available', toStatus: 'paid' },
        });
      }
    }
  }

  private async load(id: string): Promise<RequestRow> {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.WITHDRAWAL_NOT_FOUND });
    return row;
  }

  private threshold(): Promise<Prisma.Decimal | null> {
    return this.settings.require('withdrawal_dual_approval_usd').catch(() => null);
  }

  private toAdmin(row: RequestRow, threshold: Prisma.Decimal | null): AdminWithdrawalResponse {
    const details = JSON.parse(
      this.encryption.decrypt(row.method.detailsEncrypted),
    ) as MethodDetails;
    return {
      ...toWithdrawal(row),
      user: { id: row.user.id, name: fullName(row.user), email: row.user.email },
      accountHolder: details.accountHolder,
      accountNumber: details.accountNumber,
      approvedBy: row.approvedBy ? { id: row.approvedBy.id, name: fullName(row.approvedBy) } : null,
      paidBy: row.paidBy ? { id: row.paidBy.id, name: fullName(row.paidBy) } : null,
      dualApprovalRequired: threshold !== null && row.amountUsd.gte(threshold),
    };
  }
}

function validation(field: string, rule: string): BadRequestException {
  return new BadRequestException({
    code: ERROR_CODES.VALIDATION_FAILED,
    details: [{ field, rules: [rule] }],
  });
}

function toMethod(row: MethodRow): WithdrawalMethodResponse {
  return {
    id: row.id,
    type: row.type,
    countryIso2: row.countryIso2,
    provider: row.provider,
    maskedAccount: row.maskedAccount,
    createdAt: row.createdAt.toISOString(),
  };
}

function toWithdrawal(row: RequestRow): WithdrawalResponse {
  return {
    id: row.id,
    amountUsd: row.amountUsd.toFixed(2),
    status: row.status,
    method: toMethod(row.method),
    payoutReference: row.payoutReference,
    paidAt: row.paidAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    events: row.events.map((event) => ({
      toStatus: event.toStatus,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
