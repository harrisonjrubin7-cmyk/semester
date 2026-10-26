// Database + HTTP tests. Synthetic fixtures from ../../seed.sql. Runtime pool uses the restricted login.
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { createClient } from "redis";
import { ForbiddenError, requireCapability, withTenant } from "../src/database";
import { createApp } from "../src/app";
import { createLimiter } from "../src/limiter";

const host = process.env.TEST_PG_SOCKET!;
const port = Number(process.env.TEST_PG_PORT);
const database = "semester_rls_test";
const runtimePool = new Pool({ host, port, database, user: "semester_runtime_login", max: 1 });
const adminPool = new Pool({ host, port, database, user: "postgres", max: 1 });

const f = {
  tenantA: "a0000000-0000-0000-0000-00000000000a",
  tenantB: "b0000000-0000-0000-0000-00000000000b",
  alice: "00000000-0000-0000-0000-000000000001",
  bob: "00000000-0000-0000-0000-000000000003",
  carol: "00000000-0000-0000-0000-000000000004",
  aliceMembership: "00000000-0000-0000-0000-0000000000e1",
  wsA1: "00000000-0000-0000-0000-0000000000a1",
  wsA2: "00000000-0000-0000-0000-0000000000a2",
  aliceTask: "00000000-0000-0000-0000-0000000000f1",
  alexTask: "00000000-0000-0000-0000-0000000000f2",
  bobTask: "00000000-0000-0000-0000-0000000000f3",
};
const alice = { userId: f.alice, tenantId: f.tenantA };
const admin = (sql: string, args: unknown[] = []) => adminPool.query(sql, args);

