import 'reflect-metadata';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
};

/**
 * Variables d'environnement acceptées par l'API. Toute variable obligatoire manquante ou
 * invalide arrête le démarrage, sans jamais afficher les valeurs.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT = 4000;

  /** URL publique de l'application web : liens des emails et origine autorisée (CSRF). */
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  APP_URL!: string;

  /** Obligatoire : URL PostgreSQL. */
  @Matches(/^postgres(ql)?:\/\/\S+$/)
  DATABASE_URL!: string;

  /** Obligatoire : URL Redis (limitation du nombre de requêtes). */
  @Matches(/^rediss?:\/\/\S+$/)
  REDIS_URL!: string;

  /** Clé de chiffrement AES-256 (32 octets encodés en base64) pour les secrets TOTP. */
  @Matches(/^[A-Za-z0-9+/]{43}=$/)
  APP_ENCRYPTION_KEY!: string;

  @IsString()
  @MinLength(1)
  SMTP_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT!: number;

  @Transform(toBoolean)
  @IsBoolean()
  SMTP_SECURE = false;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  /** Expéditeur des emails, par exemple « OPPORTINITIES <no-reply@exemple.com> ». */
  @IsString()
  @MinLength(3)
  MAIL_FROM!: string;

  /** Version des conditions d'utilisation acceptées à l'inscription. */
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  TERMS_VERSION!: string;

  /** Cookies `Secure` (préfixe `__Host-`). Obligatoire en production. */
  @Transform(toBoolean)
  @IsBoolean()
  COOKIE_SECURE = true;

  /** Tâches planifiées (activation et expiration des offres). Désactivées dans les tests. */
  @Transform(toBoolean)
  @IsBoolean()
  SCHEDULED_TASKS_ENABLED = true;

  /** Nombre de proxys de confiance devant l'API (Nginx : 1). Sert à lire la véritable IP du client. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY = 0;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  SESSION_TTL_DAYS = 30;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  SESSION_IDLE_TIMEOUT_HOURS = 168;

  /** Durée maximale d'une session donnant accès à l'administration (modérateur, admin, super admin). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72)
  PRIVILEGED_SESSION_TTL_HOURS = 6;

  /** Inactivité maximale d'une session donnant accès à l'administration. */
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  PRIVILEGED_SESSION_IDLE_TIMEOUT_MINUTES = 15;

  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(20)
  AUTH_MAX_FAILED_LOGINS = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  AUTH_LOCKOUT_MINUTES = 15;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (validated.NODE_ENV === NodeEnv.Production && !validated.COOKIE_SECURE) {
    throw new Error(
      "Configuration d'environnement invalide — COOKIE_SECURE doit être true en production",
    );
  }

  if (errors.length > 0) {
    // Les messages ne contiennent que les noms des variables et les contraintes, jamais les valeurs.
    const details = errors
      .map((error) => `${error.property}: ${Object.keys(error.constraints ?? {}).join(', ')}`)
      .join('; ');
    throw new Error(`Configuration d'environnement invalide — ${details}`);
  }

  return validated;
}
