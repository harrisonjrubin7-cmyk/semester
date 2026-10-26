import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureCal } from '../lib/calendarServer';
import { SREQ_MIGRATION } from '../lib/sreqMigration';
import { CUR_MIGRATION } from '../lib/curMigration';
import { PRG_MIGRATION } from '../lib/prgMigration';
import { CREDENTIALS } from '../lib/programRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { await ensureCal(); for (const q of [...SREQ_MIGRATION, ...CUR_MIGRATION, ...PRG_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Programs and pathways (S-70). Department chairs propose program versions with a term-by-term pathway and outcome map; the
// curriculum committee approves; a registrar publishes (catalog capability checked here, separation of duties in the
// database). Everyone in the institution reads published programs; proposals are visible to chairs of that department,
// the committee and registrars.
export default createEndpoint({
  description: 'Programs: chair-proposed versions with term-by-term pathways and outcome maps, committee approval, registrar publication',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('submit'), requestKey: z.string().min(8).max(100), departmentId: z.number().int(), code: z.string().min(2).max(24), name: z.string().min(3).max(160),
      credential: z.enum(CREDENTIALS), totalCredits: z.number().positive().max(300), termCap: z.number().positive().max(30), terms: z.array(z.array(z.string().min(4).max(20)).max(12)).min(1).max(16),
      outcomes: z.array(z.object({ text: z.string().min(10).max(400), courses: z.array(z.string().min(4).max(20)).min(1).max(20) })).min(1).max(12),
      effectiveTerm: z.string().min(3).max(40), rationale: z.string().min(20).max(4000) }),
    z.object({ action: z.literal('step'), id: z.number().int(), step: z.enum(['approve', 'publish', 'return', 'withdraw']), expectedVersion: z.number().int(), note: z.string().max(2000).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const isCommittee = !!((await sql.query(`SELECT cur_is_committee($1,$2) AS ok`, [T, me])) as { ok: boolean }[])[0]?.ok;
    let isRegistrar = false;
    try { await requireAction(me, 'registration.request.decide'); isRegistrar = true; } catch { /* not a registrar */ }
    let result: unknown = null;

    if (input.action === 'submit') {
      const out = ((await sql.query(`SELECT prg_submit($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13) AS r`, [T, input.requestKey, me, input.departmentId, input.code, input.name, input.credential,
        input.totalCredits, input.termCap, JSON.stringify(input.terms), JSON.stringify(input.outcomes), input.effectiveTerm, input.rationale])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) forbid(out);
      const [k, id] = out.split(':');
      result = { id: Number(id), replayed: k === 'replay' };
      if (k === 'ok') await audit(a, 'Program version proposed', `program:${id}`, `${input.code} for ${input.effectiveTerm}`, 'Department chair');
    }
    if (input.action === 'step') {
      const before = ((await sql.query(`SELECT author_id FROM prg_programs WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Program not found.');
      fail(((await sql.query(`SELECT prg_step($1,$2,$3,$4,$5,$6,$7) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.note, isRegistrar])) as { e: string | null }[])[0].e);
      await audit(a, `Program: ${input.step}`, `program:${input.id}`, input.note.slice(0, 200), input.step === 'publish' ? 'Registrar' : input.step === 'approve' ? 'Curriculum committee' : input.step === 'withdraw' ? 'Department chair' : 'Reviewer');
      if (String(before!.author_id) !== me) await zite.messages.create({ record: { body: 'There is an update to your program proposal in Semester (Programs).', sender: me, recipients: [String(before!.author_id)], isNotification: true } as never }).catch(() => undefined);
    }

    const depts = (await sql.query(`SELECT id, name, chair_id FROM inst_departments WHERE tenant_id = $1 AND active ORDER BY name`, [T])) as Row[];
    const chairOf = depts.filter((d) => d.chair_id === me).map((d) => Number(d.id));
    const rows = (await sql.query(`SELECT p.*, d.name AS dept FROM prg_programs p JOIN inst_departments d ON d.id = p.department_id WHERE p.tenant_id = $1
      AND (p.state = 'published' OR p.department_id = ANY($2::bigint[]) OR $3 OR $4) ORDER BY p.code, p.version DESC LIMIT 500`, [T, chairOf, isCommittee, isRegistrar])) as Row[];
    const catalog = (await sql.query(`SELECT code, credits FROM prg_catalog($1) ORDER BY code`, [T])) as Row[];
    const names = await userNames([...new Set(rows.map((r) => String(r.author_id)))]);

    return {
      result, isCommittee, isRegistrar, chairOf,
      departments: depts.filter((d) => chairOf.includes(Number(d.id))).map((d) => ({ id: Number(d.id), name: String(d.name) })),
      catalog: catalog.map((c) => ({ code: String(c.code), credits: Number(c.credits) })),
      programs: rows.map((r) => {
        const mine = r.author_id === me;
        const state = String(r.state);
        const steps = mine ? (['submitted', 'committee_approved'].includes(state) ? ['withdraw'] : [])
          : [...(isCommittee && state === 'submitted' ? ['approve', 'return'] : []), ...(isRegistrar && state === 'committee_approved' && r.committee_by !== me ? ['publish', 'return'] : [])];
        return {
          id: Number(r.id), mine, steps, author: names[String(r.author_id)] ?? 'Chair', dept: String(r.dept), code: String(r.code), version: Number(r.version), name: String(r.name),
          credential: String(r.credential), totalCredits: Number(r.total_credits), termCap: Number(r.term_cap), terms: r.terms as string[][], outcomes: r.outcomes as { text: string; courses: string[] }[],
          effectiveTerm: String(r.effective_term), rationale: String(r.rationale), state, rowVersion: Number(r.row_version), note: String(r.note), updatedAt: iso(r.updated_at),
        };
      }),
    };
  },
});
