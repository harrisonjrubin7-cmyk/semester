// Load test: the real route, two API instances sharing one Redis and one Postgres, synthetic data only.
// Usage: tsx bench/load.ts <pgSocket> <pgPort> <redisUrl> <phase: steady|restart>
import { createServer } from "node:http";
import { exec } from "node:child_process";
import pg from "pg";
const { Pool } = pg; // pg is CommonJS: named ESM import fails under plain Node
import { createClient } from "redis";
import { generateKeyPair, SignJWT } from "jose";
import { createApp } from "../src/app";
import { createLimiter } from "../src/limiter";

const [host, portStr, redisUrl, phase] = process.argv.slice(2);
const TENANT = "a0000000-0000-0000-0000-00000000000a";
const WS = "00000000-0000-0000-0000-0000000000a1";
const ALICE = "00000000-0000-0000-0000-000000000001";
const ALEX = "00000000-0000-0000-0000-000000000002";

const keys = await generateKeyPair("RS256");
const auth = { key: keys.publicKey, issuer: "https://test-issuer.example", audience: "semester-api", algorithms: ["RS256"], maxTokenAge: "20m" };

async function instance(port: number) {
  const redis = createClient({ url: redisUrl, disableOfflineQueue: true, socket: { reconnectStrategy: () => 200 } });
  redis.on("error", () => {});
  await redis.connect();
  const pool = new Pool({ host, port: Number(portStr), database: "semester_rls_test", user: "semester_runtime_login", max: 10 });
  // Fresh prefix per run so earlier runs do not drain this run's budget.
  const app = createApp({ pool, auth, limiter: createLimiter(redis, `bench:${process.pid}`) });
  const server = createServer(app).listen(port);
  return { redis, pool, server };
}
const a = await instance(7101);
const b = await instance(7102);

const now = Math.floor(Date.now() / 1000);
const token = (sub: string) => new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "RS256" }).setSubject(sub)
  .setIssuer(auth.issuer).setAudience(auth.audience).setIssuedAt(now).setExpirationTime(now + 600).sign(keys.privateKey);
const tok = { [ALICE]: await token(ALICE), [ALEX]: await token(ALEX) };

type R = { status: number; ms: number; t: number };
const results: R[] = [];
const t0 = performance.now();
const durationMs = phase === "restart" ? 9000 : 6000;
const CONCURRENCY = 32;
let i = 0;
let restarted = false;
let restartLog = "";

async function worker() {
  while (performance.now() - t0 < durationMs) {
    const n = i++;
    if (phase === "restart" && !restarted && performance.now() - t0 > 3000) {
      restarted = true;
      exec("sh bench/restart-redis.sh", (_e, out) => { restartLog = out.trim(); });
    }
    const user = n % 2 ? ALICE : ALEX;
    const port = n % 4 < 2 ? 7101 : 7102;
    const s = performance.now();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/tenants/${TENANT}/tasks?workspaceId=${WS}`, { headers: { authorization: `Bearer ${tok[user]}` } });
      await res.arrayBuffer();
      results.push({ status: res.status, ms: performance.now() - s, t: s - t0 });
    } catch {
      results.push({ status: 0, ms: performance.now() - s, t: s - t0 });
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const elapsed = (performance.now() - t0) / 1000;

const pct = (xs: number[], p: number) => { const s = [...xs].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))].toFixed(1) : 0; };
const by = (st: number) => results.filter((r) => r.status === st).length;
const lat = results.map((r) => r.ms);
const perSecond: Record<number, Record<number, number>> = {};
for (const r of results) { const sec = Math.floor(r.t / 1000); (perSecond[sec] ??= {})[r.status] = ((perSecond[sec] ??= {})[r.status] ?? 0) + 1; }
console.log(JSON.stringify({
  phase, seconds: +elapsed.toFixed(2), concurrency: CONCURRENCY, instances: 2, users: 2,
  offered: results.length, ok200: by(200), limited429: by(429), unavailable503: by(503), other: results.length - by(200) - by(429) - by(503),
  expectedMax200: Math.floor(2 * (30 + 5 * elapsed)),
  latencyMs: { p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99) },
  perSecond,
  restartLog,
  memoryMB: Math.round(process.memoryUsage().rss / 1048576),
}, null, 1));
for (const x of [a, b]) { x.server.close(); await x.pool.end(); try { await x.redis.quit(); } catch { x.redis.disconnect(); } }
process.exit(0);
