import { Injectable, Logger } from '@nestjs/common';
import { type JobOfferStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Nombre d'offres traitées par lot : borne la durée des transactions. */
const BATCH_SIZE = 500;

interface ChangedRow {
  id: string;
  from_status: JobOfferStatus;
}

export interface LifecycleResult {
  expired: number;
  activated: number;
}

/**
 * Cycle de vie automatique des offres (cahier des charges §7.6) :
 * - expiration : une offre programmée, active ou suspendue dont la fin est atteinte devient
 *   expirée (plus de déverrouillage ni d'achat ; transactions et commissions conservées) ;
 * - activation : une offre programmée dont le début est atteint devient active.
 *
 * Idempotent et sûr avec plusieurs instances : chaque lot verrouille ses lignes
 * (FOR UPDATE SKIP LOCKED) et ne modifie que celles qui sont encore dans le statut attendu.
 * Chaque changement est inscrit à l'historique, sans acteur (changement automatique).
 */
@Injectable()
export class JobOfferLifecycleService {
  private readonly logger = new Logger(JobOfferLifecycleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(now: Date = new Date()): Promise<LifecycleResult> {
    // L'expiration passe d'abord : une offre programmée déjà terminée ne doit jamais être activée.
    const expired = await this.drain(() => this.expireBatch(now));
    const activated = await this.drain(() => this.activateBatch(now));
    if (expired + activated > 0) {
      this.logger.log(`Cycle de vie des offres : ${expired} expirée(s), ${activated} activée(s).`);
    }
    return { expired, activated };
  }

  private async drain(batch: () => Promise<number>): Promise<number> {
    let total = 0;
    for (;;) {
      const count = await batch();
      total += count;
      if (count < BATCH_SIZE) return total;
    }
  }

  private expireBatch(now: Date): Promise<number> {
    return this.transition(
      Prisma.sql`status IN ('scheduled', 'active', 'suspended') AND ends_at <= ${now}`,
      'expired',
      Prisma.sql`expired_at = ${now}`,
      now,
    );
  }

  private activateBatch(now: Date): Promise<number> {
    return this.transition(
      Prisma.sql`status = 'scheduled' AND starts_at <= ${now} AND ends_at > ${now}`,
      'active',
      Prisma.sql`published_at = COALESCE(published_at, ${now})`,
      now,
    );
  }

  private async transition(
    condition: Prisma.Sql,
    to: JobOfferStatus,
    extraSet: Prisma.Sql,
    now: Date,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ChangedRow[]>`
        WITH due AS (
          SELECT id, status FROM job_offers
          WHERE ${condition}
          ORDER BY id
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE job_offers AS offer
        SET status = ${to}::job_offer_status,
            ${extraSet},
            version = offer.version + 1,
            updated_at = ${now}
        FROM due
        WHERE offer.id = due.id
        RETURNING offer.id, due.status AS from_status`;
      if (rows.length > 0) {
        await tx.jobOfferStatusHistory.createMany({
          data: rows.map((row) => ({
            jobOfferId: row.id,
            fromStatus: row.from_status,
            toStatus: to,
            createdAt: now,
          })),
        });
      }
      return rows.length;
    });
  }
}
