/**
 * Format du jeu de données versionné des villes (prisma/seed/data/cities-africa.tsv).
 * Partagé par le script de génération et par le seed.
 */
export const CITY_DATASET_COLUMNS = [
  'geonames_id',
  'country_iso2',
  'name',
  'ascii_name',
  'region_name',
  'latitude',
  'longitude',
  'population',
  'timezone',
  'feature_code',
] as const;

export interface CityDatasetRow {
  geonamesId: number;
  countryIso2: string;
  name: string;
  asciiName: string;
  regionName: string;
  /** Conservées sous forme de texte pour éviter toute perte de précision (colonnes DECIMAL). */
  latitude: string;
  longitude: string;
  population: number;
  timezone: string;
  featureCode: string;
}

export function serializeCityRow(row: CityDatasetRow): string {
  return [
    row.geonamesId,
    row.countryIso2,
    row.name,
    row.asciiName,
    row.regionName,
    row.latitude,
    row.longitude,
    row.population,
    row.timezone,
    row.featureCode,
  ].join('\t');
}

export function parseCityDataset(content: string): CityDatasetRow[] {
  const [header, ...lines] = content.split(/\r?\n/).filter((line) => line.length > 0);
  if (header !== CITY_DATASET_COLUMNS.join('\t')) {
    throw new Error('En-tête du jeu de données des villes inattendu.');
  }

  return lines.map((line, index) => {
    const fields = line.split('\t');
    if (fields.length !== CITY_DATASET_COLUMNS.length) {
      throw new Error(
        `Ligne ${index + 2} : ${fields.length} colonnes au lieu de ${CITY_DATASET_COLUMNS.length}.`,
      );
    }
    const [
      geonamesId,
      countryIso2,
      name,
      asciiName,
      regionName,
      latitude,
      longitude,
      population,
      timezone,
      featureCode,
    ] = fields as [string, string, string, string, string, string, string, string, string, string];

    return {
      geonamesId: Number(geonamesId),
      countryIso2,
      name,
      asciiName,
      regionName,
      latitude,
      longitude,
      population: Number(population),
      timezone,
      featureCode,
    };
  });
}
