import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import {
  AFRICAN_COUNTRIES,
  type AdminCreditPackResponse,
  type CreditCheckoutResponse,
  type CreditOrderResponse,
  type CreditPackInput,
  type CreditPackResponse,
  ERROR_CODES,
  PHONE_E164,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { type ClientInfo } from '../common/http/app-request';
import { type EnvironmentVariables } from '../config/env.validation';
import { FinancialSettingsService } from '../finance/financial-settings.service';
import { LEDGER_ACCOUNTS, LedgerService } from '../finance/ledger.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventsService } from '../security-events/security-events.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { ChariowClient, type ChariowSale } from './chariow.client';

type Tx = Prisma.TransactionClient;

const CHARIOW_RECEIVABLE = { code: 'chariow_receivable', type: 'asset' as const };
const CHARIOW_WALLET = { code: 'chariow_wallet', type: 'asset' as const };
const PAYMENT_FEES = { code: 'payment_processing_fees', type: 'expense' as const };
const PAID_STATUSES = new Set(['completed', 'settled']);
/** Identifiant de vente Chariow : « SALE… » en production, « sal_… » dans la documentation. */
const SALE_ID = /^[A-Za-z0-9_-]{6,100}$/;

const toPack = (pack: {
  id: string;
  sku: string;
  name: string;
  credits: number;
  priceUsd: Prisma.Decimal;
}): CreditPackResponse => ({
  id: pack.id,
  sku: pack.sku,
  name: pack.name,
  credits: pack.credits,
  priceUsd: pack.priceUsd.toFixed(2),
});

const toOrder = (order: {
  reference: string;
  status: CreditOrderResponse['status'];
  credits: number;
  priceUsd: Prisma.Decimal;
  createdAt: Date;
  paidAt: Date | null;
}): CreditOrderResponse => ({
  reference: order.reference,
  status: order.status,
  credits: order.credits,
  priceUsd: order.priceUsd.toFixed(2),
  createdAt: order.createdAt.toISOString(),
  paidAt: order.paidAt?.toISOString() ?? null,
});

/** Montant Chariow éventuellement imbriqué ({ value, currency }) ou nombre simple. */
const amountOf = (value: { value: number } | number | null | undefined): Prisma.Decimal | null =>
  value === null || value === undefined
    ? null
    : new Prisma.Decimal(typeof value === 'number' ? value : value.value);

/**
 * Recharges de crédits payées par Chariow (correction du modèle économique §3).
 * Le retour du navigateur ne crédite jamais rien : seule la relecture de la vente chez Chariow,
 * déclenchée par une Pulse signée ou par la réconciliation, attribue les crédits — une seule fois,
 * garanti par les contraintes d'unicité en base.
 */
@Injectable()
export class CreditPurchasesService {
  private readonly logger = new Logger(CreditPurchasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chariow: ChariowClient,
    private readonly settings: FinancialSettingsService,
    private readonly ledger: LedgerService,
    private readonly securityEvents: SecurityEventsService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // --- Packs -----------------------------------------------------------------------------------

  /** Packs en vente : actifs, reliés à un produit Chariow, paiement configuré. */
  async packs(): Promise<CreditPackResponse[]> {
    if (!this.chariow.enabled) return [];
    const rows = await this.prisma.creditPack.findMany({
      where: { isActive: true, chariowProductId: { not: null } },
      orderBy: [{ sortOrder: 'asc' }, { priceUsd: 'asc' }],
    });
    return rows.map(toPack);
  }

  async adminPacks(): Promise<AdminCreditPackResponse[]> {
    const rows = await this.prisma.creditPack.findMany({
      orderBy: [{ sortOrder: 'asc' }, { priceUsd: 'asc' }],
    });
    return rows.map((row) => ({
      ...toPack(row),
      chariowProductId: row.chariowProductId,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    }));
  }

  /**
   * Création ou modification d'un pack. Le prix doit valoir exactement crédits × valeur d'un
   * crédit (pas de bonus au lancement, arbitrage A2) : la dette envers l'acheteur égale l'encaissement.
   */
  async savePack(
    auth: AuthContext,
    id: string | null,
    input: CreditPackInput,
    client: ClientInfo,
  ): Promise<AdminCreditPackResponse[]> {
    const unitValue = await this.settings.require('credit_unit_value_usd');
    const price = new Prisma.Decimal(input.priceUsd);
    if (!unitValue.mul(input.credits).eq(price)) {
      throw new BadRequestException({ code: ERROR_CODES.CREDIT_PACK_INVALID });
    }
    const data = {
      sku: input.sku,
      name: input.name,
      credits: input.credits,
      priceUsd: price,
      chariowProductId: input.chariowProductId,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    };
    try {
      if (id) await this.prisma.creditPack.update({ where: { id }, data });
      else await this.prisma.creditPack.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException({ code: ERROR_CODES.CREDIT_PACK_NOT_FOUND });
        }
        if (error.code === 'P2002') {
          throw new ConflictException({ code: ERROR_CODES.CREDIT_PACK_INVALID });
        }
      }
      throw error;
    }
    await this.securityEvents.record({
      type: 'credit_pack_changed',
      userId: auth.user.id,
      client,
      metadata: { sku: input.sku, credits: input.credits, priceUsd: price.toFixed(2) },
    });
    return this.adminPacks();
  }

  // --- Commandes -------------------------------------------------------------------------------

  async checkout(
    auth: AuthContext,
    input: { packId: string; phone?: string },
    locale: 'fr' | 'en',
  ): Promise<CreditCheckoutResponse> {
    if (!this.chariow.enabled) {
      throw new ServiceUnavailableException({ code: ERROR_CODES.PAYMENTS_UNAVAILABLE });
    }
    const pack = await this.prisma.creditPack.findFirst({
      where: { id: input.packId, isActive: true, chariowProductId: { not: null } },
    });
    if (!pack?.chariowProductId) {
      throw new NotFoundException({ code: ERROR_CODES.CREDIT_PACK_NOT_FOUND });
    }
    const phone = (input.phone ?? auth.user.phoneE164 ?? '').replace(/[\s.()-]/g, '');
    if (!PHONE_E164.test(phone)) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.PHONE_REQUIRED });
    }

    const unitValue = await this.settings.require('credit_unit_value_usd');
    // La valeur d'un crédit a pu changer depuis la création du pack : il doit être remis à jour.
    if (!unitValue.mul(pack.credits).eq(pack.priceUsd)) {
      throw new ServiceUnavailableException({ code: ERROR_CODES.CREDIT_PACK_INVALID });
    }
    const reference = `CR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const order = await this.prisma.creditOrder.create({
      data: {
        reference,
        userId: auth.user.id,
        packId: pack.id,
        credits: pack.credits,
        priceUsd: pack.priceUsd,
        creditUnitValueUsd: unitValue,
        chariowProductId: pack.chariowProductId,
      },
    });

    const appUrl = this.config.get('APP_URL', { infer: true }).replace(/\/$/, '');
    const result = await this.chariow
      .checkout({
        product_id: pack.chariowProductId,
        email: auth.user.email,
        first_name: auth.user.firstName,
        last_name: auth.user.lastName,
        phone: splitPhone(phone, auth.user.countryIso2),
        redirect_url: `${appUrl}/${locale}/dashboard/credits?order=${reference}`,
        custom_metadata: { order_ref: reference },
      })
      .catch(async (error: unknown) => {
        await this.fail(order.id, 'Ouverture du paiement impossible');
        throw error;
      });

    const saleId = result.purchase?.id ?? null;
    const url = result.payment?.checkout_url ?? null;
    if (result.step !== 'payment' || !saleId || !url) {
      // « already_purchased » signalerait un produit qui n'est pas de type License.
      this.logger.error(`Chariow : étape inattendue « ${result.step} » pour ${reference}`);
      await this.fail(order.id, `Étape Chariow inattendue : ${result.step}`);
      throw new ServiceUnavailableException({ code: ERROR_CODES.PAYMENT_PROVIDER_ERROR });
    }
    await this.prisma.creditOrder.update({
      where: { id: order.id },
      data: { providerSaleId: saleId, checkoutUrl: url },
    });
    return { reference, checkoutUrl: url };
  }

  /** État d'une commande : la page de retour l'interroge, elle ne crédite jamais rien. */
  async order(userId: string, reference: string): Promise<CreditOrderResponse> {
    const order = await this.prisma.creditOrder.findFirst({ where: { reference, userId } });
    if (!order) throw new NotFoundException({ code: ERROR_CODES.CREDIT_ORDER_NOT_FOUND });
    if (order.status !== 'pending' || !order.providerSaleId) return toOrder(order);

    // Pendant que la page de retour attend, la vente est relue chez Chariow (au plus toutes les
    // 5 secondes par commande) : les crédits arrivent sans attendre la Pulse ni la réconciliation.
    // C'est toujours la vente confirmée par Chariow qui fait foi, jamais le retour du navigateur.
    const throttle = await this.redis.set(`credit-order-check:${order.id}`, '1', 'EX', 5, 'NX');
    if (throttle === 'OK') {
      await this.confirmSale(order.providerSaleId).catch((error: Error) =>
        this.logger.warn(`Vérification de ${reference} : ${error.message}`),
      );
    }
    const fresh = await this.prisma.creditOrder.findUniqueOrThrow({ where: { id: order.id } });
    return toOrder(fresh);
  }

  async orders(userId: string): Promise<CreditOrderResponse[]> {
    const rows = await this.prisma.creditOrder.findMany({
      where: { userId, status: { in: ['pending', 'paid'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map(toOrder);
  }

  // --- Notifications (Pulses) ------------------------------------------------------------------

  /**
   * Pulse reçue : signature vérifiée sur le corps brut, enregistrement dédoublonné par
   * x-pulse-delivery-id, puis traitement asynchrone (la réponse part immédiatement).
   * Retourne false si la signature est invalide (réponse 401, rien n'est traité).
   */
  async receivePulse(
    rawBody: Buffer,
    headers: { signature?: string; deliveryId?: string; event?: string },
  ): Promise<boolean> {
    const signatureValid = this.chariow.verifySignature(rawBody, headers.signature);
    let payload: Prisma.InputJsonValue = {};
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as Prisma.InputJsonValue;
    } catch {
      payload = { unparsable: true };
    }
    const saleId = extractSaleId(payload);
    const deliveryId =
      headers.deliveryId?.slice(0, 100) || `missing:${randomBytes(8).toString('hex')}`;
    try {
      const event = await this.prisma.paymentEvent.create({
        data: {
          provider: 'chariow',
          deliveryId,
          eventType: (headers.event ?? 'unknown').slice(0, 60),
          signatureValid,
          payload,
          saleId,
          ...(signatureValid ? {} : { error: 'Signature invalide', processedAt: new Date() }),
        },
      });
      if (signatureValid) setImmediate(() => void this.processEvent(event.id));
    } catch (error) {
      // Même livraison reçue à nouveau (nouvelle tentative de Chariow) : déjà enregistrée.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }
    return signatureValid;
  }

  async processEvent(eventId: string): Promise<void> {
    const event = await this.prisma.paymentEvent.findUnique({ where: { id: eventId } });
    if (!event || event.processedAt || !event.signatureValid) return;
    let error: string | null = null;
    try {
      let saleId = event.saleId;
      if (!saleId) {
        const reference = extractOrderRef(event.payload);
        const order = reference
          ? await this.prisma.creditOrder.findUnique({ where: { reference } })
          : null;
        saleId = order?.providerSaleId ?? null;
      }
      if (saleId) await this.confirmSale(saleId);
      else error = 'Vente non identifiée dans la notification';
    } catch (caught) {
      error = (caught as Error).message.slice(0, 500);
    }
    await this.prisma.paymentEvent.update({
      where: { id: eventId },
      data: { processedAt: error ? null : new Date(), error },
    });
  }

  /**
   * Confirmation serveur : la vente est relue chez Chariow puis comparée à la commande
   * (produit, montant, devise). Toute incohérence place la commande en anomalie, sans crédit.
   */
  async confirmSale(saleId: string): Promise<void> {
    const order = await this.prisma.creditOrder.findUnique({ where: { providerSaleId: saleId } });
    if (!order) throw new Error(`Vente ${saleId} sans commande correspondante`);
    if (order.status === 'paid') {
      await this.syncSettlement(saleId);
      return;
    }
    const sale = await this.chariow.sale(saleId);
    if (!PAID_STATUSES.has(sale.status)) {
      if (sale.status === 'failed' || sale.status === 'abandoned') {
        await this.prisma.creditOrder.updateMany({
          where: { id: order.id, status: 'pending' },
          data: { status: sale.status },
        });
      }
      return;
    }
    const problem = mismatch(order, sale);
    if (problem) {
      this.logger.error(`Anomalie de paiement ${order.reference} : ${problem}`);
      await this.prisma.creditOrder.updateMany({
        where: { id: order.id, status: { not: 'paid' } },
        data: { status: 'anomaly', failureReason: problem },
      });
      return;
    }
    await this.attribute(order.id, sale);
  }

  /** Attribution des crédits, dans une seule transaction protégée par l'unicité en base. */
  private async attribute(orderId: string, sale: ChariowSale): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const moved = await tx.creditOrder.updateMany({
          where: { id: orderId, status: { in: ['pending', 'failed', 'abandoned'] } },
          data: { status: 'paid', paidAt: new Date() },
        });
        if (moved.count === 0) return; // déjà traitée par une autre exécution
        const order = await tx.creditOrder.findUniqueOrThrow({ where: { id: orderId } });
        const payment = await tx.payment.create({
          data: {
            orderId,
            provider: 'chariow',
            providerSaleId: sale.id,
            amountUsd: order.priceUsd,
            currency: sale.amount?.currency ?? 'USD',
            saleStatus: sale.status,
            rawSnapshot: sale as unknown as Prisma.InputJsonValue,
          },
        });
        await this.grantPurchasedCredits(tx, order, payment.id, sale.id);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
    await this.syncSettlement(sale.id).catch(() => undefined);
  }

  private async grantPurchasedCredits(
    tx: Tx,
    order: {
      id: string;
      userId: string;
      credits: number;
      creditUnitValueUsd: Prisma.Decimal;
      priceUsd: Prisma.Decimal;
    },
    paymentId: string,
    saleId: string,
  ): Promise<void> {
    await tx.creditAccount.upsert({
      where: { userId: order.userId },
      create: { userId: order.userId },
      update: {},
    });
    const rows = await tx.$queryRaw<{ id: string; balance: number }[]>`
      SELECT "id", "balance" FROM "credit_accounts" WHERE "user_id" = ${order.userId}::uuid FOR UPDATE`;
    const account = rows[0];
    if (!account) throw new Error('Compte de crédits introuvable');
    const balance = account.balance + order.credits;
    const value = order.creditUnitValueUsd.mul(order.credits);
    const movement = await tx.creditMovement.create({
      data: {
        accountId: account.id,
        type: 'purchase',
        quantity: order.credits,
        balanceAfter: balance,
        idempotencyKey: `purchase:${saleId}`,
        referenceType: 'credit_order',
        referenceId: order.id,
      },
    });
    const lot = await tx.creditLot.create({
      data: {
        accountId: account.id,
        origin: 'purchase',
        creditsTotal: order.credits,
        creditsRemaining: order.credits,
        creditUnitValueUsd: order.creditUnitValueUsd,
        commissionable: true,
        paymentId,
      },
    });
    await tx.creditLotAllocation.create({
      data: { movementId: movement.id, lotId: lot.id, credits: order.credits, valueUsd: value },
    });
    await tx.creditAccount.update({ where: { id: account.id }, data: { balance } });
    // Recharge confirmée : créance sur Chariow, dette envers l'utilisateur (valeur des crédits).
    await this.ledger.post(tx, {
      type: 'credit_purchase',
      idempotencyKey: `purchase:${saleId}`,
      referenceType: 'credit_order',
      referenceId: order.id,
      lines: [
        { account: CHARIOW_RECEIVABLE, debit: order.priceUsd },
        { account: LEDGER_ACCOUNTS.customerCredits, credit: value },
      ],
    });
  }

  /**
   * Règlement Chariow (fonds versés, frais connus) : mis à jour par relecture de la vente.
   * Écriture : frais en charge, net sur le portefeuille Chariow, créance soldée.
   */
  async syncSettlement(saleId: string): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { provider: 'chariow', providerSaleId: saleId },
    });
    if (!payment || payment.settlementDoneAt) return;
    const sale = await this.chariow.sale(saleId);
    const net = amountOf(sale.settlement?.amount);
    const fee = amountOf(sale.settlement?.service_fee);
    const doneAt = sale.settlement?.done_at ? new Date(sale.settlement.done_at) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          saleStatus: sale.status,
          settlementAmount: net,
          serviceFee: fee,
          settlementDueAt: sale.settlement?.due_at ? new Date(sale.settlement.due_at) : null,
          settlementDoneAt: doneAt,
          rawSnapshot: sale as unknown as Prisma.InputJsonValue,
        },
      });
      // Chariow retient plus que ses frais de service affichés (ex. : net 0,85 et frais 0,07 sur
      // 1,00) : tout ce qui n'est pas versé est comptabilisé comme coût de paiement.
      if (doneAt && net && net.gt(0) && net.lte(payment.amountUsd)) {
        const cost = payment.amountUsd.sub(net);
        await this.ledger.post(tx, {
          type: 'payment_settlement',
          idempotencyKey: `settlement:${saleId}`,
          referenceType: 'payment',
          referenceId: payment.id,
          reason: `Net ${net.toFixed(2)}, frais de service ${fee?.toFixed(2) ?? '?'}, coût total ${cost.toFixed(2)}`,
          lines: [
            ...(cost.gt(0) ? [{ account: PAYMENT_FEES, debit: cost }] : []),
            { account: CHARIOW_WALLET, debit: net },
            { account: CHARIOW_RECEIVABLE, credit: payment.amountUsd },
          ],
        });
      } else if (doneAt) {
        this.logger.warn(`Règlement ${saleId} : montant net absent ou incohérent, à vérifier`);
      }
    });
  }

  private fail(orderId: string, reason: string) {
    return this.prisma.creditOrder.updateMany({
      where: { id: orderId, status: 'pending' },
      data: { status: 'failed', failureReason: reason },
    });
  }
}

/** Contrôles de cohérence avant attribution (correction du modèle économique §3, étape 4). */
function mismatch(
  order: { chariowProductId: string; priceUsd: Prisma.Decimal },
  sale: ChariowSale,
): string | null {
  if (sale.product?.id !== order.chariowProductId) return 'Produit différent de la commande';
  if (!sale.amount) return 'Montant absent de la vente';
  if (sale.amount.currency !== 'USD') return `Devise ${sale.amount.currency} au lieu de USD`;
  if (!new Prisma.Decimal(sale.amount.value).eq(order.priceUsd)) {
    return `Montant ${sale.amount.value} au lieu de ${order.priceUsd.toFixed(2)}`;
  }
  if (sale.is_access_revoked) return 'Accès révoqué (remboursement probable)';
  return null;
}

/** Identifiant de vente dans une Pulse : la documentation montre plusieurs formes. */
export function extractSaleId(payload: unknown): string | null {
  const read = (value: unknown, ...path: string[]): unknown =>
    path.reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
      value,
    );
  const candidates = [
    read(payload, 'sale', 'id'),
    read(payload, 'data', 'sale', 'id'),
    read(payload, 'data', 'id'),
  ];
  const found = candidates.find((value) => typeof value === 'string' && SALE_ID.test(value));
  return typeof found === 'string' ? found : null;
}

/** Référence de commande transmise dans custom_metadata (repli si la vente n'est pas identifiée). */
export function extractOrderRef(payload: unknown): string | null {
  const read = (value: unknown, ...path: string[]): unknown =>
    path.reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
      value,
    );
  const candidates = [
    read(payload, 'custom_metadata', 'order_ref'),
    read(payload, 'sale', 'custom_metadata', 'order_ref'),
    read(payload, 'data', 'custom_metadata', 'order_ref'),
  ];
  const found = candidates.find(
    (value) => typeof value === 'string' && /^CR-\d{8}-[0-9A-F]{8}$/.test(value),
  );
  return typeof found === 'string' ? found : null;
}

/** Téléphone au format attendu par Chariow : chiffres nationaux et pays ISO alpha-2. */
function splitPhone(e164: string, fallbackIso2: string): { number: string; country_code: string } {
  const country =
    AFRICAN_COUNTRIES.filter((entry) => e164.startsWith(entry.dialCode)).sort(
      (a, b) => b.dialCode.length - a.dialCode.length,
    )[0] ?? null;
  if (!country) return { number: e164.replace(/\D/g, ''), country_code: fallbackIso2 };
  return { number: e164.slice(country.dialCode.length), country_code: country.iso2 };
}
