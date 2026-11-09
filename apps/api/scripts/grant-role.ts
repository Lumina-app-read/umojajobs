/**
 * Attribue (ou retire) un rôle à un utilisateur existant, en ligne de commande.
 * Sert notamment à créer le premier super_admin d'un environnement. L'opération est
 * journalisée dans security_events. Le compte devra activer le TOTP à sa prochaine connexion.
 *
 * Usage (depuis apps/api) :
 *   pnpm role:grant <email> <user|moderator|admin|super_admin>
 *   pnpm role:grant <email> <rôle> --revoke
 */
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { ROLE_CODES, type RoleCode } from '@opportinities/shared';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';

loadEnv({
  path: [resolve(__dirname, '../.env'), resolve(__dirname, '../../../.env')],
  quiet: true,
});

function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}

async function main(): Promise<void> {
  const [rawEmail, role, flag] = process.argv.slice(2);
  const revoke = flag === '--revoke';
  if (!rawEmail || !role || !isRoleCode(role) || (flag !== undefined && !revoke)) {
    throw new Error(`Usage : pnpm role:grant <email> <${ROLE_CODES.join('|')}> [--revoke]`);
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL est absent : voir .env.example.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const email = rawEmail.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      throw new Error(`Aucun utilisateur avec l'adresse ${email}.`);
    }
    const roleRecord = await prisma.role.findUniqueOrThrow({
      where: { code: role },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      if (revoke) {
        await tx.userRole.deleteMany({ where: { userId: user.id, roleId: roleRecord.id } });
      } else {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: roleRecord.id } },
          create: { userId: user.id, roleId: roleRecord.id },
          update: {},
        });
      }
      await tx.securityEvent.create({
        data: {
          type: revoke ? 'role_revoked' : 'role_granted',
          userId: user.id,
          metadata: { role, via: 'cli' },
        },
      });
    });
    process.stdout.write(`Rôle ${role} ${revoke ? 'retiré à' : 'attribué à'} ${email}.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
