import { Algorithm, hash, verify } from '@node-rs/argon2';
import { BadRequestException, Injectable, type OnModuleInit } from '@nestjs/common';
import { ERROR_CODES, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@opportinities/shared';

/** Paramètres Argon2id (recommandation OWASP : m = 19 Mio, t = 2, p = 1). */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Mots de passe très courants d'au moins 12 caractères, refusés malgré leur longueur. */
const COMMON_PASSWORDS = new Set([
  '123456789012',
  '1234567890123',
  'password1234',
  'password12345',
  'motdepasse123',
  'motdepasse1234',
  'azertyuiop123',
  'qwertyuiop123',
  'azertyuiopqs',
  'qwertyuiopas',
  'opportinities',
  'opportinities1',
  'opportinities123',
  'iloveyou1234',
  'welcome12345',
  'bienvenue123',
  'administrator',
  'administrateur',
]);

export interface PasswordContext {
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Hachage et politique des mots de passe (NIST SP 800-63B) : longueur minimale de 12,
 * pas de règles de composition, refus des mots de passe triviaux ou liés à l'identité.
 */
@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    // Empreinte factice : une connexion avec un email inconnu prend le même temps qu'avec un vrai compte.
    this.dummyHash = await hash('opportinities-dummy-password-for-timing', ARGON2_OPTIONS);
  }

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /** Vérification factice à temps constant (email inconnu). Renvoie toujours false. */
  async verifyDummy(password: string): Promise<false> {
    await this.verify(this.dummyHash, password);
    return false;
  }

  /** Lève PASSWORD_TOO_WEAK si le mot de passe ne respecte pas la politique. */
  assertStrong(password: string, context: PasswordContext): void {
    if (!this.isStrong(password, context)) {
      throw new BadRequestException({ code: ERROR_CODES.PASSWORD_TOO_WEAK });
    }
  }

  isStrong(password: string, context: PasswordContext): boolean {
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      return false;
    }
    const lower = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lower)) return false;
    if (new Set(lower).size < 4) return false;

    const identityParts = [
      context.email.split('@')[0] ?? '',
      context.firstName ?? '',
      context.lastName ?? '',
    ]
      .map((part) => part.toLowerCase().trim())
      .filter((part) => part.length >= 4);
    return !identityParts.some((part) => lower.includes(part));
  }
}
