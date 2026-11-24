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
import { NotificationsService } from './notifications.service';

const QUEUE_NAME = 'notifications';
const SCHEDULER_ID = 'notification-emails';
const EVERY_MS = 30_000;

/** Envoi des emails de notification toutes les 30 secondes, par une seule instance à la fois. */
@Injectable()
export class NotificationsSchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsSchedulerService.name);
  private queue?: Queue;
  private worker?: Worker;
  private readonly connections: Redis[] = [];

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly notifications: NotificationsService,
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
      { name: 'dispatch', opts: { removeOnComplete: 100, removeOnFail: 500 } },
    );
    this.worker = new Worker(QUEUE_NAME, async () => this.notifications.dispatch(), {
      connection: connection(),
      prefix,
      concurrency: 1,
    });
    this.worker.on('failed', (_job, error) => {
      this.logger.error(`Échec de l'envoi des notifications : ${error.message}`, error.stack);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await Promise.all(this.connections.map((client) => client.quit().catch(() => undefined)));
  }
}
