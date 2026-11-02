import { createHash } from "node:crypto";
import type { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

const LUA = `
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local state = redis.call('HMGET', KEYS[1], 'tokens', 'updated')
local tokens = tonumber(state[1])
local updated = tonumber(state[2])
if tokens == nil then
  tokens = capacity
  updated = now
end
tokens = math.min(capacity, tokens + math.max(0, now - updated) * rate / 1000)
local allowed = 0
local retry_ms = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
else
  retry_ms = math.ceil((cost - tokens) * 1000 / rate)
end
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'updated', tostring(now))
local ttl = math.ceil(capacity * 1000 / rate) + 1000
redis.call('PEXPIRE', KEYS[1], ttl)
return {allowed, math.floor(tokens), retry_ms}
`;

export type BucketConfig = { capacity: number; refillPerSecond: number; cost?: number };

export function createLimiter(redis: RedisClient, prefix = "semester:rate") {
  return {
    async consume(scope: string, config: BucketConfig) {
      const cost = config.cost ?? 1;
      if (
        !Number.isFinite(config.capacity) || !Number.isFinite(config.refillPerSecond) || !Number.isFinite(cost) ||
        config.capacity <= 0 || config.refillPerSecond <= 0 || cost <= 0 || cost > config.capacity
      ) {
        throw new Error("INVALID_BUCKET_CONFIGURATION");
      }
      const digest = createHash("sha256").update(scope).digest("hex");
      const result = (await redis.eval(LUA, {
        keys: [`${prefix}:${digest}`],
        arguments: [String(config.capacity), String(config.refillPerSecond), String(cost)],
      })) as number[];
      return { allowed: result[0] === 1, remaining: result[1], retryAfterMs: result[2] };
    },
  };
}
