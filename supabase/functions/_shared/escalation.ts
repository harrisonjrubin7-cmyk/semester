/**
 * The escalation delivery adapter: the one thing that sends a Community case
 * to a university, and only after two reviewers approved it.
 *
 * The database decides *what* may leave and *whether* anything is due —
 * `decide_community_escalation` builds the payload from an allowlist, and
 * `public.take_escalation_deliveries` hands out only approved rows whose
 * school still has the switch on and the same agreement. This file decides
 * *how* it leaves, and trusts none of that further than it has to:
 *
 *   - **A channel is a name, not an address.** The agreement row says
 *     `webhook:vu_dos`; the URL and signing key for that name live in this
 *     function's environment (`ESCALATION_WEBHOOK_VU_DOS_URL` / `_KEY`). A row
 *     somebody edited cannot point a payload at a new host, because a name
 *     with no configured address is refused, and so is any address that is
 *     not https.
 *   - **The payload is checked again on the way out** against the same
 *     allowlist the SQL builds from. Anything extra — a name, an email, a
 *     field a future migration added without anybody deciding it should leave
 *     — refuses the delivery for good rather than sending it.
 *   - **Every send is signed and idempotent.** An HMAC-SHA256 over the
 *     timestamp and body, and the delivery id as the idempotency key, so a
 *     retry after a lost response is recognisable as the same escalation.
 *   - **What is recorded about a failure is a code** — `http_502`, `timeout`
 *     — never anything the receiver said back. The SQL refuses anything else.
 *
 * It is deliberately not yet a deployed function. In this repository a
 * directory under `supabase/functions/` is a deployed function (DEPLOY.md,
 * "What is live"), and deploying this is a decision with a signed agreement
 * behind it, not a side effect of a merge. `docs/CAMPUS-ESCALATION-POLICY.md`
 * has the three-line `index.ts` and the steps. Everything here is written
 * against injected dependencies so it is tested without a network or Deno.
 */

/** The fields `decide_community_escalation` builds. Nothing else may leave. */
export const PAYLOAD_KEYS = [
  'agreement_ref',
  'case_id',
  'category',
  'occurred_at',
  'severity',
  'summary',
  'tenant_id',
] as const;

/** Present only when the agreement requires identity, and only as a hash. */
export const OPTIONAL_KEYS = ['subject_ref'] as const;

/** Mirrors the 500 in the SQL and SUMMARY_MAX in app/src/community/crisis.ts. */
export const SUMMARY_MAX = 500;

/** Per request. A receiver that has not answered in this long is a retry. */
export const SEND_TIMEOUT_MS = 10_000;

/** The only strings that may be written to `last_error`. */
export type FailureCode =
  | `http_${number}`
  | 'timeout'
  | 'network'
  | 'channel_not_configured'
  | 'payload_rejected'
  | 'signing_failed';

export interface Delivery {
  id: string;
  escalation_id: string;
  channel: string;
  payload: unknown;
  attempts: number;
}

export interface Channel {
  url: string;
  key: string;
}

export interface Deps {
  /** ESCALATION_CRON_SECRET. Empty means the adapter refuses everything. */
  secret: string;
  take: () => Promise<Delivery[]>;
  delivered: (id: string) => Promise<void>;
  failed: (id: string, code: FailureCode, final: boolean) => Promise<void>;
  /** Environment lookup, so channels are configured where rows cannot reach. */
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  now: () => Date;
}

/**
 * Why a payload may not leave, or null if it may.
 *
 * Exact keys, not a superset: the check that matters is that nothing was
 * added. `subject_ref` is allowed only as a 64-character hex hash, which is
 * what the SQL makes and cannot be a name or an address.
 */
