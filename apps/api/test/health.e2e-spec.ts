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

  it('GET /api/v1/health/ready confirme que la base répond', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('applique les en-têtes de sécurité et masque X-Powered-By', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('refuse une route non versionnée', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(404);
  });

  it("n'expose pas Swagger lorsque la documentation est désactivée", async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(404);
  });
});
