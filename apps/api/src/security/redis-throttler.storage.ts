import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Compteur atomique à fenêtre fixe, avec blocage temporaire au-delà de la limite.
 * KEYS : compteur, blocage. ARGV : ttl (ms), limite, durée de blocage (ms).
 * Retour : [hits, ttl restant (ms), bloqué (0/1), blocage restant (ms)].
 */
const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', hitsKey) or limit + 1)
  return { hits, redis.call('PTTL', hitsKey), 1, blockTtl }
end

local hits = redis.call('INCR', hitsKey)
if hits == 1 then
  redis.call('PEXPIRE', hitsKey, ttl)
end
local ttlLeft = redis.call('PTTL', hitsKey)

if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  return { hits, ttlLeft, 1, blockDuration }
end
return { hits, ttlLeft, 0, 0 }
`;

const toSeconds = (ms: number): number => Math.max(0, Math.ceil(ms / 1000));

/**
 * Stockage Redis pour @nestjs/throttler : les limites sont partagées entre toutes les instances
 * de l'API. En cas d'indisponibilité de Redis, la requête est laissée passer (journalisée) :
 * le verrouillage des comptes en base continue de protéger la connexion.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const base = `throttle:${throttlerName}:${key}`;
    try {
      const result = (await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        `${base}:hits`,
        `${base}:block`,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];
      const [hits, ttlLeft, blocked, blockLeft] = result;
      return {
        totalHits: hits,
        timeToExpire: toSeconds(ttlLeft),
        isBlocked: blocked === 1,
        timeToBlockExpire: toSeconds(blockLeft),
      };
    } catch (error) {
      this.logger.error(
        `Limitation indisponible (Redis) : ${error instanceof Error ? error.message : String(error)}`,
      );
      return { totalHits: 0, timeToExpire: toSeconds(ttl), isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
