import { ROLE_CODES } from '@opportinities/shared';
import { type PrismaClient } from '../../src/generated/prisma/client';
import { PERMISSION_DESCRIPTIONS, ROLE_PERMISSIONS } from '../../src/auth/rbac';

/**
 * Rôles, permissions et correspondances (source : src/auth/rbac.ts). Idempotent : les
 * correspondances en base sont alignées exactement sur le code (ajouts et retraits).
 */
export async function seedRolesAndPermissions(
  prisma: PrismaClient,
): Promise<{ roles: number; permissions: number }> {
  const permissionIds = new Map<string, string>();
  for (const [code, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
    const permission = await prisma.permission.upsert({
      where: { code },
      create: { code, description },
      update: { description },
      select: { id: true },
    });
    permissionIds.set(code, permission.id);
  }

  for (const code of ROLE_CODES) {
    const role = await prisma.role.upsert({
      where: { code },
      create: { code },
      update: {},
      select: { id: true },
    });
    const expected = ROLE_PERMISSIONS[code].map((permission) => {
      const id = permissionIds.get(permission);
      if (!id) throw new Error(`Permission inconnue : ${permission}`);
      return id;
    });

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { notIn: expected } },
      }),
      prisma.rolePermission.createMany({
        data: expected.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      }),
    ]);
  }

  return { roles: ROLE_CODES.length, permissions: permissionIds.size };
}
