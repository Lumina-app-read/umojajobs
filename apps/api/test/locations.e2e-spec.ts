import { type INestApplication } from '@nestjs/common';
import { AFRICAN_COUNTRIES, AFRICAN_COUNTRY_COUNT, flagEmoji } from '@opportinities/shared';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './create-test-app';

interface CountryBody {
  iso2: string;
  iso3: string;
  nameFr: string;
  dialCode: string;
  flagEmoji: string;
}

interface CityBody {
  id: string;
  name: string;
  regionName: string | null;
  population: number;
  timezone: string;
}

describe('API — référentiel pays et villes (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('seed', () => {
    it('contient exactement les 54 pays du référentiel partagé', async () => {
      const countries = await prisma.country.findMany({ select: { iso2: true } });
      expect(countries).toHaveLength(AFRICAN_COUNTRY_COUNT);
      expect(countries.map((c) => c.iso2).sort()).toEqual(
        AFRICAN_COUNTRIES.map((c) => c.iso2).sort(),
      );
    });

    it('rattache des villes à chacun des 54 pays', async () => {
      const groups = await prisma.city.groupBy({ by: ['countryId'] });
      expect(groups).toHaveLength(AFRICAN_COUNTRY_COUNT);
    });

    it('applique les contraintes de la base (code ISO invalide refusé)', async () => {
      await expect(
        prisma.country.update({ where: { iso2: 'CD' }, data: { iso3: 'cod' } }),
      ).rejects.toThrow();
    });
  });

  describe('GET /api/v1/countries', () => {
    it('renvoie les 54 pays avec drapeau, indicatif et cache public', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/countries').expect(200);
      const body = response.body as CountryBody[];

      expect(body).toHaveLength(AFRICAN_COUNTRY_COUNT);
      expect(response.headers['cache-control']).toBe('public, max-age=3600');
      expect(body.find((c) => c.iso2 === 'CD')).toEqual(
        expect.objectContaining({
          iso3: 'COD',
          nameFr: 'République démocratique du Congo',
          dialCode: '+243',
          flagEmoji: flagEmoji('CD'),
        }),
      );
      // Aucun champ interne exposé.
      expect(Object.keys(body[0] ?? {})).not.toEqual(expect.arrayContaining(['id', 'isActive']));
    });

    it("masque un pays désactivé par l'administration", async () => {
      await prisma.country.update({ where: { iso2: 'SC' }, data: { isActive: false } });
      try {
        const response = await request(app.getHttpServer()).get('/api/v1/countries').expect(200);
        const body = response.body as CountryBody[];
        expect(body).toHaveLength(AFRICAN_COUNTRY_COUNT - 1);
        expect(body.some((c) => c.iso2 === 'SC')).toBe(false);
        await request(app.getHttpServer()).get('/api/v1/countries/SC/cities').expect(404);
      } finally {
        await prisma.country.update({ where: { iso2: 'SC' }, data: { isActive: true } });
      }
    });
  });

  describe('GET /api/v1/countries/:iso2/cities', () => {
    it('sans recherche, renvoie les villes les plus peuplées', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/countries/CD/cities?limit=3')
        .expect(200);
      const body = response.body as CityBody[];

      expect(body).toHaveLength(3);
      expect(body[0]?.name).toBe('Kinshasa');
      const populations = body.map((c) => c.population);
      expect(populations).toEqual([...populations].sort((a, b) => b - a));
    });

    it('ignore la casse et les accents, et fournit région et fuseau', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/countries/cd/cities?q=LUBÚMBASHI')
        .expect(200);
      const body = response.body as CityBody[];

      expect(body[0]).toEqual(
        expect.objectContaining({
          name: 'Lubumbashi',
          regionName: 'Haut-Katanga',
          timezone: 'Africa/Lubumbashi',
        }),
      );
    });

    it('place en premier les villes dont le nom commence par la recherche', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/countries/SN/cities?q=da')
        .expect(200);
      const body = response.body as CityBody[];

      expect(body[0]?.name).toBe('Dakar');
    });

    it('limite le nombre de résultats', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/countries/NG/cities?limit=50')
        .expect(200);
      expect(response.body).toHaveLength(50);
    });

    it('neutralise les caractères génériques SQL dans la recherche', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/countries/CD/cities?q=${encodeURIComponent("%' OR 1=1 --")}`)
        .expect(200);
      // La saisie normalisée devient « or 1 1 » : aucune ville ne correspond, aucune erreur SQL.
      expect(response.body).toEqual([]);
    });

    it.each([
      ['code pays invalide', '/api/v1/countries/C1/cities', 400],
      ['limite trop grande', '/api/v1/countries/CD/cities?limit=51', 400],
      ['limite non numérique', '/api/v1/countries/CD/cities?limit=abc', 400],
      ['paramètre inconnu', '/api/v1/countries/CD/cities?foo=bar', 400],
    ])('refuse une requête invalide (%s)', async (_label, url, status) => {
      await request(app.getHttpServer()).get(url).expect(status);
    });

    it('renvoie 404 et un code traduisible pour un pays hors référentiel', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/countries/FR/cities')
        .expect(404);
      expect(response.body).toEqual(expect.objectContaining({ code: 'COUNTRY_NOT_FOUND' }));
    });
  });
});
