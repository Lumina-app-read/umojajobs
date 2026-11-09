/**
 * Génère le jeu de données des villes africaines à partir des exports GeoNames.
 *
 * Usage (depuis apps/api) :
 *   pnpm cities:build <chemin/cities5000.txt> <chemin/admin1CodesASCII.txt>
 *
 * Fichiers sources : https://download.geonames.org/export/dump/ (cities5000.zip décompressé,
 * admin1CodesASCII.txt). Licence : CC BY 4.0, attribution obligatoire (voir prisma/seed/data/ATTRIBUTION.md).
 *
 * Le résultat (prisma/seed/data/cities-africa.tsv) est versionné : le seed ne dépend pas du réseau.
 */
import { createReadStream, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { AFRICAN_COUNTRIES } from '@opportinities/shared';
import {
  CITY_DATASET_COLUMNS,
  type CityDatasetRow,
  serializeCityRow,
} from '../../prisma/seed/cities-dataset';

/** Codes GeoNames exclus : quartiers (PPLX), lieux historiques, abandonnés ou détruits. */
const EXCLUDED_FEATURE_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH']);

const OUTPUT_PATH = resolve(__dirname, '../../prisma/seed/data/cities-africa.tsv');

async function readLines(path: string, onLine: (fields: string[]) => void): Promise<void> {
  const reader = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  for await (const line of reader) {
    if (line.length > 0 && !line.startsWith('#')) {
      onLine(line.split('\t'));
    }
  }
}

function requireField(fields: string[], index: number, label: string): string {
  const value = fields[index];
  if (value === undefined) {
    throw new Error(`Champ GeoNames manquant (${label}) : ${fields.join(' | ')}`);
  }
  return value;
}

async function main(): Promise<void> {
  const [citiesPath, admin1Path] = process.argv.slice(2);
  if (!citiesPath || !admin1Path) {
    throw new Error('Usage : pnpm cities:build <cities5000.txt> <admin1CodesASCII.txt>');
  }

  const africanIso2 = new Set<string>(AFRICAN_COUNTRIES.map((country) => country.iso2));

  // admin1CodesASCII.txt : "CD.10<TAB>Kasaï-Central<TAB>Kasai-Central<TAB>geonameid"
  const regionNames = new Map<string, string>();
  await readLines(admin1Path, (fields) => {
    regionNames.set(requireField(fields, 0, 'code'), requireField(fields, 1, 'nom'));
  });

  const rows: CityDatasetRow[] = [];
  let excluded = 0;

  // Format cities5000.txt : https://download.geonames.org/export/dump/readme.txt
  await readLines(citiesPath, (fields) => {
    const countryIso2 = requireField(fields, 8, 'pays');
    if (!africanIso2.has(countryIso2)) return;

    const featureCode = requireField(fields, 7, 'code');
    if (EXCLUDED_FEATURE_CODES.has(featureCode)) {
      excluded += 1;
      return;
    }

    const admin1 = requireField(fields, 10, 'admin1');
    const row: CityDatasetRow = {
      geonamesId: Number(requireField(fields, 0, 'id')),
      countryIso2,
      name: requireField(fields, 1, 'nom').trim(),
      asciiName: requireField(fields, 2, 'nom ASCII').trim(),
      regionName: regionNames.get(`${countryIso2}.${admin1}`) ?? '',
      latitude: requireField(fields, 4, 'latitude'),
      longitude: requireField(fields, 5, 'longitude'),
      population: Number(requireField(fields, 14, 'population')),
      timezone: requireField(fields, 17, 'fuseau'),
      featureCode,
    };

    if (!Number.isInteger(row.geonamesId) || !Number.isInteger(row.population) || !row.name) {
      throw new Error(`Ligne GeoNames invalide : ${fields.join(' | ')}`);
    }
    rows.push(row);
  });

  rows.sort(
    (a, b) =>
      a.countryIso2.localeCompare(b.countryIso2) ||
      b.population - a.population ||
      a.geonamesId - b.geonamesId,
  );

  const content = [CITY_DATASET_COLUMNS.join('\t'), ...rows.map(serializeCityRow)].join('\n');
  writeFileSync(OUTPUT_PATH, `${content}\n`, 'utf8');

  const perCountry = new Map<string, number>();
  for (const row of rows)
    perCountry.set(row.countryIso2, (perCountry.get(row.countryIso2) ?? 0) + 1);
  const missing = [...africanIso2].filter((iso2) => !perCountry.has(iso2));

  process.stdout.write(
    `${rows.length} villes écrites dans ${OUTPUT_PATH} (${excluded} exclues par type).\n` +
      `Pays sans ville : ${missing.length > 0 ? missing.join(', ') : 'aucun'}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
