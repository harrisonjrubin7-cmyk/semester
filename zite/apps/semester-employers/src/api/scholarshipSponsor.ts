import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/hiring';
import { SCH_MIGRATION } from '../../../semester/src/lib/schMigration';

type Row = Record<string, unknown>;
const deny = (m: string): never => { const e = new ZiteError(m); (e as unknown as { userFacingMessage: string }).userFacingMessage = m; throw e; };
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of SCH_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
const NOTE = 'There is an update to your scholarship application in Semester. Open Scholarships to see it.';

// Scholarship sponsors (role register: Scholarship Provider). A sponsor saves its organization, asks an institution's
// scholarship office to verify it, then runs programs there, reviews applicants and decides renewals. The sponsor sees only
// what each applicant consented to share: name, email and statement — never grades or institutional records. Awards and
// renewals are handed to the institution's financial aid office, which records the hand-off; no money moves here.
export default createEndpoint({
  description: 'Scholarship sponsors: organization profile, institution verification, programs, applicant review, awards, renewals',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('profile'), orgName: z.string().min(2).max(160), website: z.string().max(300).default(''), about: z.string().max(2000).default('') }),
    z.object({ action: z.literal('requestLink'), institutionId: z.string().min(1).max(64) }),
    z.object({ action: z.literal('program'), id: z.number().int().nullable().default(null), institutionId: z.string().min(1).max(64), name: z.string().min(3).max(120),
      amountCents: z.number().int().min(100).max(10000000), awards: z.number().int().min(1).max(1000), criteria: z.string().min(20).max(4000),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), renewable: z.boolean(), active: z.boolean(), expectedVersion: z.number().int().default(0) }),
    z.object({ action: z.literal('decide'), id: z.number().int(), step: z.enum(['shortlist', 'award', 'not_select']), expectedVersion: z.number().int(), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('renewal'), id: z.number().int(), step: z.enum(['approve', 'deny']), expectedVersion: z.number().int(), note: z.string().max(500).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await ensure();
    const sql = pg();
    const one = async (q: string, p: unknown[]) => { const r = (await sql.query(q, p)) as { e: string | null }[]; if (r[0].e) deny(r[0].e); };
    const institutions = (await zite.institutions.findAll({ limit: 500, fields: ['name', 'tenantType'] })).records.filter((i) => i.tenantType && i.tenantType !== 'Personal');
    const instName = Object.fromEntries(institutions.map((i) => [i.id, i.name ?? 'Institution']));
    const recipientOf = async (appId: number) => String(((await sql.query(`SELECT student_id FROM sch_apps WHERE id = $1`, [appId])) as Row[])[0]?.student_id ?? '');

    if (input.action === 'profile') await one(`SELECT sch_sponsor_save($1,$2,$3,$4) AS e`, [me, input.orgName, input.website, input.about]);
    if (input.action === 'requestLink') {
      if (!instName[input.institutionId]) deny('Choose an institution from the list.');
      await one(`SELECT sch_link_request($1,$2) AS e`, [me, input.institutionId]);
    }
    if (input.action === 'program') await one(`SELECT sch_program($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11) AS e`, [me, input.id, input.institutionId, input.name, input.amountCents, input.awards, input.criteria, input.deadline, input.renewable, input.active, input.expectedVersion]);
    if (input.action === 'decide') {
      await one(`SELECT sch_step($1,$2,$3,$4,$5) AS e`, [input.id, me, input.step, input.expectedVersion, input.note]);
      const to = await recipientOf(input.id);
      if (to && input.step !== 'shortlist') await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [to], isNotification: true } as never }).catch(() => undefined);
    }
    if (input.action === 'renewal') {
      await one(`SELECT sch_renew_step($1,$2,$3,$4,$5) AS e`, [input.id, me, input.step, input.expectedVersion, input.note]);
      const app = ((await sql.query(`SELECT app_id FROM sch_renewals WHERE id = $1`, [input.id])) as Row[])[0];
      const to = app ? await recipientOf(Number(app.app_id)) : '';
      if (to) await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [to], isNotification: true } as never }).catch(() => undefined);
    }

    const sponsor = ((await sql.query(`SELECT * FROM sch_sponsors WHERE owner_id = $1`, [me])) as Row[])[0] ?? null;
    if (!sponsor) return { sponsor: null, institutions: institutions.map((i) => ({ id: i.id, name: i.name ?? 'Institution' })), links: [], programs: [] };
    const sid = Number(sponsor.id);
    const links = (await sql.query(`SELECT * FROM sch_links WHERE sponsor_id = $1`, [sid])) as Row[];
    const programs = (await sql.query(`SELECT * FROM sch_programs WHERE sponsor_id = $1 ORDER BY deadline DESC`, [sid])) as Row[];
    const apps = programs.length ? (await sql.query(`SELECT id, program_id, student_id, statement, state, version, note FROM sch_apps WHERE program_id = ANY($1::bigint[]) ORDER BY created_at`, [programs.map((p) => Number(p.id))])) as Row[] : [];
    const renewals = apps.length ? (await sql.query(`SELECT * FROM sch_renewals WHERE app_id = ANY($1::bigint[]) ORDER BY created_at`, [apps.map((x) => Number(x.id))])) as Row[] : [];
    const ids = [...new Set(apps.map((x) => String(x.student_id)))];
    const users = ids.length ? (await zite.sql({ query: `SELECT "id","name","email" FROM "ziteUsers" WHERE "id" = ANY($1)`, params: [ids] })).rows as Row[] : [];
    const who = (id: string) => { const u = users.find((r) => r.id === id); return { name: String(u?.name || 'Applicant'), email: String(u?.email || '') }; };

    return {
      sponsor: { orgName: String(sponsor.org_name), website: String(sponsor.website), about: String(sponsor.about) },
      institutions: institutions.map((i) => ({ id: i.id, name: i.name ?? 'Institution' })),
      links: links.map((l) => ({ institutionId: String(l.tenant_id), institution: instName[String(l.tenant_id)] ?? 'Institution', state: String(l.state), note: String(l.note) })),
      programs: programs.map((p) => ({
        id: Number(p.id), version: Number(p.version), institutionId: String(p.tenant_id), institution: instName[String(p.tenant_id)] ?? 'Institution', name: String(p.name), amountCents: Number(p.amount_cents),
        awards: Number(p.awards), criteria: String(p.criteria), deadline: day(p.deadline), renewable: !!p.renewable, active: !!p.active,
        applicants: apps.filter((x) => Number(x.program_id) === Number(p.id)).map((x) => ({
          id: Number(x.id), ...who(String(x.student_id)), statement: String(x.statement), state: String(x.state), version: Number(x.version), note: String(x.note),
          renewals: renewals.filter((r) => Number(r.app_id) === Number(x.id)).map((r) => ({ id: Number(r.id), term: String(r.term), statement: String(r.statement), state: String(r.state), version: Number(r.version), note: String(r.note) })),
        })),
      })),
    };
  },
});