export function payloadProblem(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'not an object';
  const p = payload as Record<string, unknown>;
  const allowed = new Set<string>([...PAYLOAD_KEYS, ...OPTIONAL_KEYS]);
  const extra = Object.keys(p).filter((k) => !allowed.has(k));
  if (extra.length) return `unexpected field ${extra.sort().join(', ')}`;
  const missing = PAYLOAD_KEYS.filter((k) => typeof p[k] !== 'string' || p[k] === '');
  if (missing.length) return `missing ${missing.join(', ')}`;
  if ((p.summary as string).length > SUMMARY_MAX) return 'summary too long';
  if (p.severity !== 'P0' && p.severity !== 'P1') return 'severity not escalable';
  if ('subject_ref' in p && !(typeof p.subject_ref === 'string' && /^[0-9a-f]{64}$/.test(p.subject_ref))) {
    return 'subject_ref is not a hash';
  }
  return null;
}

/**
 * The configured address for a channel name, or null.
 *
 * `webhook:<name>` only; the name is lowercase letters, digits and
 * underscores, and maps to `ESCALATION_WEBHOOK_<NAME>_URL` and `_KEY`. The URL
 * must be https and the key at least 32 characters, so a half-configured
 * channel fails closed rather than sending unsigned or in the clear.
 */
export function channelFor(name: string, env: (k: string) => string | undefined): Channel | null {
  const m = /^webhook:([a-z0-9_]{1,40})$/.exec(name);
  if (!m) return null;
  const stem = `ESCALATION_WEBHOOK_${m[1].toUpperCase()}`;
  const url = env(`${stem}_URL`) ?? '';
  const key = env(`${stem}_KEY`) ?? '';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
  if (key.length < 32) return null;
  return { url: parsed.toString(), key };
}

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** HMAC-SHA256 of `<timestamp>.<body>`, hex. The receiver recomputes it. */
export async function sign(key: string, timestamp: string, body: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${timestamp}.${body}`)));
}

/** Compared in constant time, so the bearer check does not leak by timing. */
function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** One delivery: refused, sent, or failed with a code. Never throws. */
export async function deliver(d: Delivery, deps: Deps): Promise<'sent' | FailureCode> {
  if (payloadProblem(d.payload)) {
    await deps.failed(d.id, 'payload_rejected', true);
    return 'payload_rejected';
  }
  const channel = channelFor(d.channel, deps.env);
  if (!channel) {
    // Not final: an operator can set the variable, and an urgent escalation
    // should not be lost to a missing one. It backs off and shows its code.
    await deps.failed(d.id, 'channel_not_configured', false);
    return 'channel_not_configured';
  }
  const body = JSON.stringify(d.payload);
  const timestamp = String(Math.floor(deps.now().getTime() / 1000));
  let signature: string;
  try {
    signature = await sign(channel.key, timestamp, body);
  } catch {
    await deps.failed(d.id, 'signing_failed', false);
    return 'signing_failed';
  }
  let code: FailureCode;
  try {
    const res = await deps.fetch(channel.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': d.id,
        'X-Semester-Signature': `t=${timestamp},v1=${signature}`,
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    // The body is never read: whatever the receiver says is not ours to keep.
    await res.body?.cancel();
    if (res.ok) {
      await deps.delivered(d.id);
      return 'sent';
    }
    code = `http_${res.status}`;
  } catch (e) {
    code = (e as { name?: string })?.name === 'TimeoutError' ? 'timeout' : 'network';
  }
  await deps.failed(d.id, code, false);
  return code;
}

/** The request handler: bearer secret, then whatever is due. */
export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (!deps.secret) return new Response('not configured', { status: 503 });
  if (!sameSecret(req.headers.get('Authorization') ?? '', `Bearer ${deps.secret}`)) {
    return new Response('no', { status: 401 });
  }
  const due = await deps.take();
  const outcome: Record<string, number> = {};
  for (const d of due) {
    const result = await deliver(d, deps);
    outcome[result] = (outcome[result] ?? 0) + 1;
  }
  // Counts only: no ids, no channels, nothing about a case.
  return Response.json({ taken: due.length, ...outcome });
}
