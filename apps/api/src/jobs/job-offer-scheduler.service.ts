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
import { JobOfferLifecycleService } from './job-offer-lifecycle.service';

const QUEUE_NAME = 'job-offers';
/** Identifiant fixe : une seule planification existe, quel que soit le nombre d'instances. */
const SCHEDULER_ID = 'job-offer-lifecycle';
const EVERY_MS = 60_000;

/**
 * Planification du cycle de vie des offres avec BullMQ (cahier des charges §7.6) : une tâche
 * répétée chaque minute, exécutée une seule fois même si plusieurs instances tournent (BullMQ
 * attribue chaque exécution à un seul worker, et le traitement lui-même est idempotent).
 * Désactivable par SCHEDULED_TASKS_ENABLED=false (tests, instance API sans worker).
 */
@Injectable()
export class JobOfferSchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobOfferSchedulerService.name);
  private queue?: Queue;
  private worker?: Worker;
  private readonly connections: Redis[] = [];

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly lifecycle: JobOfferLifecycleService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('SCHEDULED_TASKS_ENABLED', { infer: true })) return;

    const url = this.config.get('REDIS_URL', { infer: true });
    // Connexions dédiées : BullMQ exige maxRetriesPerRequest = null pour ses commandes bloquantes.
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
      {
        name: 'lifecycle',
        opts: { removeOnComplete: 100, removeOnFail: 500 },
      },
    );
    this.worker = new Worker(QUEUE_NAME, async () => this.lifecycle.run(new Date()), {
      connection: connection(),
      prefix,
      concurrency: 1,
    });
    this.worker.on('failed', (_job, error) => {
      this.logger.error(`Échec du cycle de vie des offres : ${error.message}`, error.stack);
    });
    this.logger.log('Cycle de vie des offres planifié (chaque minute).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await Promise.all(this.connections.map((client) => client.quit().catch(() => undefined)));
  }
}
