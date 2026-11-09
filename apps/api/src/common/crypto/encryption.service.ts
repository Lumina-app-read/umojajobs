import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../../config/env.validation';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';

/**
 * Chiffrement authentifié AES-256-GCM des secrets stockés en base (secrets TOTP).
 * Format : `v1.<iv>.<tag>.<texte chiffré>` en base64url. Toute altération est détectée.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.key = Buffer.from(config.get('APP_ENCRYPTION_KEY', { infer: true }), 'base64');
    if (this.key.length !== 32) {
      throw new Error('APP_ENCRYPTION_KEY doit contenir exactement 32 octets.');
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_BYTES });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [VERSION, iv, cipher.getAuthTag(), encrypted]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
      .join('.');
  }

  decrypt(payload: string): string {
    const [version, iv, tag, encrypted] = payload.split('.');
    if (version !== VERSION || !iv || !tag || encrypted === undefined) {
      throw new Error('Donnée chiffrée invalide.');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64url'), {
      authTagLength: TAG_BYTES,
    });
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
