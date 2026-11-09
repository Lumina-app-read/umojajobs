import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  async function createController(databaseHealthy: boolean): Promise<HealthController> {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { isHealthy: () => Promise.resolve(databaseHealthy) } },
      ],
    }).compile();
    return moduleRef.get(HealthController);
  }

  it('renvoie le statut ok (vivacité)', async () => {
    expect((await createController(false)).check()).toEqual({ status: 'ok' });
  });

  it('signale la base disponible', async () => {
    await expect((await createController(true)).ready()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('renvoie 503 si la base est injoignable', async () => {
    await expect((await createController(false)).ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
