import { Injectable } from '@nestjs/common';
import { type AiUsageResponse } from '@opportinities/shared';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Statistiques d'usage de l'IA pour l'administration. Seuls des agrégats sont lus : ni le contenu
 * des documents, ni les résultats des générations, ni l'identité des utilisateurs.
 * Les recettes en crédits (valeur interne des crédits nets consommés) sont distinctes du coût
 * estimé des appels OpenAI.
 */
@Injectable()
export class StudioUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(days: number): Promise<AiUsageResponse> {
    const since = new Date(Date.now() - days * DAY_MS);
    const where = { createdAt: { gte: since } };

    const [byStatus, byType, byAction, refundedByType, refundedByAction, requests, failed] =
      await Promise.all([
        this.prisma.aiGeneration.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
          _sum: { credits: true },
        }),
        this.prisma.aiGeneration.groupBy({
          by: ['documentType'],
          where,
          _count: { _all: true },
          _sum: { credits: true },
        }),
        this.prisma.aiGeneration.groupBy({
          by: ['action'],
          where,
          _count: { _all: true },
          _sum: { credits: true },
        }),
        this.prisma.aiGeneration.groupBy({
          by: ['documentType'],
          where: { ...where, status: 'failed' },
          _sum: { credits: true },
        }),
        this.prisma.aiGeneration.groupBy({
          by: ['action'],
          where: { ...where, status: 'failed' },
          _sum: { credits: true },
        }),
        this.prisma.aiRequest.aggregate({
          where: { ...where, generationId: { not: null } },
          _count: { _all: true },
          _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
        }),
        this.prisma.aiRequest.count({
          where: { ...where, generationId: { not: null }, status: { not: 'succeeded' } },
        }),
      ]);

    const count = (status: string) =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;
    const charged = byStatus.reduce((sum, row) => sum + (row._sum.credits ?? 0), 0);
    const refunded = byStatus.find((row) => row.status === 'failed')?._sum.credits ?? 0;

    // Recette : valeur figée des lots consommés par les générations non remboursées.
    const revenue = await this.prisma.$queryRaw<{ value: Prisma.Decimal | null }[]>`
      SELECT SUM(a."value_usd") AS "value"
      FROM "ai_generations" g
      JOIN "credit_lot_allocations" a ON a."movement_id" = g."charge_movement_id"
      WHERE g."created_at" >= ${since} AND g."refund_movement_id" IS NULL`;
    const refundedType = new Map(
      refundedByType.map((row) => [row.documentType, row._sum.credits ?? 0]),
    );
    const refundedAction = new Map(
      refundedByAction.map((row) => [row.action, row._sum.credits ?? 0]),
    );
    const hasCost = requests._sum.estimatedCostUsd !== null;

    return {
      since: since.toISOString(),
      generations: {
        total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
        succeeded: count('succeeded'),
        failed: count('failed'),
        pending: count('pending'),
      },
      credits: {
        charged,
        refunded,
        net: charged - refunded,
        revenueUsd: (revenue[0]?.value ?? new Prisma.Decimal(0)).toFixed(6),
      },
      openai: {
        requests: requests._count._all,
        failedRequests: failed,
        inputTokens: requests._sum.inputTokens ?? 0,
        outputTokens: requests._sum.outputTokens ?? 0,
        estimatedCostUsd: hasCost
          ? (requests._sum.estimatedCostUsd as Prisma.Decimal).toFixed(6)
          : null,
      },
      byDocumentType: byType
        .map((row) => ({
          documentType: row.documentType,
          generations: row._count._all,
          netCredits: (row._sum.credits ?? 0) - (refundedType.get(row.documentType) ?? 0),
        }))
        .sort((a, b) => b.generations - a.generations),
      byAction: byAction
        .map((row) => ({
          action: row.action,
          generations: row._count._all,
          netCredits: (row._sum.credits ?? 0) - (refundedAction.get(row.action) ?? 0),
        }))
        .sort((a, b) => b.generations - a.generations),
    };
  }
}
