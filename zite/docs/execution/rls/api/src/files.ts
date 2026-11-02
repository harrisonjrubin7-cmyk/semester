// Private files (security blueprint §1-2). The row policy in platform.files decides every read; the bytes
// sit in private storage under an opaque key and are never served without that decision or a short,
// single-object signed link minted after it.
import express, { type RequestHandler, type Router } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";
import { z } from "zod";
import { withTenant, ForbiddenError } from "./database";

export type FileAccessLog = { actor: string | null; tenant: string | null; fileId: string | null; action: string; decision: "allow" | "deny"; reason: string };
export type FileConfig = { storageDir: string; linkSecret: string; linkTtlSec: number; log: (e: FileAccessLog) => void };

const MAX_BYTES = 10 * 1024 * 1024;
const CLASSES = ["student_private", "institution_shared", "official_record"] as const;

// Decide the type from the bytes. The client's filename and content-type header are not trusted.
export function sniff(buf: Buffer): string | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (!buf.includes(0) && Buffer.from(buf.toString("utf8"), "utf8").equals(buf)) return "text/plain";
  return null;
}
const safeName = (n: string) => n.replace(/[^\w.\- ]+/g, "_").slice(0, 200) || "file";

function signLink(cfg: FileConfig, key: string, exp: number) {
  return createHmac("sha256", cfg.linkSecret).update(`${key}.${exp}`).digest("hex");
}

export function filesRouter(pool: Pool, cfg: FileConfig, authenticate: RequestHandler): Router {
  const r = express.Router();
  const tenantParam = z.string().uuid();
  const idParam = z.string().uuid();

  // Upload: raw bytes, size-capped by the parser, type decided by content.
  r.post("/api/v1/tenants/:tenantId/files", authenticate, express.raw({ type: "*/*", limit: MAX_BYTES }), async (req, res) => {
    const userId: string = res.locals.auth.userId;
    const tenantId = tenantParam.safeParse(req.params.tenantId);
    const q = z.object({ filename: z.string().min(1).max(200), classification: z.enum(CLASSES) }).safeParse(req.query);
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!tenantId.success || !q.success || body.length === 0) return void res.status(400).json({ error: { code: "INVALID_REQUEST" } });
    const type = sniff(body);
    if (!type) {
      cfg.log({ actor: userId, tenant: tenantId.data, fileId: null, action: "upload", decision: "deny", reason: "type_not_allowed" });
      return void res.status(415).json({ error: { code: "FILE_TYPE_NOT_ALLOWED" } });
    }
    const key = randomBytes(32).toString("hex");
    await mkdir(cfg.storageDir, { recursive: true });
    await writeFile(join(cfg.storageDir, key), body, { flag: "wx" });
    try {
      const id = await withTenant(pool, { userId, tenantId: tenantId.data }, async (db) => (await db.query<{ id: string }>(
        "insert into platform.files (tenant_id, owner_user_id, classification, storage_key, filename, content_type, size_bytes) values ($1,$2,$3,$4,$5,$6,$7) returning id",
        [tenantId.data, userId, q.data.classification, key, safeName(q.data.filename), type, body.length])).rows[0].id);
      cfg.log({ actor: userId, tenant: tenantId.data, fileId: id, action: "upload", decision: "allow", reason: "owner" });
      res.status(201).json({ data: { id, contentType: type, size: body.length } });
    } catch (e) {
      await unlink(join(cfg.storageDir, key)).catch(() => {});   // no orphaned bytes without a row
      cfg.log({ actor: userId, tenant: tenantId.data, fileId: null, action: "upload", decision: "deny", reason: e instanceof ForbiddenError ? "not_member" : "rejected" });
      res.status(e instanceof ForbiddenError ? 403 : 400).json({ error: { code: "UPLOAD_REJECTED" } });
    }
  });

  // Resolve a file through the row policy. Not visible and nonexistent look the same: 404, no metadata.
  async function authorize(req: express.Request, res: express.Response, action: string) {
    const userId: string = res.locals.auth.userId;
    const t = tenantParam.safeParse(req.params.tenantId), f = idParam.safeParse(req.params.id);
    if (!t.success || !f.success) { res.status(404).json({ error: { code: "NOT_FOUND" } }); return null; }
    try {
      const row = await withTenant(pool, { userId, tenantId: t.data }, async (db) => (await db.query<{ storage_key: string; filename: string; content_type: string }>(
        "select storage_key, filename, content_type from platform.files where id = $1", [f.data])).rows[0]);
      if (!row) {
        cfg.log({ actor: userId, tenant: t.data, fileId: f.data, action, decision: "deny", reason: "not_visible" });
        res.status(404).json({ error: { code: "NOT_FOUND" } }); return null;
      }
      cfg.log({ actor: userId, tenant: t.data, fileId: f.data, action, decision: "allow", reason: "policy" });
      return row;
    } catch (e) {
      cfg.log({ actor: userId, tenant: t.data, fileId: f.data, action, decision: "deny", reason: e instanceof ForbiddenError ? "not_member" : "error" });
      res.status(404).json({ error: { code: "NOT_FOUND" } }); return null;
    }
  }
  const send = async (res: express.Response, row: { storage_key: string; filename: string; content_type: string }) => {
    res.setHeader("Content-Type", row.content_type);
    res.setHeader("Content-Disposition", `attachment; filename="${row.filename.replace(/"/g, "")}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(await readFile(join(cfg.storageDir, row.storage_key)));
  };

  // Preferred: authenticated download, checked every time.
  r.get("/api/v1/tenants/:tenantId/files/:id/content", authenticate, async (req, res) => {
    const row = await authorize(req, res, "download"); if (row) await send(res, row);
  });

  // When a link is unavoidable: one object, minted after authorization, short-lived. Never stored.
  r.post("/api/v1/tenants/:tenantId/files/:id/link", authenticate, async (req, res) => {
    const row = await authorize(req, res, "link"); if (!row) return;
    const exp = Math.floor(Date.now() / 1000) + cfg.linkTtlSec;
    res.setHeader("Cache-Control", "no-store");
    res.json({ data: { url: `/files/blob/${row.storage_key}?exp=${exp}&sig=${signLink(cfg, row.storage_key, exp)}`, expiresAt: exp } });
  });

  r.get("/files/blob/:key", async (req, res) => {
    const key = String(req.params.key), exp = Number(req.query.exp), sig = String(req.query.sig ?? "");
    const ok = /^[0-9a-f]{64}$/.test(key) && Number.isInteger(exp) && exp >= Math.floor(Date.now() / 1000) && /^[0-9a-f]{64}$/.test(sig)
      && timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(signLink(cfg, key, exp), "hex"));
    if (!ok) { cfg.log({ actor: null, tenant: null, fileId: null, action: "signed_link", decision: "deny", reason: "invalid_or_expired" }); return void res.status(403).json({ error: { code: "LINK_INVALID" } }); }
    // The signature only covers this key; look up type and name without trusting the request.
    const db = await pool.connect();
    let row: { storage_key: string; filename: string; content_type: string } | undefined;
    try {
      await db.query("begin");
      await db.query("set local role semester_api");
      row = (await db.query("select storage_key, filename, content_type from platform.file_link_lookup($1)", [key])).rows[0];
      await db.query("commit");
    } catch (e) { await db.query("rollback"); throw e; } finally { db.release(); }
    if (!row) return void res.status(403).json({ error: { code: "LINK_INVALID" } });
    cfg.log({ actor: null, tenant: null, fileId: null, action: "signed_link", decision: "allow", reason: "signature" });
    await send(res, row);
  });
  return r;
}
