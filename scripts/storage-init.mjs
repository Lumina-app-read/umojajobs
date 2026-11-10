/**
 * Initialise le stockage objet local (Garage) : disposition du nœud, clé d'accès de l'API et
 * bucket privé. Idempotent : peut être relancé sans effet si tout est déjà en place.
 *
 * Usage (depuis la racine, après pnpm docker:up) : pnpm storage:init
 * Les identifiants viennent du fichier .env (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET).
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

process.loadEnvFile(resolve(import.meta.dirname, '../.env'));

const COMPOSE = [
  'compose',
  '-f',
  'infrastructure/compose/docker-compose.dev.yml',
  '--env-file',
  '.env',
  'exec',
  '-T',
  'garage',
  '/garage',
];

/** Exécute une commande Garage dans le conteneur ; renvoie sa sortie (ou null en cas d'échec). */
function garage(args, { allowFailure = false } = {}) {
  const result = spawnSync('docker', [...COMPOSE, ...args], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    if (allowFailure) return null;
    throw new Error(`garage ${args.join(' ')} : ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} est absent du fichier .env (voir .env.example).`);
  return value;
};

const keyId = required('S3_ACCESS_KEY_ID');
const secret = required('S3_SECRET_ACCESS_KEY');
const bucket = required('S3_BUCKET');

// 1. Disposition : un seul nœud, capacité symbolique.
const nodeId = garage(['node', 'id', '-q']).trim().split('@')[0];
const layout = garage(['layout', 'show']);
if (/No nodes currently have a role/i.test(layout) || !layout.includes(nodeId.slice(0, 16))) {
  garage(['layout', 'assign', '-z', 'local', '-c', '10G', nodeId]);
  const version = Number(/Current cluster layout version:\s*(\d+)/i.exec(layout)?.[1] ?? 0) + 1;
  garage(['layout', 'apply', '--version', String(version)]);
  console.log(`Disposition appliquée (version ${version}).`);
} else {
  console.log('Disposition déjà en place.');
}

// 2. Clé d'accès de l'API (importée depuis .env pour rester stable entre les redémarrages).
if (garage(['key', 'info', keyId], { allowFailure: true }) === null) {
  garage(['key', 'import', '--yes', '-n', 'opportinities-api', keyId, secret]);
  console.log('Clé d’accès importée.');
} else {
  console.log('Clé d’accès déjà présente.');
}

// 3. Bucket privé et droits de la clé.
if (garage(['bucket', 'info', bucket], { allowFailure: true }) === null) {
  garage(['bucket', 'create', bucket]);
  console.log(`Bucket « ${bucket} » créé.`);
} else {
  console.log(`Bucket « ${bucket} » déjà présent.`);
}
garage(['bucket', 'allow', '--read', '--write', '--owner', bucket, '--key', keyId]);
console.log('Stockage prêt : bucket privé, aucun accès anonyme.');
