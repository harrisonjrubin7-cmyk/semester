import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, userNames, audit, tenantScope, requireTenantMember } from '../lib/server';
import { pg } from '../lib/pg';
import { MOD_MIGRATION } from '../lib/modMigration';

let modReady: Promise<void> | null = null;
const ensureMod = () => {
  if (!modReady) { const sql = pg(); modReady = (async () => { for (const s of MOD_MIGRATION) await sql.query(s); })().catch((e) => { modReady = null; throw e; }); }
  return modReady;
};
const check = (e: string | null) => { if (e) forbid(e); };

export default createEndpoint({
  description: 'Community feed: posts in the groups and communities the member belongs to, with reporting',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('feed'), groupId: z.string().optional() }),
    z.object({ action: z.literal('post'), groupId: z.string(), body: z.string().min(1).max(3000) }),
    z.object({ action: z.literal('delete'), id: z.string() }),
    z.object({ action: z.literal('report'), id: z.string(), reason: z.string().min(3).max(500) }),
    z.object({ action: z.literal('moderation') }),
    z.object({ action: z.literal('decide'), reportId: z.string(), decision: z.enum(['no_action', 'hide', 'remove']), policy: z.string().max(1000) }),
    z.object({ action: z.literal('appeal'), reportId: z.string(), text: z.string().max(2000) }),
    z.object({ action: z.literal('reviewAppeal'), reportId: z.string(), outcome: z.enum(['upheld', 'overturned']), note: z.string().max(1000) }),
    z.object({ action: z.literal('setModerator'), userId: z.string(), on: z.boolean() }),
    z.object({ action: z.literal('warn'), reportId: z.string(), guideline: z.string().max(1000), message: z.string().max(2000), days: z.number().int() }),
    z.object({ action: z.literal('withdrawWarning'), id: z.number().int(), reason: z.string().max(1000) }),
    z.object({ action: z.literal('reverse'), reportId: z.string(), reason: z.string().max(1000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId, T = a.institutionId;
    await ensureMod();
    const sql = pg();
    const isMod = ((await sql.query(`SELECT mod_is_staff($1,$2) AS ok`, [T, uid])) as { ok: boolean }[])[0].ok;
    const notify = (to: string, body: string) => zite.messages.create({ record: { body, sender: uid, recipients: [to], isNotification: true } as never });
    const groups = (await zite.groups.findAll({ filters: { institution: a.institutionId }, limit: 500 })).records;
    // Course discussions are read only through api/courseDiscussion.ts, which applies course moderation; never through Community.
    const mine = groups.filter((g) => g.kind !== 'Course Discussion' && ids(g.members).includes(uid));
    const mineIds = new Set(mine.map((g) => g.id));
    if (input.action === 'post') {
      if (!mineIds.has(input.groupId)) forbid('Join this group to post in it.');
      await zite.messages.create({ record: { body: input.body, sender: uid, group: input.groupId, isNotification: false } as never });
      return { ok: true };
    }
    if (input.action === 'delete') {
      const m = await zite.messages.findOne({ id: input.id });
      if (!m || first(m.sender) !== uid) forbid('You can only delete your own posts.');
      await zite.messages.delete({ id: input.id });
      return { ok: true };
    }
    if (input.action === 'report') {
      const m = await zite.messages.findOne({ id: input.id });
      if (!m || !mineIds.has(first(m.group) ?? '')) forbid();
      const ref = `MOD-${crypto.randomUUID().slice(0, 8)}`;
      check(((await sql.query(`SELECT mod_report($1,$2,$3,$4,$5,$6,$7) AS e`, [uid, T, ref, m!.id, first(m!.sender) ?? '', input.reason, (m!.body ?? '').slice(0, 300)])) as { e: string | null }[])[0].e);
      await audit(a, 'Post reported', `message:${m!.id}`, ref);
      return { ok: true, reference: ref };
    }
    if (input.action === 'decide') {
      check(((await sql.query(`SELECT mod_decide($1,$2,$3,$4,$5) AS e`, [uid, T, input.reportId, input.decision, input.policy])) as { e: string | null }[])[0].e);
      const r = ((await sql.query(`SELECT author_id FROM mod_reports WHERE id = $1`, [input.reportId])) as { author_id: string }[])[0];
      if (input.decision !== 'no_action' && r) await notify(r.author_id, `A moderator ${input.decision === 'hide' ? 'hid' : 'removed'} one of your community posts: ${input.policy} You can appeal within 14 days from Campus › Community.`);
      await audit(a, `Moderation: ${input.decision}`, `report:${input.reportId}`, input.policy, 'Moderator');
      return { ok: true };
    }
    if (input.action === 'appeal') {
      check(((await sql.query(`SELECT mod_appeal($1,$2,$3,$4) AS e`, [uid, T, input.reportId, input.text])) as { e: string | null }[])[0].e);
      await audit(a, 'Moderation appealed', `report:${input.reportId}`, '', 'Author');
      return { ok: true };
    }
    if (input.action === 'reviewAppeal') {
      check(((await sql.query(`SELECT mod_review_appeal($1,$2,$3,$4,$5) AS e`, [uid, T, input.reportId, input.outcome, input.note])) as { e: string | null }[])[0].e);
      const r = ((await sql.query(`SELECT author_id FROM mod_reports WHERE id = $1`, [input.reportId])) as { author_id: string }[])[0];
      if (r) await notify(r.author_id, `Your appeal was reviewed by a different moderator: ${input.outcome === 'overturned' ? 'your post is visible again' : 'the decision stands'}. ${input.note}`);
      await audit(a, `Moderation appeal ${input.outcome}`, `report:${input.reportId}`, input.note, 'Moderator');
      return { ok: true };
    }
    if (input.action === 'warn') {
      // The warned person is the author of the report, resolved here; the request never names a person.
      const r = ((await sql.query(`SELECT author_id FROM mod_reports WHERE id = $1 AND tenant_id = $2`, [input.reportId, T])) as { author_id: string }[])[0];
      if (!r) forbid('Report not found.');
      const out = ((await sql.query(`SELECT mod_warn($1,$2,$3,$4,$5,$6,$7) AS e`, [uid, T, r!.author_id, input.reportId, input.guideline, input.message, input.days])) as { e: string }[])[0].e;
      if (!out?.startsWith('ok:')) forbid(out ?? 'Could not warn.');
      await notify(r!.author_id, `A moderator sent you a warning about a community guideline: ${input.message} It expires in ${input.days} days and does not affect your account.`);
      await audit(a, 'Moderation warning', `report:${input.reportId}`, input.guideline, 'Moderator');
      return { ok: true };
    }
    if (input.action === 'withdrawWarning') {
      check(((await sql.query(`SELECT mod_withdraw_warning($1,$2,$3,$4) AS e`, [uid, T, input.id, input.reason])) as { e: string | null }[])[0].e);
      const w = ((await sql.query(`SELECT author_id FROM mod_warnings WHERE id = $1`, [input.id])) as { author_id: string }[])[0];
      if (w) await notify(w.author_id, `A moderator withdrew a warning they had given you: ${input.reason}`);
      await audit(a, 'Moderation warning withdrawn', `modWarning:${input.id}`, input.reason, 'Moderator');
      return { ok: true };
    }
    if (input.action === 'reverse') {
      check(((await sql.query(`SELECT mod_reverse($1,$2,$3,$4) AS e`, [uid, T, input.reportId, input.reason])) as { e: string | null }[])[0].e);
      const r = ((await sql.query(`SELECT author_id FROM mod_reports WHERE id = $1`, [input.reportId])) as { author_id: string }[])[0];
      if (r) await notify(r.author_id, `A moderator who was not involved reversed a decision on your post. It is visible again. ${input.reason}`);
      await audit(a, 'Moderation reversed', `report:${input.reportId}`, input.reason, 'Moderator');
      return { ok: true };
    }
    if (input.action === 'setModerator') {
      if (!a.roles.includes('Administrator')) forbid('Only administrators appoint moderators.');
      if (!(await tenantScope(T)).members.has(input.userId)) forbid('That person is not in your institution.');
      if (input.on) await requireTenantMember(T, input.userId);
      check(((await sql.query(`SELECT mod_set_staff($1,$2,$3,$4) AS e`, [uid, T, input.userId, input.on])) as { e: string | null }[])[0].e);
      await audit(a, input.on ? 'Moderator appointed' : 'Moderator removed', `user:${input.userId}`, '', 'Administrator');
      return { ok: true };
    }
    if (input.action === 'moderation') {
      const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
      const mineDecided = (await sql.query(`SELECT * FROM mod_reports WHERE tenant_id = $1 AND author_id = $2 AND decision IN ('hide','remove') ORDER BY number DESC`, [T, uid])) as Record<string, unknown>[];
      const queue = isMod ? (await sql.query(`SELECT * FROM mod_reports WHERE tenant_id = $1 AND state IN ('open','appealed') ORDER BY number`, [T])) as Record<string, unknown>[] : [];
      const mods = a.roles.includes('Administrator') ? (await sql.query(`SELECT user_id FROM mod_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as { user_id: string }[] : [];
      const members = a.roles.includes('Administrator') ? [...(await tenantScope(T)).members].filter((m) => m !== uid) : [];
      const recent = isMod ? (await sql.query(`SELECT r.* FROM mod_reports r WHERE r.tenant_id = $1 AND r.decision IN ('hide','remove') AND r.state IN ('decided','appeal_decided')
        AND coalesce(r.appeal_outcome,'') <> 'overturned' AND r.decided_at > now() - interval '30 days' AND NOT EXISTS (SELECT 1 FROM mod_reversals v WHERE v.report_id = r.id) ORDER BY r.number DESC LIMIT 100`, [T])) as Record<string, unknown>[] : [];
      const warnings = isMod ? (await sql.query(`SELECT * FROM mod_warnings WHERE tenant_id = $1 AND withdrawn_at IS NULL AND expires_at > now() ORDER BY id DESC LIMIT 200`, [T])) as Record<string, unknown>[] : [];
      const myWarnings = (await sql.query(`SELECT * FROM mod_warnings WHERE tenant_id = $1 AND author_id = $2 ORDER BY id DESC LIMIT 50`, [T, uid])) as Record<string, unknown>[];
      // Contextual review: counts from mod_context (NULL unless an uninvolved moderator) and up to two posts either side in the same group.
      const context = new Map<string, unknown>();
      for (const q of queue) {
        const c = ((await sql.query(`SELECT mod_context($1,$2,$3) AS c`, [uid, T, String(q.id)])) as { c: Record<string, number> | null }[])[0].c;
        if (!c) continue;
        const m = await zite.messages.findOne({ id: String(q.message_id) }).catch(() => null);
        let around: { author: string; body: string; at: string | null; reported: boolean }[] = [];
        if (m && first(m.group)) {
          const all = (await zite.messages.findAll({ filters: { group: first(m.group)! }, limit: 200 })).records.sort((x, y) => (x.sentAt ?? '').localeCompare(y.sentAt ?? ''));
          const i = all.findIndex((x) => x.id === m.id);
          const nm = await userNames(all.slice(Math.max(0, i - 2), i + 3).map((x) => first(x.sender) ?? ''));
          around = all.slice(Math.max(0, i - 2), i + 3).map((x) => ({ author: nm[first(x.sender) ?? ''] ?? 'Member', body: (x.body ?? '').slice(0, 300), at: x.sentAt ?? null, reported: x.id === m.id }));
        }
        context.set(String(q.id), { counts: c, around });
      }
      const names = await userNames([...queue.flatMap((q) => [String(q.author_id), String(q.reporter_id)]), ...recent.map((r) => String(r.author_id)), ...warnings.map((w) => String(w.author_id)), ...mods.map((m) => m.user_id), ...members]);
      return {
        isMod, isAdmin: a.roles.includes('Administrator'),
        myDecisions: mineDecided.map((r) => ({ id: String(r.id), excerpt: String(r.excerpt), decision: String(r.decision), policy: String(r.policy ?? ''), state: String(r.state),
          decidedAt: iso(r.decided_at), appealOutcome: (r.appeal_outcome as string) ?? null, appealNote: (r.appeal_note as string) ?? '',
          canAppeal: r.state === 'decided' && new Date(String(r.decided_at)).getTime() > Date.now() - 14 * 864e5 })),
        queue: queue.map((r) => ({ id: String(r.id), number: Number(r.number), excerpt: String(r.excerpt), reason: String(r.reason), state: String(r.state),
          author: names[String(r.author_id)] ?? 'Member', reporter: names[String(r.reporter_id)] ?? 'Member', involved: [r.author_id, r.reporter_id, r.decided_by].includes(uid),
          decision: (r.decision as string) ?? null, policy: (r.policy as string) ?? '', appealText: (r.appeal_text as string) ?? '', createdAt: iso(r.created_at), context: context.get(String(r.id)) ?? null })),
        reversible: recent.filter((r) => ![r.decided_by, r.author_id, r.reporter_id, r.appeal_by].includes(uid)).map((r) => ({ id: String(r.id), number: Number(r.number), excerpt: String(r.excerpt), decision: String(r.decision), policy: String(r.policy ?? ''), author: names[String(r.author_id)] ?? 'Member', decidedAt: iso(r.decided_at) })),
        warnings: warnings.map((w) => ({ id: Number(w.id), author: names[String(w.author_id)] ?? 'Member', mine: String(w.author_id) === uid, guideline: String(w.guideline), message: String(w.message), expiresAt: iso(w.expires_at), createdAt: iso(w.created_at) })),
        myWarnings: myWarnings.map((w) => ({ id: Number(w.id), message: String(w.message), guideline: String(w.guideline), expiresAt: iso(w.expires_at), withdrawn: !!w.withdrawn_at, withdrawnReason: (w.withdrawn_reason as string) ?? '', active: !w.withdrawn_at && new Date(String(w.expires_at)).getTime() > Date.now() })),
        moderators: mods.map((m) => ({ id: m.user_id, name: names[m.user_id] ?? 'Member' })),
        members: members.map((m) => ({ id: m, name: names[m] ?? 'Member' })).sort((x, y) => x.name.localeCompare(y.name)),
      };
    }
    const target = input.groupId ? [input.groupId].filter((g) => mineIds.has(g)) : [...mineIds];
    const hidden = new Set(((await sql.query(`SELECT message_id FROM mod_hidden($1)`, [T])) as { message_id: string }[]).map((h) => h.message_id));
    const posts = (await Promise.all(target.map((g) => zite.messages.findAll({ filters: { group: g }, limit: 200 })))).flatMap((r) => r.records).filter((p) => !hidden.has(p.id));
    const names = await userNames(posts.map((p) => first(p.sender) ?? ''));
    const gName = Object.fromEntries(groups.map((g) => [g.id, g.name ?? '']));
    return {
      groups: mine.map((g) => ({ id: g.id, name: g.name ?? '', kind: g.kind ?? 'Community', members: ids(g.members).length })),
      posts: posts.map((p) => ({ id: p.id, body: p.body ?? '', author: names[first(p.sender) ?? ''] ?? 'Member', mine: first(p.sender) === uid, group: gName[first(p.group) ?? ''] ?? '', groupId: first(p.group) ?? '', sentAt: p.sentAt ?? null }))
        .sort((x, y) => (y.sentAt ?? '').localeCompare(x.sentAt ?? '')),
    };
  },
});
