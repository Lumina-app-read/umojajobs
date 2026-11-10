import { type INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

export const APP_ORIGIN = 'http://localhost:3000';

/**
 * Client HTTP de test qui se comporte comme le navigateur de l'application : il conserve les
 * cookies, récupère le jeton CSRF et envoie l'en-tête X-CSRF-Token et l'origine attendue.
 */
export class ApiClient {
  readonly agent: TestAgent;
  private csrfToken = '';

  constructor(app: INestApplication) {
    this.agent = request.agent(app.getHttpServer() as Parameters<typeof request.agent>[0]);
  }

  async init(): Promise<this> {
    const response = await this.agent.get('/api/v1/auth/csrf').expect(200);
    this.csrfToken = (response.body as { csrfToken: string }).csrfToken;
    return this;
  }

  get(path: string): Promise<Response> {
    return this.agent.get(path).then((response) => response);
  }

  post(path: string, body: object = {}): Promise<Response> {
    return this.withCsrf(this.agent.post(path).send(body));
  }

  patch(path: string, body: object = {}): Promise<Response> {
    return this.withCsrf(this.agent.patch(path).send(body));
  }

  delete(path: string): Promise<Response> {
    return this.withCsrf(this.agent.delete(path));
  }

  /** Après connexion, le serveur renouvelle le jeton CSRF : on suit la nouvelle valeur. */
  adoptCsrfToken(response: Response): void {
    const token = (response.body as { csrfToken?: string }).csrfToken;
    if (token) this.csrfToken = token;
  }

  private withCsrf(test: request.Test): Promise<Response> {
    return test
      .set('Origin', APP_ORIGIN)
      .set('X-CSRF-Token', this.csrfToken)
      .then((response) => response);
  }
}

let counter = 0;

/** Adresse email unique par test. */
export function uniqueEmail(prefix = 'user'): string {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@example.test`;
}

export const STRONG_PASSWORD = 'le baobab de Thiès fleurit en mai';
export const OTHER_STRONG_PASSWORD = 'la pirogue file vers Gorée au matin';

export function registrationPayload(email: string, overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Awa',
    lastName: 'Diallo',
    email,
    countryIso2: 'SN',
    password: STRONG_PASSWORD,
    passwordConfirmation: STRONG_PASSWORD,
    acceptTerms: true,
    ...overrides,
  };
}
