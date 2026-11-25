import { existsSync } from 'node:fs';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type PlatformService,
  type PlatformStatus,
  type PlatformTask,
  type ServiceState,
} from '@opportinities/shared';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { type EnvironmentVariables } from '../config/env.validation';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { StorageService } from '../storage/storage.service';

/** Files des tâches planifiées (noms définis par chaque service de planification). */
const TASK_QUEUES: PlatformTask['key'][] = ['job-offers', 'notifications', 'payments', 'studio'];
const BULL_PREFIX = 'oppo:bull';

async function timed(check: () => Promise<boolean>): Promise<[ServiceState, number]> {
  const start = performance.now();
  const ok = await check().catch(() => false);
  return [ok ? 'up' : 'down', Math.round(performance.now() - start)];
}

/**
 * État de la plateforme pour l'administration : joignabilité des services, configuration des
 * prestataires (oui ou non, jamais la valeur), tâches planifiées et migrations. Lecture seule.
 */
@Injectable()
export class PlatformStatusService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly storage: StorageService,
    private readonly mail: MailService,
  ) {}

  async status(now = new Date()): Promise<PlatformStatus> {
    const [services, tasks, migrations] = await Promise.all([
      this.services(),
      this.tasks(),
      this.migrations(),
    ]);
    return {
      generatedAt: now.toISOString(),
      environment: this.config.get('NODE_ENV', { infer: true }),
      version: process.env.npm_package_version ?? '0.0.0',
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      scheduledTasksEnabled: this.config.get('SCHEDULED_TASKS_ENABLED', { infer: true }),
      services,
      tasks,
      migrations,
    };
  }

  private async services(): Promise<PlatformService[]> {
    const get = <K extends keyof EnvironmentVariables>(key: K) =>
      this.config.get(key, { infer: true });
    const [[database, dbMs], [redis, redisMs], [storage, storageMs], [mail, mailMs]] =
      await Promise.all([
        timed(() => this.prisma.isHealthy()),
        timed(async () => (await this.redis.ping()) === 'PONG'),
        timed(() => this.storage.isReachable()),
        timed(() => this.mail.isReachable()),
      ]);
    const chromium = get('CHROMIUM_EXECUTABLE_PATH');
    return [
      { key: 'database', state: database, latencyMs: dbMs, detail: 'PostgreSQL' },
      { key: 'redis', state: redis, latencyMs: redisMs, detail: null },
      { key: 'storage', state: storage, latencyMs: storageMs, detail: get('S3_BUCKET') },
      // Serveur d'envoi sans identifiants ; l'adresse d'expédition est publique.
      {
        key: 'mail',
        state: mail,
        latencyMs: mailMs,
        detail: `${get('SMTP_HOST')}:${get('SMTP_PORT')}`,
      },
      {
        key: 'payments',
        state:
          get('CHARIOW_API_KEY') && get('CHARIOW_PULSE_SECRET') ? 'configured' : 'not_configured',
        latencyMs: null,
        detail: 'Chariow',
      },
      {
        key: 'ai',
        state: get('OPENAI_API_KEY') ? 'configured' : 'not_configured',
        latencyMs: null,
        detail: get('OPENAI_MODEL') ?? null,
      },
      {
        key: 'pdf',
        state: !chromium ? 'not_configured' : existsSync(chromium) ? 'up' : 'down',
        latencyMs: null,
        detail: 'Chromium',
      },
    ];
  }

  private async tasks(): Promise<PlatformTask[]> {
    return Promise.all(
      TASK_QUEUES.map(async (key): Promise<PlatformTask> => {
        const queue = new Queue(key, { connection: this.redis, prefix: BULL_PREFIX });
        try {
          const [schedulers, counts, [last]] = await Promise.all([
            queue.getJobSchedulers(0, 0),
            queue.getJobCounts('completed', 'failed'),
            queue.getJobs(['completed', 'failed'], 0, 0, false),
          ]);
          const scheduler = schedulers[0];
          return {
            key,
            everyMs: scheduler?.every ? Number(scheduler.every) : null,
            nextRunAt: scheduler?.next ? new Date(scheduler.next).toISOString() : null,
            lastRunAt: last?.finishedOn ? new Date(last.finishedOn).toISOString() : null,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
          };
        } catch {
          return {
            key,
            everyMs: null,
            nextRunAt: null,
            lastRunAt: null,
            completed: 0,
            failed: 0,
          };
        } finally {
          await queue.close().catch(() => undefined);
        }
      }),
    );
  }

  private async migrations(): Promise<PlatformStatus['migrations']> {
    try {
      const rows = await this.prisma.$queryRaw<
        { count: number; latest: string | null; applied_at: Date | null }[]
      >`
        SELECT count(*)::int AS count,
               max(migration_name) AS latest,
               max(finished_at) AS applied_at
          FROM _prisma_migrations
         WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
      const row = rows[0];
      return {
        count: row?.count ?? 0,
        latest: row?.latest ?? null,
        appliedAt: row?.applied_at?.toISOString() ?? null,
      };
    } catch {
      return { count: 0, latest: null, appliedAt: null };
    }
  }
}
