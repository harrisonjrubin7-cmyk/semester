// Payment-provider webhook: verify the signature over the raw body before parsing, then hand the event
// to the database command, which owns deduplication, ordering and posting.
import express, { type Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";

// Header format (Stripe-style): "t=<unix seconds>,v1=<hex hmac-sha256 of `${t}.${rawBody}`>".
export function verifySignature(raw: Buffer, header: string | undefined, secret: string, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1 || !/^[0-9a-f]{64}$/.test(parts.v1)) return false;
  if (Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.`).update(raw).digest();
  const given = Buffer.from(parts.v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const Event = z.object({
  id: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  account: z.string().min(1).max(200),
  data: z.object({ provider_ref: z.string().min(1).max(200), amount_minor: z.number().int(), currency: z.string().length(3) }),
});

export function webhookRouter(pool: Pool, secrets: Record<string, string>): Router {
  const router = express.Router();
  // Raw body only on this route: a general JSON parser would destroy the bytes the signature covers.
  router.post("/api/v1/webhooks/payments/:provider", express.raw({ type: "*/*", limit: "64kb" }), async (req, res) => {
    const provider = req.params.provider;
    const secret = secrets[provider];
    if (!secret || !Buffer.isBuffer(req.body) || !verifySignature(req.body, req.header("x-signature"), secret)) {
      res.status(401).json({ error: { code: "INVALID_SIGNATURE" } });
      return;
    }
    const parsed = Event.safeParse(JSON.parse(req.body.toString("utf8")));
    if (!parsed.success) { res.status(400).json({ error: { code: "INVALID_EVENT" } }); return; }
    const e = parsed.data;
    try {
      const r = await pool.query<{ outcome: string }>(
        "select student_accounts.apply_provider_event($1,$2,$3,$4,$5,$6,$7) as outcome",
        [provider, e.account, e.id, e.type, e.data.provider_ref, e.data.amount_minor, e.data.currency]);
      // Acknowledge only after the receipt is durably committed.
      res.json({ received: true, outcome: r.rows[0].outcome });
    } catch (err) {
      const code = (err as { code?: string }).code;
      // Unknown provider account: refuse without detail. Anything else: let the provider retry.
      res.status(code === "42501" ? 403 : 500).json({ error: { code: code === "42501" ? "ACCESS_DENIED" : "RETRY_LATER" } });
    }
  });
  return router;
}
