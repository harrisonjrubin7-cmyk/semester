// Security blueprint §2 test matrix for private files: real routes, real JWTs, real row policies.
import express from "express";
import request from "supertest";
import pg from "pg";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticate } from "../src/auth";
import { filesRouter, type FileAccessLog } from "../src/files";

const { Pool } = pg;
const conn = { host: process.env.TEST_PG_SOCKET!, port: Number(process.env.TEST_PG_PORT), database: "semester_rls_test" };
const runtime = new Pool({ ...conn, user: "semester_runtime_login", max: 10 });
const admin = new Pool({ ...conn, user: "postgres", max: 2 });
const TA = "a0000000-0000-0000-0000-00000000000a", TB = "b0000000-0000-0000-0000-00000000000b";
const ALICE = "00000000-0000-0000-0000-000000000001", ALEX = "00000000-0000-0000-0000-000000000002";
const BOB = "00000000-0000-0000-0000-000000000003", CAROL = "00000000-0000-0000-0000-000000000004";
const ISS = "https://test-issuer.example", AUD = "semester-api";

let keys: { publicKey: CryptoKey; privateKey: CryptoKey };
let app: express.Express;
let storageDir: string;
const logs: FileAccessLog[] = [];
const tok: Record<string, string> = {};
const PDF = Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const ids: Record<string, string> = {};

const up = (user: string, tenant: string, body: Buffer, filename = "notes.pdf", classification = "student_private") =>
  request(app).post(`/api/v1/tenants/${tenant}/files?filename=${encodeURIComponent(filename)}&classification=${classification}`)
    .set("Authorization", `Bearer ${tok[user]}`).set("content-type", "application/octet-stream").send(body);
const get = (user: string | null, tenant: string, id: string) => {
  const r = request(app).get(`/api/v1/tenants/${tenant}/files/${id}/content`);
  return user ? r.set("Authorization", `Bearer ${tok[user]}`) : r;
};
const link = (user: string, tenant: string, id: string) =>
  request(app).post(`/api/v1/tenants/${tenant}/files/${id}/link`).set("Authorization", `Bearer ${tok[user]}`);
const asOwner = (user: string, tenant: string, sql: string, args: unknown[]) =>
  (async () => { const c = await runtime.connect(); try {
    await c.query("begin"); await c.query("set local role semester_api");
    await c.query("select set_config('semester.user_id',$1,true), set_config('semester.tenant_id',$2,true)", [user, tenant]);
    const r = await c.query(sql, args); await c.query("commit"); return r;
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); } })();

beforeAll(async () => {
  keys = (await generateKeyPair("RS256")) as unknown as typeof keys;
  for (const u of [ALICE, ALEX, BOB, CAROL]) {
    const now = Math.floor(Date.now() / 1000);
    tok[u] = await new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "RS256" }).setSubject(u)
      .setIssuer(ISS).setAudience(AUD).setIssuedAt(now).setExpirationTime(now + 600).sign(keys.privateKey);
  }
  storageDir = await mkdtemp(join(tmpdir(), "semester-files-"));
  app = express().use(filesRouter(runtime, { storageDir, linkSecret: randomUUID(), linkTtlSec: 2, log: (e) => logs.push(e) },
    authenticate({ key: keys.publicKey, issuer: ISS, audience: AUD, algorithms: ["RS256"], maxTokenAge: "20m" })));
  ids.alice = (await up(ALICE, TA, PDF, "Alice essay draft.pdf")).body.data.id;
  ids.alex = (await up(ALEX, TA, PDF, "Alex transcript.pdf", "official_record")).body.data.id;
  ids.bob = (await up(BOB, TB, PDF, "Bob notes.pdf")).body.data.id;
});
afterAll(async () => {
  await admin.query("delete from platform.file_grants"); await admin.query("delete from platform.files");
  await runtime.end(); await admin.end();
});

