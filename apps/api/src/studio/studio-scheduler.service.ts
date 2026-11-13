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
import { StudioGenerationService } from './studio-generation.service';

const QUEUE_NAME = 'studio';
const SCHEDULER_ID = 'studio-generation-recovery';
const EVERY_MS = 2 * 60_000;

/**
 * Filet de sécurité des générations IA payées : toutes les 2 minutes, une génération restée « en
 * cours » trop longtemps (serveur arrêté pendant l'appel) est passée en échec et remboursée.
 */
@Injectable()
export class StudioSchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(StudioSchedulerService.name);
  private queue?: Queue;
  private worker?: Worker;
  private readonly connections: Redis[] = [];

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly generation: StudioGenerationService,
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
      { name: 'recover', opts: { removeOnComplete: 100, removeOnFail: 500 } },
    );
    this.worker = new Worker(QUEUE_NAME, async () => this.generation.recoverStale(), {
      connection: connection(),
      prefix,
      concurrency: 1,
    });
    this.worker.on('failed', (_job, error) => {
      this.logger.error(`Échec de la reprise des générations IA : ${error.message}`, error.stack);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await Promise.all(this.connections.map((client) => client.quit().catch(() => undefined)));
  }
}
