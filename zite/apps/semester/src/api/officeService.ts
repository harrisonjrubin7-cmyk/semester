import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { OSV_MIGRATION } from '../lib/osvMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of OSV_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const STEPS = ['claim', 'assign', 'ask', 'reply', 'note', 'refer', 'resolve', 'confirm', 'reopen', 'withdraw'] as const;
const ASTEPS = ['draft', 'edit', 'submit', 'publish', 'return', 'revise', 'retire'] as const;

// Office service (role app "University Staff"): office queues, requests, knowledge articles and resolution.
// Institution and roles come from the server (requireAccess); every rule is enforced in lib/osvMigration.ts.
export default createEndpoint({
  description: 'Office service: send requests to an office, office queues, resolution, and reviewed knowledge articles',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('office'), id: z.number().int().nullable(), name: z.string().min(2).max(80), description: z.string().max(600).default(''), hours: z.string().max(120).default(''), active: z.boolean() }),
    z.object({ action: z.literal('setStaff'), officeId: z.number().int(), email: z.string().email().max(200), lead: z.boolean(), active: z.boolean() }),
    z.object({ action: z.literal('open'), requestKey: z.string().min(8).max(100), officeId: z.number().int(), title: z.string().min(5).max(140), details: z.string().max(4000).default('') }),
    z.object({ action: z.literal('step'), id: z.number().int(), step: z.enum(STEPS), expectedVersion: z.number().int(), note: z.string().max(4000).default(''), outcome: z.string().max(20).optional(), assigneeId: z.string().max(100).optional(), officeId: z.number().int().optional() }),
    z.object({ action: z.literal('article'), step: z.enum(ASTEPS), id: z.number().int().nullable(), expectedVersion: z.number().int().nullable(), officeId: z.number().int().optional(), title: z.string().max(140).optional(), body: z.string().max(20000).optional(), seenHash: z.string().max(64).optional(), note: z.string().max(1000).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;

    if (input.action === 'office') {
      const r = await one(`SELECT osv_office($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [T, me, isAdmin, input.id, input.name, input.description, input.hours, input.active]);
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save the office.');
      await audit(a, 'Office saved', `office:${r!.slice(3)}`, input.name, 'Administrator');
    }
    if (input.action === 'setStaff') {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      const r = await one(`SELECT osv_set_staff($1,$2,$3,$4,$5,$6,$7) AS r`, [me, isAdmin, T, input.officeId, uid, input.lead, input.active]);
      if (r) forbid(r);
      await audit(a, 'Office staff changed', `user:${uid}`, `office ${input.officeId}: ${input.active ? (input.lead ? 'lead' : 'staff') : 'revoked'}`, 'Administrator');
    }
    if (input.action === 'open') {
      const r = await one(`SELECT osv_open($1,$2,$3,$4,$5,$6) AS r`, [T, input.requestKey, me, input.officeId, input.title, input.details]);
      if (!r || !(r.startsWith('ok:') || r.startsWith('replay:'))) forbid(r ?? 'Could not send the request.');
    }
    if (input.action === 'step') {
      const r = await one(`SELECT osv_step($1,$2,$3,$4,$5,$6,$7,$8,$9) AS r`, [T, input.id, me, input.step, input.expectedVersion, input.note, input.outcome ?? null, input.assigneeId ?? null, input.officeId ?? null]);
      if (r) forbid(r);
      if (input.step === 'resolve' || input.step === 'refer') await audit(a, `Office request ${input.step}`, `officeRequest:${input.id}`, input.outcome ?? '', 'Office staff');
    }
    if (input.action === 'article') {
      const r = await one(`SELECT osv_article($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS r`, [T, me, input.step, input.id, input.expectedVersion, input.officeId ?? null, input.title ?? null, input.body ?? null, input.seenHash ?? null, input.note]);
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save the article.');
      if (input.step === 'publish' || input.step === 'retire') await audit(a, `Article ${input.step}`, `article:${r!.slice(3)}`, input.note, 'Office staff');
    }

    // Read model. Students see only their own requests and published articles; staff see their offices' queues and drafts.
    const offices = (await sql.query(`SELECT id, name, description, hours, active FROM osv_offices WHERE tenant_id = $1 ORDER BY name`, [T])) as Row[];
    const mineStaff = (await sql.query(`SELECT office_id, lead FROM osv_staff WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[];
    const staffOf = new Map(mineStaff.map((s) => [Number(s.office_id), Boolean(s.lead)]));
    const myIds = [...staffOf.keys()];
    const reqs = (await sql.query(`SELECT * FROM osv_requests WHERE tenant_id = $1 AND (requester_id = $2 OR office_id = ANY($3::bigint[])) ORDER BY updated_at DESC LIMIT 200`, [T, me, myIds])) as Row[];
    const reqIds = reqs.map((r) => Number(r.id));
    const msgs = reqIds.length ? ((await sql.query(`SELECT * FROM osv_messages WHERE request_id = ANY($1::bigint[]) ORDER BY id`, [reqIds])) as Row[]) : [];
    const arts = (await sql.query(`SELECT *, osv_text_hash(title, body) AS seen FROM osv_articles WHERE tenant_id = $1 AND (state = 'published' OR office_id = ANY($2::bigint[])) ORDER BY updated_at DESC LIMIT 300`, [T, myIds])) as Row[];
    const team = myIds.length ? ((await sql.query(`SELECT office_id, user_id, lead FROM osv_staff WHERE tenant_id = $1 AND office_id = ANY($2::bigint[]) AND revoked_at IS NULL`, [T, myIds])) as Row[]) : [];
    const allStaff = isAdmin ? ((await sql.query(`SELECT office_id, user_id, lead FROM osv_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[]) : [];
    const names = await userNames([...reqs.flatMap((r) => [String(r.requester_id), String(r.assignee_id ?? '')]), ...msgs.map((m) => String(m.author_id)), ...arts.map((x) => String(x.author_id)), ...team.map((t) => String(t.user_id)), ...allStaff.map((t) => String(t.user_id))]);
    const officeName = new Map(offices.map((o) => [Number(o.id), String(o.name)]));

    return {
      me, isAdmin,
      offices: offices.map((o) => ({ id: Number(o.id), name: String(o.name), description: String(o.description), hours: String(o.hours), active: Boolean(o.active), staff: staffOf.has(Number(o.id)), lead: staffOf.get(Number(o.id)) ?? false })),
      requests: reqs.map((r) => {
        const staff = staffOf.has(Number(r.office_id)), mine = String(r.requester_id) === me;
        return {
          id: Number(r.id), reference: String(r.reference), officeId: Number(r.office_id), office: officeName.get(Number(r.office_id)) ?? '', title: String(r.title), details: String(r.details),
          state: String(r.state), version: Number(r.version), requesterId: String(r.requester_id), requester: staff ? names[String(r.requester_id)] ?? 'Student' : 'You',
          assigneeId: r.assignee_id ? String(r.assignee_id) : null, assignee: r.assignee_id ? names[String(r.assignee_id)] ?? 'Staff' : null,
          outcome: r.outcome ? String(r.outcome) : null, resolution: String(r.resolution), resolvedAt: iso(r.resolved_at), reopenCount: Number(r.reopen_count),
          createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), mine, staff, lead: staffOf.get(Number(r.office_id)) ?? false,
          messages: msgs.filter((m) => Number(m.request_id) === Number(r.id) && (staff && !mine ? true : !m.internal))
            .map((m) => ({ id: Number(m.id), author: String(m.author_id) === me ? 'You' : names[String(m.author_id)] ?? 'Staff', body: String(m.body), internal: Boolean(m.internal), at: iso(m.at) })),
        };
      }),
      articles: arts.map((x) => ({ id: Number(x.id), officeId: Number(x.office_id), office: officeName.get(Number(x.office_id)) ?? '', title: String(x.title), body: String(x.body), state: String(x.state), version: Number(x.version), mine: String(x.author_id) === me, author: names[String(x.author_id)] ?? 'Staff', reviewNote: String(x.review_note), seenHash: String(x.seen), supersedes: x.supersedes ? Number(x.supersedes) : null, publishedAt: iso(x.published_at), staff: staffOf.has(Number(x.office_id)), lead: staffOf.get(Number(x.office_id)) ?? false }))
        .filter((x) => x.state === 'published' || x.staff),
      team: team.map((t) => ({ officeId: Number(t.office_id), userId: String(t.user_id), name: names[String(t.user_id)] ?? 'Staff', lead: Boolean(t.lead) })),
      staffAdmin: allStaff.map((t) => ({ officeId: Number(t.office_id), userId: String(t.user_id), name: names[String(t.user_id)] ?? 'Staff', lead: Boolean(t.lead) })),
    };
  },
});
