import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { type EnvironmentVariables } from '../config/env.validation';
import { PaymentReconciliationService } from './payment-reconciliation.service';

const QUEUE_NAME = 'payments';
const SCHEDULER_ID = 'payment-reconciliation';
const EVERY_MS = 5 * 60_000;

/** Réconciliation des paiements et libération des commissions, toutes les 5 minutes (BullMQ). */
@Injectable()
export class PaymentSchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PaymentSchedulerService.name);
  private queue?: Queue;
  private worker?: Worker;
  private readonly connections: Redis[] = [];

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly reconciliation: PaymentReconciliationService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('SCHEDULED_TASKS_ENABLED', { infer: true })) return;
    const url = this.config.get('REDIS_URL', { infer: true });
    const connection = () => {
      const client = new Redis(url, { maxRetriesPerRequest: null });
      this.connections.push(client);
      return client;
    };
    const prefix = 'oppo:bull';
    this.queue = new Queue(QUEUE_NAME, { connection: connection(), prefix });
    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { every: EVERY_MS },
      { name: 'reconcile', opts: { removeOnComplete: 100, removeOnFail: 500 } },
    );
    this.worker = new Worker(QUEUE_NAME, async () => this.reconciliation.run(new Date()), {
      connection: connection(),
      prefix,
      concurrency: 1,
    });
    this.worker.on('failed', (_job, error) => {
      this.logger.error(`Échec de la réconciliation des paiements : ${error.message}`, error.stack);
    });
    this.logger.log('Réconciliation des paiements planifiée (toutes les 5 minutes).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await Promise.all(this.connections.map((client) => client.quit().catch(() => undefined)));
  }
}
