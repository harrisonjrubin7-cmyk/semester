import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAccess, requireAction, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { ADM_MIGRATION } from '../lib/admMigration';
import { DAK_MIGRATION } from '../lib/dakMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...ADM_MIGRATION, ...DAK_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Decision acknowledgment (dak-001). The applicant reads their released admissions decision and acknowledges it; the record
// keeps a fingerprint of exactly what they were shown. Admissions staff (decision capability) see who has acknowledged.
export default createEndpoint({
  description: 'Decision acknowledgment: the applicant acknowledges a released admissions decision; staff see acknowledgment status',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('ack'), applicationId: z.string().max(80), seen: z.string().regex(/^[0-9a-f]{32}$/) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const T = a.institutionId, me = a.userId;
    if (input.action === 'ack') {
      const r = ((await pg().query(`SELECT dak_ack($1,$2,$3,$4) AS r`, [T, me, input.applicationId, input.seen])) as { r: string }[])[0].r;
      if (!r.startsWith('ok:')) forbid(r);
      await audit(a, 'Admissions decision acknowledged', input.applicationId, '');
      return { ok: true };
    }
    const mine = (await pg().query(`SELECT r.application_id, r.decision, r.applicant_message, r.released_at, dak_fingerprint(r.decision, r.applicant_message) AS seen, k.acknowledged_at
      FROM adm_reviews r LEFT JOIN dak_acks k ON k.application_id = r.application_id WHERE r.tenant_id = $1 AND r.applicant_id = $2 AND r.state = 'Released' ORDER BY r.released_at DESC`, [T, me])) as Row[];
    let staff: unknown[] | null = null;
    try {
      await requireAction(me, 'admission.decide');
      const rows = (await pg().query(`SELECT r.application_id, r.applicant_id, r.decision, r.released_at, k.acknowledged_at FROM adm_reviews r LEFT JOIN dak_acks k ON k.application_id = r.application_id
        WHERE r.tenant_id = $1 AND r.state = 'Released' ORDER BY k.acknowledged_at IS NOT NULL, r.released_at DESC LIMIT 300`, [T])) as Row[];
      const n = await userNames(rows.map((r) => String(r.applicant_id)));
      staff = rows.map((r) => ({ applicationId: String(r.application_id), applicant: n[String(r.applicant_id)] ?? 'Applicant', decision: String(r.decision), releasedAt: iso(r.released_at), acknowledgedAt: iso(r.acknowledged_at) }));
    } catch { /* not admissions staff */ }
    return {
      decisions: mine.map((r) => ({ applicationId: String(r.application_id), decision: String(r.decision), message: String(r.applicant_message), releasedAt: iso(r.released_at), seen: String(r.seen), acknowledgedAt: iso(r.acknowledged_at) })),
      staff,
    };
  },
});