describe("database authorization (runtime login)", () => {
  afterAll(async () => { await runtimePool.end(); });

  it("Alice reads Alex's task: zero rows", async () => {
    const rows = await withTenant(runtimePool, alice, async (db) => (await db.query("select id from app.tasks where id = $1", [f.alexTask])).rows);
    expect(rows).toEqual([]);
  });
  it("Alice reads Bob's task: zero rows", async () => {
    const rows = await withTenant(runtimePool, alice, async (db) => (await db.query("select id from app.tasks where id = $1", [f.bobTask])).rows);
    expect(rows).toEqual([]);
  });
  it("Alice supplies Tenant B: membership denial", async () => {
    await expect(withTenant(runtimePool, { userId: f.alice, tenantId: f.tenantB }, async () => 1)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("Alice attempts role assignment: permission error", async () => {
    await expect(withTenant(runtimePool, alice, (db) => db.query(
      "insert into iam.role_assignments (tenant_id, membership_id, role_id) select $1, $2, id from iam.roles where key = 'operator'",
      [f.tenantA, f.aliceMembership]))).rejects.toMatchObject({ code: "42501" });
  });
  it("Alice changes task owner: column permission error", async () => {
    await expect(withTenant(runtimePool, alice, (db) => db.query("update app.tasks set owner_user_id = $1 where id = $2", [f.bob, f.aliceTask])))
      .rejects.toMatchObject({ code: "42501" });
  });
  it("a role claim cannot replace a database assignment (Alice lacks read_any)", async () => {
    await expect(withTenant(runtimePool, alice, (db) => requireCapability(db, f.tenantA, f.wsA1, "tasks.read_any")))
      .rejects.toBeInstanceOf(ForbiddenError);
  });
  it("operator reads A1 (allowed) and A2 (denied)", async () => {
    const carol = { userId: f.carol, tenantId: f.tenantA };
    await expect(withTenant(runtimePool, carol, (db) => requireCapability(db, f.tenantA, f.wsA1, "tasks.read_any"))).resolves.toBeUndefined();
    await expect(withTenant(runtimePool, carol, (db) => requireCapability(db, f.tenantA, f.wsA2, "tasks.read_any"))).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("revoked membership: next request denied; restored: allowed", async () => {
    await admin("update iam.memberships set status = 'revoked' where id = $1", [f.aliceMembership]);
    try {
      await expect(withTenant(runtimePool, alice, async () => 1)).rejects.toBeInstanceOf(ForbiddenError);
    } finally {
      await admin("update iam.memberships set status = 'active' where id = $1", [f.aliceMembership]);
    }
    await expect(withTenant(runtimePool, alice, async () => 1)).resolves.toBe(1);
  });
  it("expired assignment: capability denied", async () => {
    await admin("update iam.role_assignments set valid_until = now() - interval '1 minute' where membership_id = $1", [f.aliceMembership]);
    try {
      await expect(withTenant(runtimePool, alice, (db) => requireCapability(db, f.tenantA, f.wsA1, "tasks.read_own"))).rejects.toBeInstanceOf(ForbiddenError);
    } finally {
      await admin("update iam.role_assignments set valid_until = null where membership_id = $1", [f.aliceMembership]);
    }
  });
  it("runtime attempts ALTER TABLE: denied", async () => {
    await expect(withTenant(runtimePool, alice, (db) => db.query("alter table app.tasks no force row level security"))).rejects.toMatchObject({ code: "42501" });
  });
  it("runtime attempts SET ROLE semester_owner: denied", async () => {
    await expect(withTenant(runtimePool, alice, (db) => db.query("set local role semester_owner"))).rejects.toMatchObject({ code: "42501" });
  });
  it("request without context after a prior request on the same connection: no rows", async () => {
    await withTenant(runtimePool, alice, (db) => db.query("select 1"));
    const db = await runtimePool.connect();
    try {
      await db.query("begin");
      await db.query("set local role semester_api");
      const r = await db.query("select current_setting('semester.user_id', true) as u, (select count(*)::int from app.tasks) as n");
      await db.query("rollback");
      expect(r.rows[0]).toEqual({ u: "", n: 0 });
    } finally { db.release(); }
  });
  it("denied update/delete: target unchanged", async () => {
    const before = (await admin("select title, version from app.tasks where id = $1", [f.alexTask])).rows[0];
    const n = await withTenant(runtimePool, alice, async (db) => {
      const u = await db.query("update app.tasks set title = 'x' where id = $1", [f.alexTask]);
      const d = await db.query("delete from app.tasks where id = $1", [f.alexTask]);
      return (u.rowCount ?? 0) + (d.rowCount ?? 0);
    });
    expect(n).toBe(0);
    expect((await admin("select title, version from app.tasks where id = $1", [f.alexTask])).rows[0]).toEqual(before);
  });
  it("cross-tenant foreign-key relationship: rejected", async () => {
    await expect(withTenant(runtimePool, alice, (db) => db.query(
      "insert into app.tasks (tenant_id, workspace_id, owner_user_id, title) values ($1, $2, $3, 'x')",
      [f.tenantA, "00000000-0000-0000-0000-0000000000b1", f.alice]))).rejects.toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
  });
});

describe("HTTP route with signed tokens (real middleware + real database + real Redis)", () => {
  let keys: { publicKey: CryptoKey; privateKey: CryptoKey };
  const redis = createClient({ url: process.env.TEST_REDIS_URL, disableOfflineQueue: true });
  const httpPool = new Pool({ host, port, database, user: "semester_runtime_login", max: 2 });
  const auth = () => ({ key: keys.publicKey, issuer: "https://test-issuer.example", audience: "semester-api", algorithms: ["RS256"], maxTokenAge: "20m" });
  const sign = async (sub: string, claims: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT(claims).setProtectedHeader({ alg: "RS256" }).setSubject(sub).setIssuer("https://test-issuer.example")
      .setAudience("semester-api").setIssuedAt(now).setExpirationTime(now + 300).sign(keys.privateKey);
  };
  const appWith = (limiter: ReturnType<typeof createLimiter>) => createApp({ pool: httpPool, auth: auth(), limiter });
  const call = async (app: ReturnType<typeof createApp>, sub: string, tenant: string, ws: string, claims = {}) =>
    request(app).get(`/api/v1/tenants/${tenant}/tasks?workspaceId=${ws}`).set("Authorization", `Bearer ${await sign(sub, claims)}`);

  beforeAll(async () => { keys = (await generateKeyPair("RS256")) as unknown as typeof keys; await redis.connect(); });
  afterAll(async () => { await redis.quit(); await httpPool.end(); await adminPool.end(); });

  it("student gets only their own task", async () => {
    const res = await call(appWith(createLimiter(redis, `t:${Date.now()}:a`)), f.alice, f.tenantA, f.wsA1);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { id: string }) => r.id)).toEqual([f.aliceTask]);
  });
  it("valid JWT claiming admin, no DB grant (operator without read_own): 403", async () => {
    const res = await call(appWith(createLimiter(redis, `t:${Date.now()}:b`)), f.carol, f.tenantA, f.wsA1, { role: "admin", roles: ["super_admin"] });
    expect(res.status).toBe(403);
  });
  it("valid JWT claiming admin for another tenant: 403", async () => {
    const res = await call(appWith(createLimiter(redis, `t:${Date.now()}:c`)), f.bob, f.tenantA, f.wsA1, { role: "admin", user_metadata: { role: "registrar" } });
    expect(res.status).toBe(403);
  });
  it("denied caller does not consume the tenant budget", async () => {
    const prefix = `t:${Date.now()}:d`;
    const app = appWith(createLimiter(redis, prefix));
    await call(app, f.bob, f.tenantA, f.wsA1);
    expect(await redis.keys(`${prefix}:*`)).toEqual([]);
  });
  it("invalid workspace parameter: 400", async () => {
    const res = await call(appWith(createLimiter(redis, `t:${Date.now()}:e`)), f.alice, f.tenantA, "not-a-uuid");
    expect(res.status).toBe(400);
  });
  it("user budget exhausted: 429 with Retry-After", async () => {
    const exhausted = { consume: async () => ({ allowed: false, remaining: 0, retryAfterMs: 2500 }) } as ReturnType<typeof createLimiter>;
    const res = await call(appWith(exhausted), f.alice, f.tenantA, f.wsA1);
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBe("3");
  });
  it("limiter unavailable: 503, not unlimited", async () => {
    const down = createClient({ url: "redis://127.0.0.1:1", disableOfflineQueue: true });
    const res = await call(appWith(createLimiter(down, "x")), f.alice, f.tenantA, f.wsA1);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("RATE_LIMITER_UNAVAILABLE");
  });
});
