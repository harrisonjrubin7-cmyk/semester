import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAction, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { ensurePlt, processOutbox } from '../lib/platform';
import { roleAppByKey } from '../lib/roleApps';

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Integration Admin: event delivery health, dead letters and two-person replay (lib/obxMigration.ts). Institution-scoped;
// administrators with the connector capability only. Payloads are internal references, never student content.
export default createEndpoint({
  description: 'Event delivery: pending and dead-letter outbox events, manual processing, and replay requested by one admin and approved by another',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('process') }),
    z.object({ action: z.literal('requestReplay'), outboxId: z.number().int(), reason: z.string().min(10).max(500) }),
    z.object({ action: z.literal('approveReplay'), replayId: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'connector.manage');
    await ensurePlt();
    const sql = pg();
    const T = a.institutionId;
    const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
    let ran: unknown = null;
    if (input.action === 'process') { ran = await processOutbox(T, 200); await audit(a, 'Outbox processed', `institution:${T}`, JSON.stringify(ran), 'Integration admin'); }
    if (input.action === 'requestReplay') {
      fail(((await sql.query(`SELECT plt_request_replay($1,$2,$3,$4) AS e`, [a.userId, T, input.outboxId, input.reason])) as { e: string | null }[])[0].e);
      await audit(a, 'Replay requested', `outbox:${input.outboxId}`, input.reason, 'Integration admin');
    }
    if (input.action === 'approveReplay') {
      fail(((await sql.query(`SELECT plt_approve_replay($1,$2,$3) AS e`, [a.userId, T, input.replayId])) as { e: string | null }[])[0].e);
      ran = await processOutbox(T, 200);
      await audit(a, 'Replay approved', `replay:${input.replayId}`, JSON.stringify(ran), 'Integration admin');
    }
    const [stats, dead, replays, load] = await Promise.all([
      sql.query(`SELECT count(*) FILTER (WHERE delivered_at IS NULL AND NOT dead_letter)::int AS pending, count(*) FILTER (WHERE dead_letter)::int AS dead,
        count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered, extract(epoch FROM now() - min(created_at) FILTER (WHERE delivered_at IS NULL AND NOT dead_letter))::int AS oldest_s
        FROM plt_outbox WHERE tenant_id = $1`, [T]) as Promise<Row[]>,
      sql.query(`SELECT id, topic, ref, attempts, last_error, created_at FROM plt_outbox WHERE tenant_id = $1 AND dead_letter ORDER BY id DESC LIMIT 50`, [T]) as Promise<Row[]>,
      sql.query(`SELECT * FROM plt_replays WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`, [T]) as Promise<Row[]>,
      sql.query(`SELECT * FROM plt_office_load WHERE tenant_id = $1 ORDER BY to_app`, [T]) as Promise<Row[]>,
    ]);
    const names = await userNames(replays.flatMap((r) => [String(r.requested_by), String(r.approved_by ?? '')]));
    const st = stats[0] ?? {};
    return {
      ran, me: a.userId,
      stats: { pending: Number(st.pending ?? 0), dead: Number(st.dead ?? 0), delivered: Number(st.delivered ?? 0), oldestSeconds: st.oldest_s == null ? null : Number(st.oldest_s) },
      dead: dead.map((d) => ({ id: Number(d.id), topic: String(d.topic), ref: String(d.ref), attempts: Number(d.attempts), error: (d.last_error as string) ?? '', at: iso(d.created_at),
        replay: replays.find((r) => Number(r.outbox_id) === Number(d.id) && !r.approved_by) ? true : false })),
      replays: replays.map((r) => ({ id: Number(r.id), outboxId: Number(r.outbox_id), reason: String(r.reason), requestedBy: names[String(r.requested_by)] ?? 'Admin', requestedByMe: r.requested_by === a.userId,
        approvedBy: r.approved_by ? names[String(r.approved_by)] ?? 'Admin' : null, at: iso(r.created_at) })),
      officeLoad: load.map((l) => ({ office: roleAppByKey(String(l.to_app))?.role ?? String(l.to_app), awaitingConsent: Number(l.awaiting_consent), queued: Number(l.queued), accepted: Number(l.accepted), updatedAt: iso(l.updated_at) })),
    };
  },
});
