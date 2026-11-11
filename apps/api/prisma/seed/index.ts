/**
 * Seed du référentiel : 54 pays africains, villes GeoNames, rôles et permissions, catégories d'offres.
 * Idempotent : peut être relancé sans créer de doublon (mise à jour des données existantes).
 *
 * Usage : pnpm --filter @opportinities/api db:seed
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { AFRICAN_COUNTRIES, AFRICAN_COUNTRY_COUNT, flagEmoji } from '@opportinities/shared';
import { config as loadEnv } from 'dotenv';
import { uuidv7 } from '../../src/common/uuid-v7';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client';
import { toSearchName } from '../../src/locations/search-name';
import { type CityDatasetRow, parseCityDataset } from './cities-dataset';
import { seedFinance } from './finance';
import { seedJobCategories } from './job-categories';
import { seedRolesAndPermissions } from './roles';

loadEnv({
  path: [resolve(__dirname, '../../.env'), resolve(__dirname, '../../../../.env')],
  quiet: true,
});

/** 1 000 lignes × 12 paramètres reste sous la limite de 65 535 paramètres de PostgreSQL. */
const CITY_BATCH_SIZE = 1000;

async function seedCountries(prisma: PrismaClient): Promise<Map<string, string>> {
  // Contrôle d'exécution : protège contre une modification accidentelle du référentiel partagé.
  const actualCount: number = AFRICAN_COUNTRIES.length;
  const expectedCount: number = AFRICAN_COUNTRY_COUNT;
  if (actualCount !== expectedCount) {
    throw new Error(`Référentiel incomplet : ${actualCount} pays au lieu de ${expectedCount}.`);
  }

  const idsByIso2 = new Map<string, string>();
  for (const country of AFRICAN_COUNTRIES) {
    const data = {
      iso3: country.iso3,
      nameFr: country.nameFr,
      nameEn: country.nameEn,
      officialNameFr: country.officialNameFr,
      officialNameEn: country.officialNameEn,
      dialCode: country.dialCode,
      flagEmoji: flagEmoji(country.iso2),
      currencyCode: country.currencyCode,
      defaultTimezone: country.defaultTimezone,
    };
    // Le statut actif/inactif est géré par l'administration : le seed ne le modifie pas.
    const saved = await prisma.country.upsert({
      where: { iso2: country.iso2 },
      create: { iso2: country.iso2, ...data },
      update: data,
      select: { id: true },
    });
    idsByIso2.set(country.iso2, saved.id);
  }
  return idsByIso2;
}

function cityValues(row: CityDatasetRow, countryId: string): Prisma.Sql {
  return Prisma.sql`(
    ${uuidv7()}::uuid, ${countryId}::uuid, ${row.geonamesId}, ${row.name}, ${row.asciiName},
    ${toSearchName(row.asciiName || row.name)}, ${row.regionName || null},
    ${row.latitude}::numeric, ${row.longitude}::numeric, ${row.population}, ${row.timezone},
    ${row.featureCode || null}, 'geonames'::city_source, now()
  )`;
}

async function seedCities(prisma: PrismaClient, countryIds: Map<string, string>): Promise<number> {
  const datasetPath = resolve(__dirname, 'data/cities-africa.tsv');
  const rows = parseCityDataset(readFileSync(datasetPath, 'utf8'));

  for (let start = 0; start < rows.length; start += CITY_BATCH_SIZE) {
    const batch = rows.slice(start, start + CITY_BATCH_SIZE);
    const values = batch.map((row) => {
      const countryId = countryIds.get(row.countryIso2);
      if (!countryId) {
        throw new Error(`Ville ${row.geonamesId} : pays inconnu ${row.countryIso2}.`);
      }
      return cityValues(row, countryId);
    });

    // Upsert sur l'identifiant GeoNames. Le statut actif/inactif reste géré par l'administration.
    await prisma.$executeRaw`
      INSERT INTO "cities" (
        "id", "country_id", "geonames_id", "name", "ascii_name", "search_name", "region_name",
        "latitude", "longitude", "population", "timezone", "feature_code", "source", "updated_at"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("geonames_id") DO UPDATE SET
        "country_id" = EXCLUDED."country_id",
        "name" = EXCLUDED."name",
        "ascii_name" = EXCLUDED."ascii_name",
        "search_name" = EXCLUDED."search_name",
        "region_name" = EXCLUDED."region_name",
        "latitude" = EXCLUDED."latitude",
        "longitude" = EXCLUDED."longitude",
        "population" = EXCLUDED."population",
        "timezone" = EXCLUDED."timezone",
        "feature_code" = EXCLUDED."feature_code",
        "updated_at" = now()
    `;
  }
  return rows.length;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL est absent : voir .env.example.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const countryIds = await seedCountries(prisma);
    const cityCount = await seedCities(prisma, countryIds);
    const rbac = await seedRolesAndPermissions(prisma);
    const categoryCount = await seedJobCategories(prisma);
    const financeCount = await seedFinance(prisma);
    process.stdout.write(
      `Seed terminé : ${countryIds.size} pays, ${cityCount} villes, ${rbac.roles} rôles, ${rbac.permissions} permissions, ${categoryCount} catégories d'offres, ${financeCount} valeurs financières initialisées.\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Échec du seed : ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
