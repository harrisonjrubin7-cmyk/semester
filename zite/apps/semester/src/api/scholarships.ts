import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg, sha256 } from '../lib/pg';
import { SCH_MIGRATION } from '../lib/schMigration';
import { consentText, openSteps, AppState } from '../lib/scholarshipRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of SCH_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const NOTE = 'There is an update to your scholarship application in Semester. Open Scholarships to see it.';

// Scholarships, institution side. Students see open programs from sponsors their institution has verified, apply with
// explicit consent (name, email and statement only — no institutional records), accept or decline awards and ask to renew.
// The scholarship office (granted by an administrator) verifies sponsors for this institution and records disbursement
// hand-offs to financial aid; a hand-off moves no money. Sponsors work in Semester Employers (api/scholarshipSponsor there).
export default createEndpoint({
  description: 'Scholarships: browse and apply with consent, accept awards, renew; office verifies sponsors and hands awards to financial aid',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('apply'), requestKey: z.string().min(8).max(100), programId: z.number().int(), statement: z.string().min(50).max(4000), consent: z.literal(true) }),
    z.object({ action: z.literal('step'), id: z.number().int(), step: z.enum(['withdraw', 'accept', 'decline_award', 'handoff']), expectedVersion: z.number().int(), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('renew'), id: z.number().int(), term: z.string().min(2).max(40), statement: z.string().min(20).max(2000) }),
    z.object({ action: z.literal('renewHandoff'), id: z.number().int(), expectedVersion: z.number().int(), note: z.string().min(5).max(500) }),
    z.object({ action: z.literal('verify'), sponsorId: z.number().int(), decision: z.enum(['verify', 'reject', 'suspend']), expectedVersion: z.number().int(), note: z.string().min(10).max(1000) }),
    z.object({ action: z.literal('setOffice'), email: z.string().email().max(200), on: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const isOffice = !!((await sql.query(`SELECT sch_is_office($1,$2) AS ok`, [T, me])) as { ok: boolean }[])[0]?.ok;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    let result: unknown = null;

    if (input.action === 'setOffice') {
      if (!isAdmin) forbid('Only administrators manage scholarship-office access.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(((await sql.query(`SELECT sch_set_office($1,$2,$3,$4) AS e`, [me, T, uid, input.on])) as { e: string | null }[])[0].e);
      await audit(a, input.on ? 'Scholarship office access granted' : 'Scholarship office access revoked', `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'verify') {
      fail(((await sql.query(`SELECT sch_link_decide($1,$2,$3,$4,$5,$6) AS e`, [T, me, input.sponsorId, input.decision, input.expectedVersion, input.note])) as { e: string | null }[])[0].e);
      await audit(a, `Scholarship sponsor: ${input.decision}`, `sponsor:${input.sponsorId}`, input.note.slice(0, 200), 'Scholarship office');
    }
    if (input.action === 'apply') {
      // The consent hash is computed here from the sponsor and program the student saw, so it cannot be forged client-side.
      const p = ((await sql.query(`SELECT p.name, s.org_name FROM sch_programs p JOIN sch_sponsors s ON s.id = p.sponsor_id WHERE p.id = $1 AND p.tenant_id = $2`, [input.programId, T])) as Row[])[0];
      if (!p) forbid('Scholarship not found.');
      const consent = await sha256(consentText(String(p!.org_name), String(p!.name)));
      const out = ((await sql.query(`SELECT sch_apply($1,$2,$3,$4,$5,$6,$7::date) AS r`, [T, input.requestKey, me, input.programId, input.statement, consent, new Date().toISOString().slice(0, 10)])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) forbid(out);
      const [k, id] = out.split(':');
      result = { id: Number(id), replayed: k === 'replay' };
      if (k === 'ok') await audit(a, 'Scholarship application submitted with consent', `scholarshipApp:${id}`, `program ${input.programId}`, 'Student');
    }
    if (input.action === 'step') {
      const before = ((await sql.query(`SELECT student_id FROM sch_apps WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Application not found.');
      fail(((await sql.query(`SELECT sch_step($1,$2,$3,$4,$5) AS e`, [input.id, me, input.step, input.expectedVersion, input.note])) as { e: string | null }[])[0].e);
      const self = String(before!.student_id) === me;
      await audit(a, `Scholarship: ${input.step.replace('_', ' ')}`, `scholarshipApp:${input.id}`, input.note.slice(0, 200), self ? 'Student' : 'Scholarship office');
      if (!self) await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [String(before!.student_id)], isNotification: true } as never }).catch(() => undefined);
    }
    if (input.action === 'renew') {
      const own = ((await sql.query(`SELECT 1 FROM sch_apps WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!own) forbid('Application not found.');
      fail(((await sql.query(`SELECT sch_renew_request($1,$2,$3,$4) AS e`, [me, input.id, input.term, input.statement])) as { e: string | null }[])[0].e);
      await audit(a, 'Scholarship renewal requested', `scholarshipApp:${input.id}`, input.term, 'Student');
    }
    if (input.action === 'renewHandoff') {
      const own = ((await sql.query(`SELECT 1 FROM sch_renewals r JOIN sch_apps a ON a.id = r.app_id WHERE r.id = $1 AND a.tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!own) forbid('Renewal not found.');
      fail(((await sql.query(`SELECT sch_renew_step($1,$2,'handoff',$3,$4) AS e`, [input.id, me, input.expectedVersion, input.note])) as { e: string | null }[])[0].e);
      await audit(a, 'Scholarship renewal handed to financial aid', `scholarshipRenewal:${input.id}`, input.note.slice(0, 200), 'Scholarship office');
    }

    const today = new Date().toISOString().slice(0, 10);
    const programs = (await sql.query(`SELECT p.*, s.org_name, s.website, (SELECT count(*) FROM sch_apps x WHERE x.program_id = p.id AND x.state IN ('awarded','accepted','handed_off'))::int AS made
      FROM sch_programs p JOIN sch_sponsors s ON s.id = p.sponsor_id JOIN sch_links l ON l.sponsor_id = p.sponsor_id AND l.tenant_id = p.tenant_id
      WHERE p.tenant_id = $1 AND p.active AND l.state = 'verified' ORDER BY p.deadline`, [T])) as Row[];
    const apps = (await sql.query(`SELECT a.*, p.name AS pname, p.amount_cents, p.renewable, s.org_name FROM sch_apps a JOIN sch_programs p ON p.id = a.program_id JOIN sch_sponsors s ON s.id = p.sponsor_id
      WHERE a.tenant_id = $1 AND (a.student_id = $2 OR ($3 AND a.state IN ('accepted','handed_off'))) ORDER BY a.updated_at DESC LIMIT 500`, [T, me, isOffice])) as Row[];
    const renewals = apps.length ? (await sql.query(`SELECT * FROM sch_renewals WHERE app_id = ANY($1::bigint[]) ORDER BY created_at`, [apps.map((x) => Number(x.id))])) as Row[] : [];
    const links = isOffice ? (await sql.query(`SELECT l.*, s.org_name, s.website, s.about FROM sch_links l JOIN sch_sponsors s ON s.id = l.sponsor_id WHERE l.tenant_id = $1 ORDER BY l.state, l.updated_at DESC`, [T])) as Row[] : [];
    const office = isAdmin ? (await sql.query(`SELECT user_id FROM sch_office WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const names = await userNames([...new Set([...apps.map((x) => String(x.student_id)), ...office.map((x) => String(x.user_id))])]);
    const applied = new Set(apps.filter((x) => x.student_id === me).map((x) => Number(x.program_id)));

    return {
      result, isOffice, isAdmin,
      programs: programs.map((p) => ({ id: Number(p.id), name: String(p.name), sponsor: String(p.org_name), website: String(p.website), amountCents: Number(p.amount_cents), awards: Number(p.awards),
        made: Number(p.made), criteria: String(p.criteria), deadline: day(p.deadline), renewable: !!p.renewable, open: (day(p.deadline) ?? '') >= today, applied: applied.has(Number(p.id)),
        consent: consentText(String(p.org_name), String(p.name)) })),
      applications: apps.map((x) => ({
        id: Number(x.id), mine: x.student_id === me, student: names[String(x.student_id)] ?? 'Student', program: String(x.pname), sponsor: String(x.org_name), amountCents: Number(x.amount_cents),
        renewable: !!x.renewable, state: String(x.state), version: Number(x.version), note: String(x.note), handoffAt: iso(x.handoff_at), updatedAt: iso(x.updated_at),
        steps: openSteps(String(x.state) as AppState, x.student_id === me ? 'student' : 'office'),
        renewals: renewals.filter((r) => Number(r.app_id) === Number(x.id)).map((r) => ({ id: Number(r.id), term: String(r.term), state: String(r.state), version: Number(r.version), note: String(r.note) })),
      })),
      sponsors: links.map((l) => ({ id: Number(l.sponsor_id), org: String(l.org_name), website: String(l.website), about: String(l.about), state: String(l.state), version: Number(l.version), note: String(l.note) })),
      office: office.map((o) => ({ name: names[String(o.user_id)] ?? 'Member' })),
    };
  },
});
