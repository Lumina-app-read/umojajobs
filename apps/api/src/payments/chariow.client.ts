import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@opportinities/shared';
import { type EnvironmentVariables } from '../config/env.validation';

const TIMEOUT_MS = 15_000;

/** Montant tel que renvoyé par Chariow (guide Sales). */
export interface ChariowAmount {
  value: number;
  currency: string;
}

/** Vente Chariow : seuls les champs utilisés sont typés (guide Sales, GET /v1/sales/{id}). */
export interface ChariowSale {
  id: string;
  status: 'initiated' | 'awaiting_payment' | 'completed' | 'failed' | 'abandoned' | 'settled';
  amount: ChariowAmount | null;
  product: { id: string } | null;
  settlement: {
    amount: ChariowAmount | number | null;
    service_fee: ChariowAmount | number | null;
    due_at: string | null;
    done_at: string | null;
  } | null;
  is_access_revoked?: boolean;
}

export interface ChariowCheckoutRequest {
  product_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: { number: string; country_code: string };
  redirect_url: string;
  custom_metadata: Record<string, string>;
}

/** Réponse de POST /v1/checkout (guide Paiement). */
export interface ChariowCheckoutResult {
  /** « payment », « completed » ou « already_purchased » ; toute autre valeur est refusée. */
  step: string;
  message: string | null;
  purchase: { id: string; status: string } | null;
  payment: { checkout_url: string | null } | null;
}

/**
 * Client de l'API Chariow, limité aux appels documentés : ouverture d'un paiement
 * (POST /v1/checkout) et lecture d'une vente (GET /v1/sales/{id}). Authentification Bearer.
 * La clé n'est jamais journalisée.
 */
@Injectable()
export class ChariowClient {
  private readonly logger = new Logger(ChariowClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly pulseSecret: string | undefined;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.baseUrl = config.get('CHARIOW_API_BASE_URL', { infer: true }).replace(/\/$/, '');
    this.apiKey = config.get('CHARIOW_API_KEY', { infer: true }) || undefined;
    this.pulseSecret = config.get('CHARIOW_PULSE_SECRET', { infer: true }) || undefined;
  }

  /** Paiement possible : clé API configurée. */
  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  async checkout(request: ChariowCheckoutRequest): Promise<ChariowCheckoutResult> {
    const body = await this.call<{ data: ChariowCheckoutResult }>('POST', '/checkout', request);
    return body.data;
  }

  async sale(saleId: string): Promise<ChariowSale> {
    const body = await this.call<{ data: ChariowSale }>(
      'GET',
      `/sales/${encodeURIComponent(saleId)}`,
    );
    return body.data;
  }

  /**
   * Vérifie la signature d'une Pulse : HMAC-SHA256 du corps brut avec le secret de la Pulse,
   * en-tête « x-chariow-signature: sha256=<hex> », comparaison à temps constant.
   */
  verifySignature(rawBody: Buffer, header: string | undefined): boolean {
    if (!this.pulseSecret || !header?.startsWith('sha256=')) return false;
    const received = Buffer.from(header.slice('sha256='.length), 'hex');
    const expected = createHmac('sha256', this.pulseSecret).update(rawBody).digest();
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException({ code: ERROR_CODES.PAYMENTS_UNAVAILABLE });
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`Chariow injoignable (${method} ${path}) : ${(error as Error).message}`);
      throw new ServiceUnavailableException({ code: ERROR_CODES.PAYMENT_PROVIDER_ERROR });
    }
    if (!response.ok) {
      const text = (await response.text()).slice(0, 300);
      this.logger.warn(`Chariow ${method} ${path} : HTTP ${response.status} ${text}`);
      throw new ServiceUnavailableException({ code: ERROR_CODES.PAYMENT_PROVIDER_ERROR });
    }
    return (await response.json()) as T;
  }
}
