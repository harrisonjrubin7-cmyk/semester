import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope, ids, first } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureCmy } from '../lib/cmyServer';
import { MOD_MIGRATION } from '../lib/modMigration';
import { communityHealth } from '../lib/communityHealth';

type Row = Record<string, unknown>;
let modReady: Promise<void> | null = null;
const ensureMod = () => { if (!modReady) modReady = (async () => { for (const q of MOD_MIGRATION) await pg().query(q); })().catch((e) => { modReady = null; throw e; }); return modReady; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Community Manager: setup (create communities with guidelines and a join policy, edit, archive), join requests, and health.
// Rules in lib/cmyMigration.ts; group facts are read from the Zite record here, never from the request.
export default createEndpoint({
  description: 'Community setup, join requests and health for community managers appointed by an administrator',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('create'), name: z.string().min(3).max(80), description: z.string().max(600).default(''), guidelines: z.string().max(4000), policy: z.enum(['open', 'request']) }),
    z.object({ action: z.literal('setup'), step: z.enum(['edit', 'archive', 'reopen']), groupId: z.string(), expectedVersion: z.number().int(), description: z.string().max(600).optional(), guidelines: z.string().max(4000).optional(), policy: z.enum(['open', 'request']).optional() }),
    z.object({ action: z.literal('decide'), id: z.number().int(), approve: z.boolean(), note: z.string().max(500).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await Promise.all([ensureCmy(), ensureMod()]);
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const isStaff = ((await sql.query(`SELECT cmy_is_staff($1,$2) AS ok`, [T, me])) as { ok: boolean }[])[0].ok;
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;

    if (input.action === 'setStaff') {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      const r = await one(`SELECT cmy_set_staff($1,$2,$3,$4,$5) AS r`, [me, isAdmin, T, uid, input.on]); if (r) forbid(r);
      await audit(a, input.on ? 'Community manager appointed' : 'Community manager removed', `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'create') {
      if (!isStaff) forbid('Only community managers set up communities.');
      if (input.guidelines.trim().length < 40) forbid('Write the community guidelines (40+ characters). Moderators cite them.');
      // Two stores: the Zite group first, then the rules row; if the rules row is refused the group is removed again.
      const g = await zite.groups.create({ record: { name: input.name.trim(), kind: 'Community', institution: [T], members: [me] } as never });
      const r = await one(`SELECT cmy_setup($1,$2,'create',$3,$4,'Community',NULL,$5,$6,$7) AS r`, [T, me, g.id, T, input.description, input.guidelines, input.policy]).catch(async (e) => { await zite.groups.delete({ id: g.id }); throw e; });
      if (r) { await zite.groups.delete({ id: g.id }); forbid(r); }
      await audit(a, 'Community created', `group:${g.id}`, input.policy, 'Community manager');
    }
    if (input.action === 'setup') {
      const g = await zite.groups.findOne({ id: input.groupId });
      const gT = g && ids(g.institution).includes(T) ? T : (g ? first(g.institution) ?? null : null);
      const r = await one(`SELECT cmy_setup($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS r`, [T, me, input.step, input.groupId, gT, g?.kind ?? null, input.expectedVersion, input.description ?? null, input.guidelines ?? null, input.policy ?? null]);
      if (r) forbid(r);
    }
    if (input.action === 'decide') {
      const r = (await one(`SELECT cmy_decide($1,$2,$3,$4,$5) AS r`, [T, me, input.id, input.approve, input.note])) ?? '';
      if (r.startsWith('error:')) forbid(r.slice(6));
      const req = ((await sql.query(`SELECT group_id, user_id FROM cmy_requests WHERE id = $1`, [input.id])) as { group_id: string; user_id: string }[])[0];
      if (input.approve && r) {
        const g = await zite.groups.findOne({ id: req.group_id });
        if (g && !ids(g.members).includes(r)) await zite.groups.update({ id: g.id, record: { members: [...ids(g.members), r] } as never });
      }
      if (req) await zite.messages.create({ record: { body: input.approve ? 'Your request to join a community was approved. It now appears in Campus › Community.' : `Your request to join a community was declined: ${input.note}`, sender: me, recipients: [req.user_id], isNotification: true } as never });
    }

    const groups = (await zite.groups.findAll({ filters: { institution: T }, limit: 500 })).records.filter((g) => g.kind === 'Community');
    const cfg = new Map(((await sql.query(`SELECT * FROM cmy_communities WHERE tenant_id = $1`, [T])) as Row[]).map((r) => [String(r.group_id), r]));
    const staff = isAdmin ? ((await sql.query(`SELECT user_id FROM cmy_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[]).map((r) => String(r.user_id)) : [];
    let requests: Row[] = [], health: Record<string, unknown> = {};
    if (isStaff) {
      requests = (await sql.query(`SELECT * FROM cmy_requests WHERE tenant_id = $1 AND state = 'pending' ORDER BY id`, [T])) as Row[];
      const reports = (await sql.query(`SELECT message_id, created_at, decided_at, state FROM mod_reports WHERE tenant_id = $1 AND created_at > now() - interval '90 days'`, [T])) as Row[];
      const hidden = new Set(((await sql.query(`SELECT message_id FROM mod_hidden($1)`, [T])) as Row[]).map((r) => String(r.message_id)));
      for (const g of groups) {
        const posts = (await zite.messages.findAll({ filters: { group: g.id }, limit: 2000 })).records.map((m) => ({ id: m.id, sender: first(m.sender) ?? '', sentAt: m.sentAt ?? null }));
        health[g.id] = communityHealth(ids(g.members).length, posts, reports.map((r) => ({ messageId: String(r.message_id), createdAt: String(iso(r.created_at)), decidedAt: iso(r.decided_at), state: String(r.state) })), hidden);
      }
    }
    const names = await userNames([...requests.map((r) => String(r.user_id)), ...staff]);
    return {
      isAdmin, isStaff,
      managers: staff.map((s) => ({ id: s, name: names[s] ?? 'Member' })),
      communities: groups.map((g) => { const c = cfg.get(g.id); return { id: g.id, name: g.name ?? '', members: ids(g.members).length, setUp: !!c, description: c ? String(c.description) : '', guidelines: c ? String(c.guidelines) : '', policy: c ? String(c.join_policy) : 'open', state: c ? String(c.state) : 'active', version: c ? Number(c.version) : 0, health: health[g.id] ?? null }; }),
      requests: requests.map((r) => ({ id: Number(r.id), groupId: String(r.group_id), community: groups.find((g) => g.id === String(r.group_id))?.name ?? 'Community', person: names[String(r.user_id)] ?? 'Member', mine: String(r.user_id) === me, note: String(r.note), at: iso(r.created_at) })),
    };
  },
});
