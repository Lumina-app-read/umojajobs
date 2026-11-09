import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

describe('API — santé (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health renvoie 200 et le statut ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /api/v1/health/ready confirme que PostgreSQL et Redis répondent', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'up', redis: 'up' });
  });

  it('applique les en-têtes de sécurité et masque X-Powered-By', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('attribue un identifiant de requête, ou conserve celui du proxy s’il est valide', async () => {
    const generated = await request(app.getHttpServer()).get('/api/v1/health');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const forwarded = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'nginx-req-12345678');
    expect(forwarded.headers['x-request-id']).toBe('nginx-req-12345678');
    const invalid = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', '<script>');
    expect(invalid.headers['x-request-id']).not.toBe('<script>');
  });

  it('refuse une route non versionnée', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(404);
  });

  it("n'expose pas Swagger lorsque la documentation est désactivée", async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(404);
  });
});
