import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAction, audit } from '../lib/server';
import { pg } from '../lib/pg';

// Institution side of Semester support access (APP-025). The institution is resolved on the server from the caller's
// membership; only that institution's requests and access log are visible. Decisions bind to the exact request shown.
export default createEndpoint({
  description: 'Institution administrators approve, deny or revoke Semester support access to their institution and read its access log',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('decide'), id: z.string(), approve: z.boolean(), seenHash: z.string(), note: z.string().max(500) }),
    z.object({ action: z.literal('revoke'), id: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'connector.manage');
    const sql = pg();
    const ready = ((await sql.query(`SELECT to_regprocedure('sup_decide(text,text,text,boolean,text,text)') IS NOT NULL AS ok`)) as { ok: boolean }[])[0].ok;
    if (!ready) return { ready: false, requests: [], log: [] };
    const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
    if (input.action === 'decide') {
      fail(((await sql.query(`SELECT sup_decide($1,$2,$3,$4,$5,$6) AS e`, [a.userId, a.institutionId, input.id, input.approve, input.seenHash, input.note])) as { e: string | null }[])[0].e);
      await audit(a, input.approve ? 'Support access approved' : 'Support access denied', `supportAccess:${input.id}`, input.note, 'Institution administrator');
    }
    if (input.action === 'revoke') {
      fail(((await sql.query(`SELECT sup_revoke($1,$2,$3) AS e`, [a.userId, a.institutionId, input.id])) as { e: string | null }[])[0].e);
      await audit(a, 'Support access revoked', `supportAccess:${input.id}`, '', 'Institution administrator');
    }
    const [reqs, log] = await Promise.all([
      sql.query(`SELECT r.*, sup_request_hash(r) AS hash, (r.state = 'approved' AND r.expires_at > now()) AS active FROM sup_requests r WHERE r.tenant_id = $1 ORDER BY r.number DESC LIMIT 100`, [a.institutionId]) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT * FROM sup_access_log WHERE tenant_id = $1 ORDER BY id DESC LIMIT 200`, [a.institutionId]) as Promise<Record<string, unknown>[]>,
    ]);
    const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
    return {
      ready: true,
      requests: reqs.map((r) => ({ id: String(r.id), number: Number(r.number), ticket: String(r.ticket_ref), purpose: String(r.purpose), scopes: r.scopes as string[], hours: Number(r.hours),
        state: String(r.state), active: !!r.active, hash: String(r.hash), expiresAt: iso(r.expires_at), requestedAt: iso(r.created_at) })),
      log: log.map((l) => ({ scope: String(l.scope), allowed: !!l.allowed, reason: String(l.reason), at: iso(l.at), requestId: (l.request_id as string) ?? '' })),
    };
  },
});
