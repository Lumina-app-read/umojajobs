import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  async function createController(
    databaseUp: boolean,
    redisUp: boolean,
  ): Promise<HealthController> {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { isHealthy: () => Promise.resolve(databaseUp) } },
        {
          provide: REDIS_CLIENT,
          useValue: {
            ping: () => (redisUp ? Promise.resolve('PONG') : Promise.reject(new Error('down'))),
          },
        },
      ],
    }).compile();
    return moduleRef.get(HealthController);
  }

  it('renvoie le statut ok (vivacité), même si les dépendances sont indisponibles', async () => {
    expect((await createController(false, false)).check()).toEqual({ status: 'ok' });
  });

  it('signale PostgreSQL et Redis disponibles', async () => {
    await expect((await createController(true, true)).ready()).resolves.toEqual({
      status: 'ok',
      database: 'up',
      redis: 'up',
    });
  });

  it.each([
    [false, true],
    [true, false],
  ])('renvoie 503 si une dépendance est injoignable (base %s, redis %s)', async (db, redis) => {
    await expect((await createController(db, redis)).ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
