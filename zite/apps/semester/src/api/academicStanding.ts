import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, userNames, audit } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureOgr, one, transcriptEntries } from '../lib/ogrServer';
import { policyFor } from '../lib/gplServer';
import { buildTranscript, termOrder } from '../lib/transcriptRules';
import { STN_MIGRATION, STN_DECISIONS, STN_APPEAL_DAYS } from '../lib/stnMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of STN_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const ok = (r: string | null) => { const s = String(r ?? ''); if (!s.startsWith('ok')) forbid(s || 'Refused.'); return s; };

/** Calculated standing per term for one student, from official revisions and the institution's policy (server-side only). */
async function calculated(T: string, institution: string, student: string) {
  const entries = (await transcriptEntries(T, student)).map((e) => ({ ...e, termOrder: termOrder(e.term) }));
  return buildTranscript(entries, await policyFor(T, institution)).terms.map((t) => ({ term: t.term, gpa: t.gpa, cumulativeGpa: t.cumulativeGpa, standing: t.standing, honors: t.honors }));
}

export default createEndpoint({
  description: 'Academic standing: calculated per term from official grades; a registrar records the decision and notice; students appeal; a different registrar decides',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('review') }),
    z.object({ action: z.literal('record'), studentId: z.string(), term: z.string().max(40), decision: z.enum(STN_DECISIONS), rationale: z.string().max(2000), notice: z.string().max(2000), expectedVersion: z.number().int().min(0) }),
    z.object({ action: z.literal('decideAppeal'), appealId: z.number().int(), grant: z.boolean(), note: z.string().max(2000) }),
    z.object({ action: z.literal('mine') }),
    z.object({ action: z.literal('appeal'), decisionId: z.number().int(), statement: z.string().max(4000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureOgr(); await ensure();
    const sql = pg(); const me = context.user.id;
    const a = await requireAccess(me); const T = a.institutionId;

    // ---------------- student ----------------
    if (input.action === 'mine' || input.action === 'appeal') {
      if (input.action === 'appeal') {
        const r = ok(await one(`SELECT stn_appeal($1,$2,$3,$4) AS r`, [me, T, input.decisionId, input.statement]));
        await audit(a, 'Standing appeal submitted', `standing-appeal:${r.split(':')[1]}`, '', 'Student');
        return { ok: true };
      }
      const ds = (await sql.query(`SELECT d.id, d.term, d.version, d.decision, d.notice, d.decided_at, d.status, d.via_appeal,
          (SELECT row_to_json(x) FROM (SELECT ap.id, ap.status, ap.submitted_at, ap.outcome_note FROM stn_appeals ap WHERE ap.decision_id = d.id ORDER BY ap.id DESC LIMIT 1) x) AS appeal
        FROM stn_decisions d WHERE d.tenant_id = $1 AND d.student_id = $2 ORDER BY d.term, d.version DESC`, [T, me])) as Row[];
      return { appealDays: STN_APPEAL_DAYS, decisions: ds.map((d) => {
        const decidedAt = iso(d.decided_at)!; const closes = new Date(new Date(decidedAt).getTime() + STN_APPEAL_DAYS * 86400000).toISOString();
        const ap = d.appeal as Row | null;
        return { id: Number(d.id), term: String(d.term), version: Number(d.version), decision: String(d.decision), notice: String(d.notice), decidedAt, current: d.status === 'Recorded', viaAppeal: !!d.via_appeal,
          appealable: d.status === 'Recorded' && ['Academic probation', 'Academic suspension'].includes(String(d.decision)) && !ap && new Date() < new Date(closes), appealCloses: closes,
          appeal: ap ? { status: String(ap.status), submittedAt: iso(ap.submitted_at), outcome: String(ap.outcome_note ?? '') } : null };
      }) };
    }

    // ---------------- registrar ----------------
    await requireAction(me, 'registrar.read'); await requireAction(me, 'registration.request.decide');
    const mode = String((await one(`SELECT aum_mode($1,'records') AS r`, [T])) ?? 'design');
    const holdsLive = a.isSample || mode === 'pilot' || mode === 'authoritative';

    if (input.action === 'record') {
      if (input.studentId === me) forbid('You cannot record standing on your own record.');
      const calc = (await calculated(T, a.institutionName, input.studentId)).find((t) => t.term === input.term);
      if (!calc) forbid('That student has no official grades for that term.');
      const r = ok(await one(`SELECT stn_record($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS r`,
        [me, T, true, input.studentId, input.term, calc!.standing, input.decision, input.rationale, input.notice, input.expectedVersion]));
      const id = Number(r.split(':')[1]);
      let hold: 'placed' | 'held in sandbox' | null = null;
      if (input.decision === 'Academic suspension') {
        if (holdsLive) {
          const h = await zite.studentHolds.create({ record: { label: 'Academic standing hold', student: input.studentId, institution: T, originatingOffice: 'Registrar',
            blocksRegistration: true, status: 'Active', studentFacingMessage: input.notice.slice(0, 400), isSample: a.isSample } as never });
          ok(await one(`SELECT stn_link_hold($1,$2,$3) AS r`, [T, id, h.id]));
          await audit(a, 'Registration hold placed', `studentHold:${h.id}`, `academic suspension, standing decision ${id}`, 'Registrar');
          hold = 'placed';
        } else hold = 'held in sandbox';
      }
      await audit(a, 'Standing decision recorded', `standing:${id}`, `${input.term}: ${input.decision}`, 'Registrar');
      return { ok: true, id, hold };
    }

    if (input.action === 'decideAppeal') {
      const r = ok(await one(`SELECT stn_decide_appeal($1,$2,$3,$4,$5,$6) AS r`, [me, T, true, input.appealId, input.grant, input.note]));
      const [, outcome, , holdRef] = r.split(':');
      let released = false;
      if (outcome === 'granted' && holdRef) {
        const h = await zite.studentHolds.findOne({ id: holdRef });
        if (h && h.status === 'Active') { await zite.studentHolds.update({ id: holdRef, record: { status: 'Released' } as never }); released = true;
          await audit(a, 'Registration hold released', `studentHold:${holdRef}`, `standing appeal ${input.appealId} granted`, 'Registrar'); }
      }
      await audit(a, outcome === 'granted' ? 'Standing appeal granted' : 'Standing appeal denied', `standing-appeal:${input.appealId}`, input.note, 'Registrar');
      return { ok: true, outcome, holdReleased: released };
    }

    // review: every student with official grades; latest term's calculated standing next to the recorded decision.
    const students = ((await sql.query(`SELECT DISTINCT student_id FROM ogr_entries WHERE tenant_id = $1 LIMIT 500`, [T])) as Row[]).map((r) => String(r.student_id));
    const names = await userNames(students);
    const current = (await sql.query(`SELECT d.id, d.student_id, d.term, d.version, d.decision, d.decided_by, d.decided_at, d.hold_ref FROM stn_decisions d WHERE d.tenant_id = $1 AND d.status = 'Recorded'`, [T])) as Row[];
    const appeals = (await sql.query(`SELECT ap.id, ap.statement, ap.submitted_at, d.student_id, d.term, d.decision, d.decided_by FROM stn_appeals ap JOIN stn_decisions d ON d.id = ap.decision_id WHERE ap.tenant_id = $1 AND ap.status = 'Open' ORDER BY ap.submitted_at`, [T])) as Row[];
    const deciders = await userNames([...current, ...appeals].map((r) => String(r.decided_by)));
    const rows: Record<string, unknown>[] = [];
    for (const s of students) {
      for (const t of await calculated(T, a.institutionName, s)) {
        if (!t.standing) continue;
        const d = current.find((x) => x.student_id === s && x.term === t.term);
        rows.push({ studentId: s, student: names[s] ?? 'Student', ...t,
          decision: d ? { id: Number(d.id), version: Number(d.version), decision: String(d.decision), by: deciders[String(d.decided_by)] ?? 'Registrar', at: iso(d.decided_at), hold: !!d.hold_ref } : null });
      }
    }
    return { mode, holdsLive, decisions: STN_DECISIONS, rows,
      appeals: appeals.map((p) => ({ id: Number(p.id), student: names[String(p.student_id)] ?? 'Student', term: String(p.term), decision: String(p.decision), statement: String(p.statement),
        submittedAt: iso(p.submitted_at), decidedBy: deciders[String(p.decided_by)] ?? 'Registrar', mineToDecide: p.decided_by !== me })) };
  },
});
