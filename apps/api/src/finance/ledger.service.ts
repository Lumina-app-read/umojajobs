import { Injectable } from '@nestjs/common';
import {
  type LedgerAccountType,
  type LedgerTransactionType,
  Prisma,
} from '../generated/prisma/client';
import { sumUsd } from './finance-rules';

type Tx = Prisma.TransactionClient;

/** Comptes système du plan de comptes (audit §6.2). Le code n'est pas un paramètre financier. */
export const LEDGER_ACCOUNTS = {
  customerCredits: { code: 'customer_credits', type: 'liability' },
  revenueUnlocks: { code: 'revenue_unlocks', type: 'revenue' },
  revenueDocuments: { code: 'revenue_documents', type: 'revenue' },
  /** Générations par l'IA (Career Studio), distinctes des exports PDF. */
  revenueAiGenerations: { code: 'revenue_ai_generations', type: 'revenue' },
  /** Crédits offerts : charge commerciale de la plateforme (à valider par l'expert-comptable). */
  promotionalCredits: { code: 'promotional_credits', type: 'expense' },
} as const satisfies Record<string, { code: string; type: LedgerAccountType }>;

export type LedgerAccountRef = { code: string; type: LedgerAccountType; ownerUserId?: string };

export type LedgerLine =
  | { account: LedgerAccountRef; debit: Prisma.Decimal }
  | { account: LedgerAccountRef; credit: Prisma.Decimal };

export interface LedgerPosting {
  type: LedgerTransactionType;
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
  actorId?: string | null;
  reason?: string | null;
  lines: LedgerLine[];
}

/**
 * Grand livre en partie double. Toujours appelé dans une transaction PostgreSQL ouverte par
 * l'opération métier : l'écriture et l'opération réussissent ou échouent ensemble.
 * L'équilibre est contrôlé ici, puis de nouveau par un trigger différé en base.
 */
@Injectable()
export class LedgerService {
  async post(tx: Tx, posting: LedgerPosting): Promise<string> {
    const debits = sumUsd(posting.lines.flatMap((line) => ('debit' in line ? [line.debit] : [])));
    const credits = sumUsd(
      posting.lines.flatMap((line) => ('credit' in line ? [line.credit] : [])),
    );
    if (posting.lines.length < 2 || !debits.eq(credits) || debits.lte(0)) {
      throw new Error(
        `Écriture déséquilibrée (${posting.type}) : débit ${debits.toString()}, crédit ${credits.toString()}`,
      );
    }

    const transaction = await tx.ledgerTransaction.create({
      data: {
        type: posting.type,
        idempotencyKey: posting.idempotencyKey,
        referenceType: posting.referenceType ?? null,
        referenceId: posting.referenceId ?? null,
        actorId: posting.actorId ?? null,
        reason: posting.reason ?? null,
      },
      select: { id: true },
    });

    for (const line of posting.lines) {
      const accountId = await this.accountId(tx, line.account);
      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          accountId,
          debit: 'debit' in line ? line.debit : 0,
          credit: 'credit' in line ? line.credit : 0,
        },
      });
    }
    return transaction.id;
  }

  /** Compte du plan, créé à sa première utilisation. Un code ne change jamais de type. */
  private async accountId(tx: Tx, account: LedgerAccountRef): Promise<string> {
    const row = await tx.ledgerAccount.upsert({
      where: { code: account.code },
      create: { code: account.code, type: account.type, ownerUserId: account.ownerUserId ?? null },
      update: {},
      select: { id: true, type: true },
    });
    if (row.type !== account.type) {
      throw new Error(`Compte ${account.code} : type ${row.type} attendu, ${account.type} demandé`);
    }
    return row.id;
  }
}
