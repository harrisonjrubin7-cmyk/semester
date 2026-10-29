import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { CAR_MIGRATION } from '../lib/carMigration';
import { ALU_MIGRATION } from '../lib/aluMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...CAR_MIGRATION, ...ALU_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Alumni network (alu-001): opt-in directory, connections, reviewed opportunities, mentors' open slots (booked through help.ts), and the alumnus's own
// record summary. Alumni / student status comes from the server-resolved membership, never from the client.
export default createEndpoint({
  description: 'Alumni network: opt-in directory, connections, career-center-reviewed opportunities, open mentor slots and own credentials',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('profile'), headline: z.string().max(120), field: z.string().max(80), gradYear: z.number().int().nullable(), listed: z.boolean(),
      audience: z.enum(['alumni', 'alumni_and_students']), openToConnect: z.boolean(), openToMentor: z.boolean(), version: z.number().int().nullable() }),
    z.object({ action: z.literal('connect'), target: z.string().max(40), note: z.string().max(300) }),
    z.object({ action: z.literal('respond'), id: z.number().int(), step: z.enum(['accept', 'decline', 'block', 'withdraw']) }),
    z.object({ action: z.literal('post'), kind: z.enum(['job', 'internship', 'project', 'volunteer', 'event']), title: z.string().max(140), org: z.string().max(120),
      body: z.string().max(4000), url: z.string().max(500), audience: z.enum(['students', 'alumni', 'both']), expiresAt: z.string().max(40) }),
    z.object({ action: z.literal('review'), id: z.number().int(), step: z.enum(['approve', 'reject', 'close']), note: z.string().max(500) }),
    z.object({ action: z.literal('interest'), id: z.number().int(), on: z.boolean(), shareName: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const alumni = a.roles.includes('Alumni'), student = a.roles.includes('Student');
    const center = ((await sql.query(`SELECT car_has($1,$2,'center') AS c`, [T, me])) as { c: boolean }[])[0].c;
    if (!alumni && !student && !center) forbid('The alumni network is for alumni, students and career center staff.');
    const call = async (q: string, p: unknown[]) => { const r = ((await sql.query(q, p)) as { r: string | null }[])[0].r; if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.'); return r!.slice(3); };

    if (input.action === 'profile') {
      const { action: _a, ...p } = input;
      await call(`SELECT alu_profile($1,$2,$3,$4::jsonb) AS r`, [T, me, alumni, JSON.stringify(p)]);
    } else if (input.action === 'connect') {
      await call(`SELECT alu_connect($1,$2,$3,$4,$5,$6) AS r`, [T, me, alumni, student, input.target, input.note]);
    } else if (input.action === 'respond') {
      await call(`SELECT alu_respond($1,$2,$3,$4) AS r`, [T, me, input.id, input.step]);
    } else if (input.action === 'post') {
      const { action: _a, ...p } = input;
      const id = await call(`SELECT alu_post($1,$2,$3,$4::jsonb) AS r`, [T, me, alumni, JSON.stringify(p)]);
      await audit(a, 'Alumni opportunity posted for review', `alu-opp:${id}`, input.title, 'Alumni');
    } else if (input.action === 'review') {
      await call(`SELECT alu_review($1,$2,$3,$4,$5) AS r`, [T, me, input.id, input.step, input.note]);
      await audit(a, `Alumni opportunity ${input.step}`, `alu-opp:${input.id}`, input.note, center ? 'Career center staff' : 'Alumni');
    } else if (input.action === 'interest') {
      await call(`SELECT alu_interest_set($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, alumni, student, input.id, input.on, input.shareName]);
    }

    // ---- read model ----
    const [mineP, profiles, conns, opps, interest] = await Promise.all([
      sql.query(`SELECT * FROM alu_profiles WHERE tenant_id = $1 AND user_id = $2`, [T, me]) as Promise<Row[]>,
      sql.query(`SELECT f.* FROM alu_profiles f WHERE f.tenant_id = $1 AND f.user_id <> $2 AND alu_visible($1, $2, $3, $4, f.user_id) ORDER BY f.updated_at DESC LIMIT 200`, [T, me, alumni, student]) as Promise<Row[]>,
      sql.query(`SELECT * FROM alu_connections WHERE tenant_id = $1 AND (from_id = $2 OR to_id = $2) AND state IN ('requested', 'accepted') ORDER BY id DESC`, [T, me]) as Promise<Row[]>,
      sql.query(`SELECT o.*, alu_opp_live(o) AS live, (SELECT count(*) FROM alu_interest i WHERE i.opportunity_id = o.id)::int AS interested FROM alu_opportunities o
        WHERE o.tenant_id = $1 AND (o.poster_id = $2 OR ($5 AND o.state = 'pending') OR (alu_opp_live(o) AND NOT alu_blocked($1, $2, o.poster_id)
          AND (($4 AND o.audience IN ('students', 'both')) OR ($3 AND o.audience IN ('alumni', 'both'))))) ORDER BY o.id DESC LIMIT 200`, [T, me, alumni, student, center]) as Promise<Row[]>,
      sql.query(`SELECT i.* FROM alu_interest i JOIN alu_opportunities o ON o.id = i.opportunity_id WHERE o.tenant_id = $1 AND (i.user_id = $2 OR o.poster_id = $2)`, [T, me]) as Promise<Row[]>,
    ]);
    const mentors = profiles.filter((f) => f.open_to_mentor && f.audience === 'alumni_and_students').map((f) => String(f.user_id));
    const slots = student && mentors.length
      ? (await Promise.all(mentors.map((h) => zite.appointments.findAll({ filters: { host: h, kind: 'Mentoring' }, limit: 100 })))).flatMap((r) => r.records)
        .filter((s) => (s.status === 'Open Slot' || ids(s.attendee).includes(me)) && s.startsAt && new Date(s.startsAt).getTime() > Date.now())
      : [];
    const names = await userNames([...profiles.map((f) => String(f.user_id)), ...conns.flatMap((c) => [String(c.from_id), String(c.to_id)]), ...opps.map((o) => String(o.poster_id)),
      ...interest.map((i) => String(i.user_id)), ...slots.map((s) => first(s.host) ?? '')]);
    const nm = (id: unknown) => names[String(id)] ?? 'Member';

    // The alumnus's own record: completed courses, continuing-education credentials and verified portfolio items.
    let record: unknown = null;
    if (alumni) {
      const enr = (await zite.enrollments.findAll({ filters: { student: me }, limit: 300 })).records.filter((e) => e.status === 'Completed');
      const secs = await Promise.all(enr.map((e) => zite.sections.findOne({ id: first(e.section)! })));
      const has = async (t: string) => ((await sql.query(`SELECT to_regclass($1) IS NOT NULL AS h`, [t])) as { h: boolean }[])[0].h;
      const creds = (await has('cne_credentials')) ? (await sql.query(`SELECT title, verify_code, issued_at, revoked_at FROM cne_credentials WHERE tenant_id = $1 AND learner_id = $2 ORDER BY issued_at DESC`, [T, me])) as Row[] : [];
      const verified = (await has('vfy_claims')) ? (await sql.query(`SELECT item_id FROM vfy_claims WHERE tenant_id = $1 AND student_id = $2 AND state = 'Verified'`, [T, me])) as Row[] : [];
      const items = (await zite.resources.findAll({ filters: { owner: me, kind: 'Portfolio Item' }, limit: 200 })).records;
      record = {
        courses: secs.map((s) => (s?.label ?? 'Course').split(' · ')[0]),
        credentials: creds.map((c) => ({ title: String(c.title), code: String(c.verify_code), issuedAt: iso(c.issued_at), revoked: !!c.revoked_at })),
        portfolio: items.map((r) => ({ id: r.id, title: r.title ?? 'Untitled', verified: verified.some((v) => String(v.item_id) === r.id) })),
      };
    }
    const p = mineP[0];
    return {
      me, alumni, student, center,
      profile: p ? { headline: String(p.headline), field: String(p.field), gradYear: p.grad_year == null ? null : Number(p.grad_year), listed: !!p.listed, audience: String(p.audience),
        openToConnect: !!p.open_to_connect, openToMentor: !!p.open_to_mentor, version: Number(p.version) } : null,
      directory: profiles.map((f) => ({ id: String(f.user_id), name: nm(f.user_id), headline: String(f.headline), field: String(f.field), gradYear: f.grad_year == null ? null : Number(f.grad_year),
        openToConnect: !!f.open_to_connect, openToMentor: !!f.open_to_mentor,
        link: (() => { const c = conns.find((x) => [x.from_id, x.to_id].includes(f.user_id)); return c ? String(c.state) : null; })() })),
      connections: conns.map((c) => ({ id: Number(c.id), other: nm(c.from_id === me ? c.to_id : c.from_id), incoming: c.to_id === me, state: String(c.state), note: String(c.note), at: iso(c.created_at) })),
      opportunities: opps.map((o) => ({ id: Number(o.id), kind: String(o.kind), title: String(o.title), org: String(o.org), body: String(o.body), url: (o.url as string) ?? null, audience: String(o.audience),
        state: String(o.state), live: !!o.live, expiresAt: iso(o.expires_at), poster: nm(o.poster_id), mine: o.poster_id === me, reviewNote: String(o.review_note),
        interested: o.poster_id === me ? Number(o.interested) : undefined,
        sharedNames: o.poster_id === me ? interest.filter((i) => Number(i.opportunity_id) === Number(o.id) && i.share_name).map((i) => nm(i.user_id)) : undefined,
        myInterest: (() => { const i = interest.find((x) => Number(x.opportunity_id) === Number(o.id) && x.user_id === me); return i ? { shareName: !!i.share_name } : null; })() })),
      slots: slots.map((s) => ({ id: s.id, label: s.label ?? 'Mentoring', startsAt: s.startsAt ?? null, mentor: nm(first(s.host)), mine: ids(s.attendee).includes(me) }))
        .sort((x, y) => (x.startsAt ?? '').localeCompare(y.startsAt ?? '')),
      record,
    };
  },
});
