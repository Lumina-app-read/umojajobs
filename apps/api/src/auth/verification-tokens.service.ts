import { BadRequestException, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@opportinities/shared';
import { generateToken, sha256Hex } from '../common/crypto/tokens';
import { type Prisma, type VerificationTokenType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Jetons à usage unique envoyés par email (vérification, réinitialisation). */
@Injectable()
export class VerificationTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée un jeton et invalide les jetons précédents du même type pour cet utilisateur. */
  async issue(
    userId: string,
    type: VerificationTokenType,
    ttlMs: number,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const db = tx ?? this.prisma;
    const token = generateToken();
    await db.verificationToken.deleteMany({ where: { userId, type, usedAt: null } });
    await db.verificationToken.create({
      data: {
        userId,
        type,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return token;
  }

  /**
   * Consomme un jeton de façon atomique : un même jeton ne peut servir qu'une fois, même en cas
   * de requêtes simultanées. Lève TOKEN_INVALID s'il est inconnu, expiré ou déjà utilisé.
   */
  async consume(
    token: string,
    type: VerificationTokenType,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const tokenHash = sha256Hex(token);
    const result = await tx.verificationToken.updateMany({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new BadRequestException({ code: ERROR_CODES.TOKEN_INVALID });
    }
    const record = await tx.verificationToken.findUniqueOrThrow({
      where: { tokenHash },
      select: { userId: true },
    });
    return record.userId;
  }
}
