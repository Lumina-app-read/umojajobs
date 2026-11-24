import { type INestApplication } from '@nestjs/common';
import {
  type AdminCatalogResponse,
  CONTRIBUTOR_TERMS_VERSION,
  type JobCategoryResponse,
  type JobOfferResponse,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import { totp } from '../src/auth/totp/totp';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';

const BASE = '/api/v1/admin/catalog';
const code = (response: { body: unknown }) => (response.body as { code: string }).code;
const day = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe('Administration des catégories et des pays (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let boss: ApiClient;
  let bossId: string;

  async function account(role?: 'admin' | 'super_admin') {
    const email = uniqueEmail('catalog');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    await api.post('/api/v1/auth/verify-email', {
      token: extractToken(await waitForEmail(email, 'Confirmez')),
    });
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    if (role) {
      const found = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: found.id } });
      const { secret } = (await api.post('/api/v1/auth/mfa/totp/setup')).body as {
        secret: string;
      };
      await api.post('/api/v1/auth/mfa/totp/enable', { code: totp(secret) });
    }
    return { id: user.id, api };
  }

  const catalog = async () => (await boss.get(BASE)).body as AdminCatalogResponse;
  const publicCategories = async () =>
    (await boss.get('/api/v1/job-categories')).body as JobCategoryResponse[];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    const admin = await account('super_admin');
    boss = admin.api;
    bossId = admin.id;
  });

  afterAll(async () => {
    // Les autres suites comptent sur le référentiel complet.
    await prisma.country.updateMany({ data: { isActive: true } });
    await prisma.jobCategory.updateMany({ data: { isActive: true } });
    await app.close();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('est réservée à la gestion des paramètres', async () => {
    const member = await account();
    const admin = await account('admin');
    for (const who of [member, admin]) {
      expect((await who.api.get(BASE)).status).toBe(403);
      expect((await who.api.patch(`${BASE}/countries/SN`, { isActive: false })).status).toBe(403);
    }
    const current = await catalog();
    expect(current.countries).toHaveLength(54);
    expect(current.categories.length).toBeGreaterThan(10);
  });

  it('crée, renomme et ordonne sans changer les adresses, avec trace avant et après', async () => {
    const created = await boss.post(`${BASE}/categories`, {
      nameFr: '  Énergies   renouvelables ',
      nameEn: 'Renewable energy',
    });
    expect(created.status).toBe(200);
    const last = (created.body as AdminCatalogResponse).categories.at(-1);
    expect(last).toMatchObject({
      slug: 'renewable-energy',
      nameFr: 'Énergies renouvelables',
      isActive: true,
      offers: 0,
    });
    expect((await publicCategories()).at(-1)?.slug).toBe('renewable-energy');

    const duplicate = await boss.post(`${BASE}/categories`, {
      nameFr: 'ÉNERGIES RENOUVELABLES',
      nameEn: 'Autre nom',
    });
    expect(code(duplicate)).toBe('CATEGORY_DUPLICATE');
    expect((await boss.post(`${BASE}/categories`, { nameFr: 'X', nameEn: 'Y' })).status).toBe(400);

    const renamed = (await boss.patch(`${BASE}/categories/${last?.id}`, { nameEn: 'Clean energy' }))
      .body as AdminCatalogResponse;
    expect(renamed.categories.at(-1)).toMatchObject({
      slug: 'renewable-energy',
      nameEn: 'Clean energy',
      nameFr: 'Énergies renouvelables',
    });
    const event = await prisma.securityEvent.findFirstOrThrow({
      where: { type: 'catalog_changed', userId: bossId },
      orderBy: { id: 'desc' },
    });
    expect(event.metadata).toMatchObject({
      target: 'category',
      id: last?.id,
      before: { nameEn: 'Renewable energy' },
      after: { nameEn: 'Clean energy' },
    });

    const ids = renamed.categories.map((category) => category.id);
    const reversed = [...ids].reverse();
    const ordered = (await boss.put(`${BASE}/categories/order`, { ids: reversed }))
      .body as AdminCatalogResponse;
    expect(ordered.categories.map((category) => category.id)).toEqual(reversed);
    expect((await publicCategories()).map((category) => category.id)).toEqual(reversed);
    for (const bad of [ids.slice(1), [...ids.slice(1), ids[1]]]) {
      expect(code(await boss.put(`${BASE}/categories/order`, { ids: bad }))).toBe(
        'CATEGORY_ORDER_CONFLICT',
      );
    }
    await boss.put(`${BASE}/categories/order`, { ids });
    const ghost = '01a00000-0000-7000-8000-000000000000';
    expect(code(await boss.patch(`${BASE}/categories/${ghost}`, { isActive: false }))).toBe(
      'CATEGORY_NOT_FOUND',
    );
  });

  it('une catégorie ou un pays désactivé n’est plus proposé, mais reste sur l’existant', async () => {
    const member = await account();
    await member.api.post('/api/v1/auth/me/contributor-terms', {
      version: CONTRIBUTOR_TERMS_VERSION,
    });
    const category = (await publicCategories())[0] as JobCategoryResponse;
    const input = {
      title: 'Comptable',
      companyName: 'Test SA',
      countryIso2: 'GA',
      categoryId: category.id,
      contractType: 'permanent',
      workMode: 'on_site',
      description: 'Tenue de la comptabilité générale.',
      startDate: day(0),
      endDate: day(20),
      sourceType: 'newspaper',
      applicationEmail: 'rh@example.test',
    };
    const offer = (await member.api.post('/api/v1/me/job-offers', input)).body as JobOfferResponse;
    expect(offer.id).toBeDefined();

    await boss.patch(`${BASE}/categories/${category.id}`, { isActive: false });
    const updated = (await boss.patch(`${BASE}/countries/GA`, { isActive: false }))
      .body as AdminCatalogResponse;
    expect(updated.countries.find((country) => country.iso2 === 'GA')).toMatchObject({
      isActive: false,
      offers: 1,
    });
    expect((await publicCategories()).some((entry) => entry.id === category.id)).toBe(false);
    const countries = (await boss.get('/api/v1/countries')).body as { iso2: string }[];
    expect(countries.some((country) => country.iso2 === 'GA')).toBe(false);

    // Nouvelle inscription et nouvelle offre refusées ; l'offre existante reste modifiable.
    const visitor = await new ApiClient(app).init();
    const signup = await visitor.post(
      '/api/v1/auth/register',
      registrationPayload(uniqueEmail('ga'), { countryIso2: 'GA' }),
    );
    expect(signup.status).toBe(400);
    expect((await member.api.post('/api/v1/me/job-offers', input)).status).toBe(400);
    const edited = await member.api.patch(`/api/v1/me/job-offers/${offer.id}`, {
      version: offer.version,
      title: 'Comptable confirmé',
      countryIso2: 'GA',
      categoryId: category.id,
    });
    expect(edited.status).toBe(200);

    await boss.patch(`${BASE}/categories/${category.id}`, { isActive: true });
    await boss.patch(`${BASE}/countries/GA`, { isActive: true });
    expect((await member.api.post('/api/v1/me/job-offers', input)).status).toBe(201);
  });

  it('garde toujours un pays et une catégorie actifs', async () => {
    await prisma.country.updateMany({ where: { iso2: { not: 'SN' } }, data: { isActive: false } });
    expect(code(await boss.patch(`${BASE}/countries/SN`, { isActive: false }))).toBe(
      'CATALOG_LAST_ACTIVE',
    );
    const [first] = (await catalog()).categories;
    await prisma.jobCategory.updateMany({
      where: { id: { not: first?.id } },
      data: { isActive: false },
    });
    expect(code(await boss.patch(`${BASE}/categories/${first?.id}`, { isActive: false }))).toBe(
      'CATALOG_LAST_ACTIVE',
    );
    expect(code(await boss.patch(`${BASE}/countries/ZZ`, { isActive: false }))).toBe(
      'COUNTRY_NOT_FOUND',
    );
    expect((await boss.patch(`${BASE}/countries/sn`, { isActive: false })).status).toBe(400);
  });
});
