import { Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '@opportinities/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CITY_SEARCH_DEFAULT_LIMIT, type CityDto, type CountryDto } from './locations.dto';
import { toSearchName } from './search-name';

const COUNTRY_SELECT = {
  iso2: true,
  iso3: true,
  nameFr: true,
  nameEn: true,
  officialNameFr: true,
  officialNameEn: true,
  dialCode: true,
  flagEmoji: true,
  currencyCode: true,
  defaultTimezone: true,
} as const;

/** Longueur minimale d'une recherche textuelle ; en dessous, on renvoie les villes les plus peuplées. */
const MIN_SEARCH_LENGTH = 2;

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pays actifs, triés par code ISO. Le tri alphabétique localisé est fait par l'interface. */
  listCountries(): Promise<CountryDto[]> {
    return this.prisma.country.findMany({
      where: { isActive: true },
      select: COUNTRY_SELECT,
      orderBy: { iso2: 'asc' },
    });
  }

  async getActiveCountryId(iso2: string): Promise<string> {
    const country = await this.prisma.country.findFirst({
      where: { iso2, isActive: true },
      select: { id: true },
    });
    if (!country) {
      throw new NotFoundException({ code: ERROR_CODES.COUNTRY_NOT_FOUND });
    }
    return country.id;
  }

  /**
   * Recherche les villes actives d'un pays. Les villes dont le nom commence par le texte saisi
   * passent en premier, puis le tri se fait par population décroissante.
   */
  async searchCities(
    iso2: string,
    query: string | undefined,
    limit: number = CITY_SEARCH_DEFAULT_LIMIT,
  ): Promise<CityDto[]> {
    const countryId = await this.getActiveCountryId(iso2);
    const term = toSearchName(query ?? '');

    if (term.length < MIN_SEARCH_LENGTH) {
      return this.prisma.city.findMany({
        where: { countryId, isActive: true },
        select: { id: true, name: true, regionName: true, population: true, timezone: true },
        orderBy: [{ population: 'desc' }, { name: 'asc' }],
        take: limit,
      });
    }

    // `term` ne contient que des lettres, chiffres et espaces (toSearchName) : aucun caractère
    // générique LIKE ne peut être injecté. La requête reste paramétrée.
    return this.prisma.$queryRaw<CityDto[]>`
      SELECT "id", "name", "region_name" AS "regionName", "population", "timezone"
      FROM "cities"
      WHERE "country_id" = ${countryId}::uuid
        AND "is_active" = true
        AND "search_name" LIKE ${`%${term}%`}
      ORDER BY ("search_name" LIKE ${`${term}%`}) DESC, "population" DESC, "name" ASC
      LIMIT ${limit}
    `;
  }
}
