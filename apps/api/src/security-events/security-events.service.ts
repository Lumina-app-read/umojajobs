import { Injectable } from '@nestjs/common';
import { type ClientInfo } from '../common/http/app-request';
import { type Prisma, type SecurityEventType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SecurityEventInput {
  type: SecurityEventType;
  userId?: string | null;
  client?: ClientInfo | null;
  /** Ne jamais y placer de mot de passe, jeton, code TOTP ou secret. */
  metadata?: Prisma.InputJsonObject;
}

type TransactionClient = Prisma.TransactionClient;

/** Journal de sécurité (ajout seul, protégé par trigger en base). */
@Injectable()
export class SecurityEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: SecurityEventInput, tx?: TransactionClient): Promise<void> {
    const db = tx ?? this.prisma;
    await db.securityEvent.create({
      data: {
        type: event.type,
        userId: event.userId ?? null,
        ip: event.client?.ip ?? null,
        userAgent: event.client?.userAgent ?? null,
        requestId: event.client?.requestId ?? null,
        ...(event.metadata ? { metadata: event.metadata } : {}),
      },
    });
  }
}
