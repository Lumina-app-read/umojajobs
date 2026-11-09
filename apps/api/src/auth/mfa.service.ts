import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { APP_NAME, ERROR_CODES } from '@opportinities/shared';
import { EncryptionService } from '../common/crypto/encryption.service';
import { sha256Hex } from '../common/crypto/tokens';
import { type ClientInfo } from '../common/http/app-request';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventsService } from '../security-events/security-events.service';
import { type AuthContext } from './auth-context';
import { type MfaVerifyDto, type RecoveryCodesDto, type TotpSetupDto } from './auth.dto';
import { AuthService } from './auth.service';
import { base32Encode } from './totp/base32';
import { generateTotpSecret, totpUri, verifyTotp } from './totp/totp';

const RECOVERY_CODE_COUNT = 10;

/** Code de secours de 50 bits, au format XXXXX-XXXXX (alphabet Base32, sans caractère ambigu). */
function generateRecoveryCode(): string {
  const raw = base32Encode(randomBytes(7)).slice(0, 10);
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/-/g, '').toUpperCase();
}

/** Double authentification TOTP (RFC 6238) : obligatoire pour admin et super_admin. */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly securityEvents: SecurityEventsService,
    private readonly auth: AuthService,
  ) {}

  /** Démarre l'inscription : un secret provisoire est stocké chiffré jusqu'à la confirmation. */
  async startSetup(auth: AuthContext, client: ClientInfo): Promise<TotpSetupDto> {
    if (auth.user.totpEnabled) {
      throw new ConflictException({ code: ERROR_CODES.MFA_ALREADY_ENABLED });
    }
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: auth.user.id },
      data: { totpPendingSecretEncrypted: this.encryption.encrypt(secret) },
    });
    await this.securityEvents.record({
      type: 'mfa_enrollment_started',
      userId: auth.user.id,
      client,
    });
    return { secret, otpauthUri: totpUri(secret, auth.user.email, APP_NAME) };
  }

  /** Confirme l'inscription avec un premier code valide, puis délivre les codes de secours. */
  async enable(auth: AuthContext, code: string, client: ClientInfo): Promise<RecoveryCodesDto> {
    if (auth.user.totpEnabled) {
      throw new ConflictException({ code: ERROR_CODES.MFA_ALREADY_ENABLED });
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.user.id },
      select: { totpPendingSecretEncrypted: true },
    });
    if (!user.totpPendingSecretEncrypted) {
      throw new BadRequestException({ code: ERROR_CODES.MFA_SETUP_NOT_STARTED });
    }

    const step = verifyTotp(this.encryption.decrypt(user.totpPendingSecretEncrypted), code);
    if (step === null) {
      await this.auth.registerFailure(auth.user.id, client, 'bad_totp');
      throw new BadRequestException({ code: ERROR_CODES.MFA_INVALID_CODE });
    }

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: auth.user.id },
        data: {
          totpSecretEncrypted: user.totpPendingSecretEncrypted,
          totpPendingSecretEncrypted: null,
          totpEnabledAt: new Date(),
          totpLastUsedStep: step,
          failedLoginCount: 0,
        },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: auth.user.id } });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({
          userId: auth.user.id,
          codeHash: sha256Hex(normalizeRecoveryCode(recoveryCode)),
        })),
      });
      await tx.session.update({
        where: { id: auth.sessionId },
        data: { mfaVerifiedAt: new Date() },
      });
      await this.securityEvents.record({ type: 'mfa_enabled', userId: auth.user.id, client }, tx);
    });

    return { recoveryCodes };
  }

  /**
   * Valide la session avec un code TOTP (un pas de temps ne peut servir qu'une fois) ou un code
   * de secours (usage unique). Chaque échec compte pour le verrouillage du compte.
   */
  async verify(auth: AuthContext, dto: MfaVerifyDto, client: ClientInfo): Promise<void> {
    if (Boolean(dto.code) === Boolean(dto.recoveryCode)) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        details: [{ field: 'code', rules: ['exactlyOneOfCodeOrRecoveryCode'] }],
      });
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.user.id },
      select: { totpSecretEncrypted: true, totpEnabledAt: true },
    });
    if (!user.totpSecretEncrypted || !user.totpEnabledAt) {
      throw new BadRequestException({ code: ERROR_CODES.MFA_SETUP_NOT_STARTED });
    }

    const verified = dto.code
      ? await this.consumeTotp(auth.user.id, user.totpSecretEncrypted, dto.code)
      : await this.consumeRecoveryCode(auth.user.id, dto.recoveryCode ?? '');

    if (!verified) {
      await this.auth.registerFailure(auth.user.id, client, 'bad_totp');
      throw new BadRequestException({ code: ERROR_CODES.MFA_INVALID_CODE });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: auth.sessionId },
        data: { mfaVerifiedAt: new Date() },
      });
      await tx.user.update({ where: { id: auth.user.id }, data: { failedLoginCount: 0 } });
      await this.securityEvents.record(
        {
          type: dto.code ? 'mfa_verified' : 'mfa_recovery_code_used',
          userId: auth.user.id,
          client,
          metadata: { sessionId: auth.sessionId },
        },
        tx,
      );
    });
  }

  private async consumeTotp(
    userId: string,
    encryptedSecret: string,
    code: string,
  ): Promise<boolean> {
    const step = verifyTotp(this.encryption.decrypt(encryptedSecret), code);
    if (step === null) return false;
    // Anti-rejeu atomique : le pas de temps doit être strictement supérieur au dernier utilisé.
    const result = await this.prisma.user.updateMany({
      where: { id: userId, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: step } }] },
      data: { totpLastUsedStep: step },
    });
    return result.count === 1;
  }

  private async consumeRecoveryCode(userId: string, recoveryCode: string): Promise<boolean> {
    const result = await this.prisma.mfaRecoveryCode.updateMany({
      where: { userId, codeHash: sha256Hex(normalizeRecoveryCode(recoveryCode)), usedAt: null },
      data: { usedAt: new Date() },
    });
    return result.count === 1;
  }
}
