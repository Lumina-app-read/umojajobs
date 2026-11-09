import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import { IsEnum, IsInt, Matches, Max, Min, validateSync } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Variables d'environnement acceptées par l'API. Toute variable obligatoire manquante ou
 * invalide arrête le démarrage. Les variables Redis, Brevo, Chariow et OpenAI
 * seront ajoutées par les phases qui les utilisent.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  /** Obligatoire : URL PostgreSQL, par exemple postgresql://utilisateur:motdepasse@hote:5432/base */
  @Matches(/^postgres(ql)?:\/\/\S+$/)
  DATABASE_URL!: string;

  // Conversion explicite : les variables d'environnement arrivent toujours sous forme de texte.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT = 4000;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    // Les messages ne contiennent que les noms des variables et les contraintes, jamais les valeurs.
    const details = errors
      .map((error) => `${error.property}: ${Object.keys(error.constraints ?? {}).join(', ')}`)
      .join('; ');
    throw new Error(`Configuration d'environnement invalide — ${details}`);
  }

  return validated;
}
