import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { OVR_MIGRATION } from '../lib/ovrMigration';
import { liveShares, ConsentRow } from '../lib/shares';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of OVR_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Overrides and exceptions desk (ovr-001). Students see their own requests; advisors endorse credit overloads and late
// registration; registrars decide. Requests are created from Registration (registration.ts) so they carry the right section.
export default createEndpoint({
  description: 'Overrides and exceptions: student requests, advisor endorsement, registrar decision; approvals are single use and expire',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('step'), step: z.enum(['withdraw', 'endorse', 'not_endorse', 'approve', 'deny']), id: z.number().int(), version: z.number().int(), note: z.string().max(1000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let registrar = false;
    try { await requireAction(me, 'registration.request.decide'); registrar = true; } catch { /* not a registrar */ }
    // An advisor sees and endorses only students who have shared their registration plan with them (advisorShare.ts).
    const scope = await tenantScope(T);
    let advisees: string[] = [];
    if (a.roles.includes('Advisor')) {
      const c = (await zite.consents.findAll({ filters: { recipient: me, consentType: 'Data Sharing' }, limit: 2000 })).records.map((r) => ({
        id: r.id, member: ids(r.member), recipient: ids(r.recipient), label: r.label ?? '', consentType: r.consentType ?? '', granted: !!r.granted, revoked: !!r.revoked, expiresOn: r.expiresOn ?? null,
      }) as ConsentRow);
      advisees = liveShares(c, me, 'Advisor', new Date().toISOString().slice(0, 10)).filter((x) => scope.members.has(x.studentId) && x.categories.includes('Registration plan')).map((x) => x.studentId);
    }
    const advisor = a.roles.includes('Advisor');
    if (input.action === 'step') {
      const target = ((await sql.query(`SELECT student_id FROM ovr_requests WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      const forThis = !!target && advisees.includes(String(target.student_id));
      const r = ((await sql.query(`SELECT ovr_step($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [T, me, forThis, registrar, input.step, input.id, input.version, input.note])) as { r: string }[])[0].r;
      if (!r.startsWith('ok:')) forbid(r);
      const row = ((await sql.query(`SELECT student_id, kind FROM ovr_requests WHERE id = $1`, [input.id])) as Row[])[0];
      if (row && input.step !== 'withdraw') await zite.messages.create({ record: { body: `Your ${String(row.kind).replace('_', ' ')} request was ${input.step === 'approve' ? 'approved' : input.step === 'deny' ? 'denied' : input.step === 'endorse' ? 'endorsed by an advisor and sent to the registrar' : 'not endorsed by an advisor'}.`, sender: me, recipients: [String(row.student_id)], isNotification: true, read: false } as never });
      if (['approve', 'deny', 'endorse', 'not_endorse'].includes(input.step)) await audit(a, `Override ${input.step}`, `override:${input.id}`, input.note, registrar && ['approve', 'deny'].includes(input.step) ? 'Registrar' : 'Advisor');
    }
    const rows = (await sql.query(`SELECT * FROM ovr_requests WHERE tenant_id = $1 AND (student_id = $2 OR $3 OR (kind <> 'prerequisite' AND student_id = ANY($4::text[]))) ORDER BY
      CASE state WHEN 'requested' THEN 0 WHEN 'endorsed' THEN 1 ELSE 2 END, created_at DESC LIMIT 300`, [T, me, registrar, advisees])) as Row[];
    const secIds = [...new Set(rows.map((r) => r.section_id).filter(Boolean).map(String))].filter((s) => scope.sections.has(s));
    const secs = await Promise.all(secIds.map((id) => zite.sections.findOne({ id })));
    const label = (id: unknown) => (secs.find((s) => s?.id === id)?.label ?? '').split(' · ')[0] || null;
    const names = await userNames(rows.flatMap((r) => [String(r.student_id), String(r.endorsed_by ?? ''), String(r.decided_by ?? '')]));
    const nm = (id: unknown) => (id ? names[String(id)] ?? 'Member' : null);
    return {
      me, registrar, advisor,
      requests: rows.map((r) => ({ id: Number(r.id), kind: String(r.kind), term: String(r.term), section: label(r.section_id), credits: r.credits_requested == null ? null : Number(r.credits_requested),
        reason: String(r.reason), state: String(r.state), student: r.student_id === me ? 'You' : nm(r.student_id), mine: r.student_id === me, endorsedBy: nm(r.endorsed_by), endorseNote: String(r.endorse_note),
        endorsedByMe: r.endorsed_by === me, decidedBy: nm(r.decided_by), decisionNote: String(r.decision_note), expiresAt: iso(r.expires_at), usedAt: iso(r.used_at), version: Number(r.version), at: iso(r.created_at) })),
    };
  },
});