describe("private files: blueprint §2 matrix", () => {
  it("student A downloads their own private file", async () => {
    const r = await get(ALICE, TA, ids.alice);
    expect(r.status).toBe(200);
    expect(Buffer.from(r.body).subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.headers["cache-control"]).toContain("no-store");
  });
  it("anonymous request for a private file is denied", async () => {
    expect((await get(null, TA, ids.alice)).status).toBe(401);
  });
  it("student A substituting student B's file id is denied, with no metadata", async () => {
    const r = await get(ALICE, TA, ids.alex);
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).not.toContain("transcript");
  });
  it("institution A member requesting institution B's file is denied (both tenant ids tried)", async () => {
    expect((await get(ALICE, TA, ids.bob)).status).toBe(404);
    expect((await get(ALICE, TB, ids.bob)).status).toBe(404); // client-supplied tenant without membership
  });
  it("advisor/staff without an explicit grant is denied, even with an admin claim in the token", async () => {
    expect((await get(CAROL, TA, ids.alice)).status).toBe(404);
  });
  it("an explicit, expiring grant allows; revocation removes access on the next request", async () => {
    await asOwner(ALICE, TA, "insert into platform.file_grants (tenant_id, file_id, grantee_user_id, granted_by, expires_at) values ($1,$2,$3,$4, now() + interval '1 day')", [TA, ids.alice, CAROL, ALICE]);
    expect((await get(CAROL, TA, ids.alice)).status).toBe(200);
    await asOwner(ALICE, TA, "update platform.file_grants set revoked_at = now() where file_id = $1", [ids.alice]);
    expect((await get(CAROL, TA, ids.alice)).status).toBe(404);
  });
  it("an expired grant does not allow", async () => {
    await asOwner(ALICE, TA, "insert into platform.file_grants (tenant_id, file_id, grantee_user_id, granted_by, expires_at) values ($1,$2,$3,$4, now() + interval '1 second')", [TA, ids.alice, ALEX, ALICE]);
    await new Promise((r) => setTimeout(r, 1500));
    expect((await get(ALEX, TA, ids.alice)).status).toBe(404);
  });
  it("a student cannot grant access to someone else's file, or to themselves on it", async () => {
    await expect(asOwner(ALEX, TA, "insert into platform.file_grants (tenant_id, file_id, grantee_user_id, granted_by, expires_at) values ($1,$2,$3,$4, now() + interval '1 day')", [TA, ids.alice, ALEX, ALEX])).rejects.toMatchObject({ code: "42501" });
  });
  it("membership removed mid-session: the next download is denied", async () => {
    await admin.query("update iam.memberships set status = 'revoked' where user_id = $1", [ALICE]);
    try { expect((await get(ALICE, TA, ids.alice)).status).toBe(404); }
    finally { await admin.query("update iam.memberships set status = 'active' where user_id = $1", [ALICE]); }
  });
  it("signed link: works once authorized, only for that object, expires, and cannot be forged", async () => {
    const r = await link(ALICE, TA, ids.alice);
    const url: string = r.body.data.url;
    expect((await request(app).get(url)).status).toBe(200);
    const [, key] = url.match(/\/files\/blob\/([0-9a-f]{64})/)!;
    const alexKey = (await admin.query("select storage_key from platform.files where id = $1", [ids.alex])).rows[0].storage_key;
    expect((await request(app).get(url.replace(key, alexKey))).status).toBe(403);           // other object, same signature
    expect((await request(app).get(url.replace(/sig=[0-9a-f]+/, "sig=" + "0".repeat(64)))).status).toBe(403);
    await new Promise((res) => setTimeout(res, 3100));
    expect((await request(app).get(url)).status).toBe(403);                                 // expired
  });
  it("a link is only minted after authorization", async () => {
    expect((await link(ALEX, TA, ids.alice)).status).toBe(404);
  });
  it("a raw storage path is not reachable without a signature", async () => {
    const key = (await admin.query("select storage_key from platform.files where id = $1", [ids.alice])).rows[0].storage_key;
    expect((await request(app).get(`/files/blob/${key}`)).status).toBe(403);
  });
  it("upload controls: type decided by content, size capped, names sanitized, keys opaque", async () => {
    expect((await up(ALICE, TA, Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]), "report.pdf")).status).toBe(415); // executable named .pdf
    expect((await up(ALICE, TA, Buffer.alloc(10 * 1024 * 1024 + 1, 0x41), "big.txt")).status).toBe(413);
    const r = await up(ALICE, TA, Buffer.from("hello"), "../../etc/passwd\".txt");
    expect(r.status).toBe(201);
    const row = (await admin.query("select filename, storage_key, content_type from platform.files where id = $1", [r.body.data.id])).rows[0];
    expect(row.filename).not.toMatch(/[\/"]/);
    expect(row.content_type).toBe("text/plain");
    expect(row.storage_key).toMatch(/^[0-9a-f]{64}$/);
    for (const name of await readdir(storageDir)) expect(name).toMatch(/^[0-9a-f]{64}$/);
  });
  it("uploading into another institution is refused and leaves no orphaned bytes", async () => {
    const before = (await readdir(storageDir)).length;
    expect((await up(ALICE, TB, PDF)).status).toBe(403);
    expect((await readdir(storageDir)).length).toBe(before);
  });
  it("access decisions are logged without tokens or file contents", async () => {
    expect(logs.some((l) => l.decision === "deny" && l.reason === "not_visible")).toBe(true);
    const text = JSON.stringify(logs);
    expect(text).not.toContain("Bearer");
    expect(text).not.toContain("%PDF");
    expect(text).not.toMatch(/sig=/);
  });
});
