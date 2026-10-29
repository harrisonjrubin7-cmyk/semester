import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, ids, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { GAS_MIGRATION, GAS_KINDS } from '../lib/gasMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of GAS_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Graduate assistantships (gas-001). The membership decides who may post (Faculty, Staff, Administrator) and apply (Student;
// the institution has no separate graduate marker yet, so the page says these are graduate positions). No money moves.
export default createEndpoint({
  description: 'Graduate assistantships: postings, applications, frozen offers, a 20-hour cap per term, graduate-office confirmation; official funding view',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('post'), kind: z.enum(GAS_KINDS), title: z.string().max(140), unit: z.string().max(120), term: z.string().max(40), hours: z.number().min(5).max(20),
      stipendMinor: z.number().int().min(0).max(100_000_000), tuitionRemission: z.boolean(), duties: z.string().max(4000), openings: z.number().int().min(1).max(50) }),
    z.object({ action: z.literal('apply'), postingId: z.number().int(), statement: z.string().max(2000) }),
    z.object({ action: z.literal('step'), step: z.enum(['offer', 'pass', 'accept', 'decline', 'withdraw', 'confirm', 'end']), id: z.number().int(), version: z.number().int(), note: z.string().max(1000).optional() }),
    z.object({ action: z.literal('close'), postingId: z.number().int() }),
    z.object({ action: z.literal('officer'), email: z.string().email().max(200), on: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const staff = a.roles.some((r) => ['Faculty', 'Staff', 'Administrator'].includes(r));
    const student = a.roles.includes('Student');
    const officer = ((await sql.query(`SELECT gas_is_officer($1,$2) AS o`, [T, me])) as { o: boolean }[])[0].o;
    const call = async (q: string, p: unknown[]) => { const r = ((await sql.query(q, p)) as { r: string | null }[])[0].r; if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.'); return r!.slice(3); };

    if (input.action === 'post') {
      const { action: _a, ...p } = input;
      const id = await call(`SELECT gas_post($1,$2,$3,$4::jsonb) AS r`, [T, me, staff, JSON.stringify(p)]);
      await audit(a, 'Assistantship posted', `gas-posting:${id}`, input.title, 'Faculty/Staff');
    } else if (input.action === 'apply') {
      await call(`SELECT gas_apply($1,$2,$3,$4,$5) AS r`, [T, me, student, input.postingId, input.statement]);
    } else if (input.action === 'step') {
      const row = ((await sql.query(`SELECT a.student_id, p.poster_id FROM gas_applications a JOIN gas_postings p ON p.id = a.posting_id WHERE a.id = $1 AND p.tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!row) forbid('Application not found.');
      await call(`SELECT gas_step($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.step, input.id, input.version, input.note ?? '']);
      const to = ['offer', 'pass', 'confirm', 'end'].includes(input.step) ? String(row!.student_id) : String(row!.poster_id);
      const word: Record<string, string> = { offer: 'You have an assistantship offer.', pass: 'An assistantship you applied for went to someone else.', confirm: 'Your assistantship is confirmed by the graduate office.',
        end: 'Your assistantship was ended by the graduate office.', accept: 'A student accepted your assistantship offer.', decline: 'A student declined your assistantship offer.', withdraw: 'A student withdrew an application.' };
      await zite.messages.create({ record: { body: `${word[input.step]} Open Assistantships in Semester.`, sender: me, recipients: [to], isNotification: true, read: false } as never });
      if (['offer', 'confirm', 'end'].includes(input.step)) await audit(a, `Assistantship ${input.step}`, `gas-application:${input.id}`, input.note ?? '', input.step === 'offer' ? 'Hiring faculty' : 'Graduate office');
    } else if (input.action === 'close') {
      await call(`SELECT gas_close($1,$2,$3) AS r`, [T, me, input.postingId]);
    } else if (input.action === 'officer') {
      const u = (await zite.auth.findAllUsers({ limit: 500 })).records.find((x) => (x.email ?? '').toLowerCase() === input.email.toLowerCase());
      if (!u) forbid('No user with that email.');
      const m = (await zite.memberships.findAll({ filters: { institution: T }, limit: 2000 })).records.some((x) => ids(x.member).includes(u!.id) && x.status === 'Active');
      if (!m) forbid('That person is not an active member of this institution.');
      await call(`SELECT gas_set_officer($1,$2,$3,$4,$5) AS r`, [T, me, isAdmin, u!.id, input.on]);
      await audit(a, input.on ? 'Graduate-office officer appointed' : 'Graduate-office officer removed', `user:${u!.id}`, '', 'Administrator');
    }

    const [postings, apps, offs] = await Promise.all([
      sql.query(`SELECT * FROM gas_postings WHERE tenant_id = $1 AND (state = 'open' OR poster_id = $2) ORDER BY created_at DESC LIMIT 200`, [T, me]) as Promise<Row[]>,
      sql.query(`SELECT a.*, p.poster_id, p.title, p.term, p.tenant_id FROM gas_applications a JOIN gas_postings p ON p.id = a.posting_id WHERE p.tenant_id = $1
        AND (a.student_id = $2 OR p.poster_id = $2 OR ($3 AND a.state IN ('accepted', 'confirmed', 'ended'))) ORDER BY a.created_at DESC LIMIT 500`, [T, me, officer]) as Promise<Row[]>,
      (isAdmin || officer) ? sql.query(`SELECT user_id FROM gas_officers WHERE tenant_id = $1 AND revoked_at IS NULL`, [T]) as Promise<Row[]> : Promise.resolve([] as Row[]),
    ]);
    const names = await userNames([...apps.map((x) => String(x.student_id)), ...postings.map((p) => String(p.poster_id)), ...offs.map((o) => String(o.user_id))]);
    const nm = (id: unknown) => names[String(id)] ?? 'Member';
    const mine = apps.filter((x) => x.student_id === me);
    const confirmed = mine.filter((x) => x.state === 'confirmed').map((x) => x.offer as Record<string, unknown>);
    return {
      me, staff, student, officer, isAdmin, kinds: GAS_KINDS, officers: offs.map((o) => nm(o.user_id)),
      postings: postings.map((p) => ({ id: Number(p.id), kind: String(p.kind), title: String(p.title), unit: String(p.unit), term: String(p.term), hours: Number(p.hours), stipendMinor: Number(p.stipend_minor),
        tuitionRemission: !!p.tuition_remission, duties: String(p.duties), openings: Number(p.openings), state: String(p.state), poster: nm(p.poster_id), mine: p.poster_id === me,
        applied: mine.some((x) => Number(x.posting_id) === Number(p.id)) })),
      applications: apps.map((x) => ({ id: Number(x.id), postingId: Number(x.posting_id), title: String(x.title), term: String(x.term), student: x.student_id === me ? 'You' : nm(x.student_id),
        mineAsStudent: x.student_id === me, mineAsPoster: x.poster_id === me, statement: x.poster_id === me || x.student_id === me ? String(x.statement) : '', state: String(x.state),
        offer: x.offer ?? null, endReason: String(x.end_reason), version: Number(x.version), at: iso(x.created_at) })),
      // Official funding: confirmed appointments only (personal funding notes stay on the Graduate milestones page).
      funding: { appointments: confirmed.length, stipendMinor: confirmed.reduce((s, o) => s + Number(o.stipendMinor ?? 0), 0), tuitionRemitted: confirmed.some((o) => !!o.tuitionRemission),
        byTerm: [...new Set(mine.filter((x) => ['accepted', 'confirmed'].includes(String(x.state))).map((x) => String(x.term)))].map((t) => ({ term: t,
          hours: mine.filter((x) => String(x.term) === t && ['accepted', 'confirmed'].includes(String(x.state))).reduce((s, x) => s + Number((x.offer as Record<string, unknown>)?.hours ?? 0), 0) })) },
    };
  },
});
