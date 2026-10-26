import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "redis";
import { createLimiter } from "../src/limiter";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Redis token bucket", () => {
  // Two separate connections stand in for two API instances.
  const redisA = createClient({ url: process.env.TEST_REDIS_URL, disableOfflineQueue: true });
  const redisB = createClient({ url: process.env.TEST_REDIS_URL, disableOfflineQueue: true });
  const prefix = `semester:test:${randomUUID()}`;
  const limiterA = createLimiter(redisA, prefix);
  const limiterB = createLimiter(redisB, prefix);

  beforeAll(async () => { await redisA.connect(); await redisB.connect(); });
  afterAll(async () => { await redisA.quit(); await redisB.quit(); });

  it("allows the configured initial burst", async () => {
    const scope = randomUUID();
    const config = { capacity: 3, refillPerSecond: 0.001 };
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiterA.consume(scope, config));
    expect(results.map((x) => x.allowed)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterMs).toBeGreaterThan(0);
  });

  it("shares one budget across limiter instances", async () => {
    const scope = randomUUID();
    const config = { capacity: 5, refillPerSecond: 0.001 };
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => (i % 2 ? limiterA : limiterB).consume(scope, config))
    );
    expect(results.filter((x) => x.allowed)).toHaveLength(5);
  });

  it("refills after enough elapsed time", async () => {
    const scope = randomUUID();
    const config = { capacity: 1, refillPerSecond: 10 };
    expect((await limiterA.consume(scope, config)).allowed).toBe(true);
    expect((await limiterA.consume(scope, config)).allowed).toBe(false);
    await sleep(200);
    expect((await limiterA.consume(scope, config)).allowed).toBe(true);
  });

  it("isolates separate scopes", async () => {
    const config = { capacity: 1, refillPerSecond: 0.001 };
    const a = randomUUID();
    const b = randomUUID();
    await limiterA.consume(a, config);
    expect((await limiterA.consume(a, config)).allowed).toBe(false);
    expect((await limiterA.consume(b, config)).allowed).toBe(true);
  });

  it("sets an expiry on idle buckets", async () => {
    const scope = randomUUID();
    await limiterA.consume(scope, { capacity: 2, refillPerSecond: 1 });
    const { createHash } = await import("node:crypto");
    const key = `${prefix}:${createHash("sha256").update(scope).digest("hex")}`;
    const ttl = await redisA.pTTL(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3000);
  });

  it("rejects invalid bucket configuration", async () => {
    await expect(limiterA.consume("x", { capacity: 1, refillPerSecond: 1, cost: 2 })).rejects.toThrow("INVALID_BUCKET_CONFIGURATION");
    await expect(limiterA.consume("x", { capacity: 0, refillPerSecond: 1 })).rejects.toThrow("INVALID_BUCKET_CONFIGURATION");
  });
});
