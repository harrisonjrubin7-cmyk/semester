import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/pg';
import { approvedEmployers } from '../lib/crrServer';
import { EMP_PROFILE_MIGRATION } from '../lib/empProfileMigration';
import { requireAccess, ids, first, forbid, audit } from '../lib/server';

let empReady: Promise<void> | null = null;
const ensureEmp = () => { if (!empReady) { const sql = pg(); empReady = (async () => { for (const q of EMP_PROFILE_MIGRATION) await sql.query(q); })().catch((e) => { empReady = null; throw e; }); } return empReady; };

export default createEndpoint({
  description: 'Campus and career: groups, events, opportunities, joining, RSVPs, applications and reports',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('toggleGroup'), id: z.string() }),
    z.object({ action: z.literal('toggleEvent'), id: z.string() }),
    z.object({ action: z.literal('apply'), id: z.string(), shareItems: z.array(z.string()).max(10).default([]), shareContact: z.boolean().default(false) }),
    z.object({ action: z.literal('report'), target: z.string(), reason: z.string().min(3) }),
    z.object({ action: z.literal('saveProfile'), headline: z.string().max(120), program: z.string().max(120), gradYear: z.number().int().nullable(), skills: z.string().max(500), roles: z.string().max(300), discoverable: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const toggle = (list: string[]) => (list.includes(uid) ? list.filter((x) => x !== uid) : [...list, uid]);
    if (input.action === 'toggleGroup') {
      const g = await zite.groups.findOne({ id: input.id });
      if (!g || !ids(g.institution).includes(a.institutionId) && first(g.institution)) forbid();
      await zite.groups.update({ id: input.id, record: { members: toggle(ids(g!.members)) } as never });
      return { ok: true };
    }
    if (input.action === 'toggleEvent') {
      const e = await zite.events.findOne({ id: input.id });
      if (!e) forbid();
      const eg = first(e!.group) ? await zite.groups.findOne({ id: first(e!.group)! }) : null;
      if (eg && first(eg.institution) && !ids(eg.institution).includes(a.institutionId)) forbid();
      await zite.events.update({ id: input.id, record: { attendees: toggle(ids(e!.attendees)) } as never });
      return { ok: true };
    }
    if (input.action === 'apply') {
      const o = await zite.opportunities.findOne({ id: input.id });
      if (!o) forbid();
      // Only employers this institution approved reach its students, and only with what the student chooses to share.
      const employerId = first(o!.postedBy);
      if (!employerId || !(await approvedEmployers(a.institutionId)).has(employerId)) forbid('This employer is not approved by your institution.');
      const own = (await zite.resources.findAll({ filters: { owner: uid, kind: 'Portfolio Item' }, limit: 200 })).records.map((r) => r.id);
      const notMine = input.shareItems.filter((i) => !own.includes(i));
      if (notMine.length) forbid('You can only share your own portfolio items.');
      // Hiring rules live in Postgres (Employers app migration): open, not closed, not your own posting, once only.
      const sql = pg();
      const ready = ((await sql.query(`SELECT to_regprocedure('emp_apply(text,text)') IS NOT NULL AS ok`)) as { ok: boolean }[])[0].ok;
      if (ready) {
        const known = (await sql.query(`SELECT 1 FROM emp_postings WHERE zite_id = $1`, [input.id])) as unknown[];
        if (known.length) { const r = (await sql.query(`SELECT emp_apply($1,$2) AS e`, [uid, input.id])) as { e: string | null }[]; if (r[0].e) forbid(r[0].e); }
        else if (o!.closesOn && o!.closesOn < new Date().toISOString().slice(0, 10)) forbid('Applications for this opportunity have closed.');
      }
      const shared = String(((await sql.query(`SELECT crr_share($1,$2,$3,$4,$5,$6) AS r`, [a.institutionId, input.id, employerId, uid, input.shareItems, input.shareContact])) as { r: string }[])[0].r);
      if (shared !== 'ok') forbid(shared);
      if (!ids(o!.applicants).includes(uid)) await zite.opportunities.update({ id: input.id, record: { applicants: [...ids(o!.applicants), uid] } as never });
      return { ok: true };
    }
    if (input.action === 'report') {
      const ref = 'MOD-' + Math.floor(1000 + Math.random() * 9000);
      await zite.cases.create({ record: { title: `Report: ${input.target}`, student: uid, category: 'Moderation Report', status: 'Sent', reference: ref, notes: input.reason } as never });
      await audit(a, 'Moderation report filed', ref, input.target, 'Member');
      return { ok: true };
    }
    if (input.action === 'saveProfile') {
      await ensureEmp();
      const r = String(((await pg().query(`SELECT emp_profile_save($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [uid, a.institutionId, input.headline, input.program, input.gradYear, input.skills, input.roles, input.discoverable])) as { r: string }[])[0].r);
      if (r !== 'ok') forbid(r);
      await audit(a, 'Employer discovery profile updated', `user:${uid}`, input.discoverable ? 'Discoverable by approved employers' : 'Not discoverable', 'Student');
      return { ok: true };
    }
    await ensureEmp();
    const profileRow = ((await pg().query(`SELECT headline, program, grad_year, skills, roles, discoverable FROM emp_profiles WHERE student_id = $1`, [uid])) as Record<string, unknown>[])[0];
    const profile = profileRow ? { headline: String(profileRow.headline), program: String(profileRow.program), gradYear: profileRow.grad_year == null ? null : Number(profileRow.grad_year), skills: String(profileRow.skills), roles: String(profileRow.roles), discoverable: !!profileRow.discoverable } : null;
    const [groups, events, opps, approved, portfolio] = await Promise.all([
      zite.groups.findAll({ limit: 200 }), zite.events.findAll({ limit: 200 }), zite.opportunities.findAll({ limit: 200 }), approvedEmployers(a.institutionId),
      zite.resources.findAll({ filters: { owner: uid, kind: 'Portfolio Item' }, limit: 200 }),
    ]);
    const mine = (g: (typeof groups.records)[number]) => !first(g.institution) || ids(g.institution).includes(a.institutionId);
    const okGroups = groups.records.filter(mine);
    const okIds = new Set(okGroups.map((g) => g.id));
    const gName = Object.fromEntries(okGroups.map((g) => [g.id, g.name ?? '']));
    events.records = events.records.filter((e) => !first(e.group) || okIds.has(first(e.group)!));
    return {
      groups: okGroups.filter((g) => g.kind !== 'Course Discussion').map((g) => ({ id: g.id, name: g.name ?? '', kind: g.kind ?? 'Club', members: ids(g.members).length, joined: ids(g.members).includes(uid) })),
      events: events.records.map((e) => ({ id: e.id, title: e.title ?? '', startsAt: e.startsAt ?? null, location: e.location ?? '', group: gName[first(e.group) ?? ''] ?? '', going: ids(e.attendees).includes(uid), count: ids(e.attendees).length }))
        .sort((x, y) => (x.startsAt ?? '').localeCompare(y.startsAt ?? '')),
      opportunities: opps.records.filter((o) => approved.has(first(o.postedBy) ?? '')).map((o) => ({ id: o.id, title: o.title ?? '', kind: o.kind ?? 'Job', employer: o.employerName ?? '', applied: ids(o.applicants).includes(uid) })),
      portfolio: portfolio.records.map((r) => ({ id: r.id, title: r.title ?? 'Untitled' })),
      profile,
    };
  },
});
