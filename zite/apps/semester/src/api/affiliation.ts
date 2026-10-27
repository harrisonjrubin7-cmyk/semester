import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, forbid, first, currentMembership, ensureAff } from '../lib/server';
import { pg } from '../lib/pg';
import { rateLimit } from '../lib/rateLimitServer';
import { joinBlocker } from '../lib/affiliationRules';

// Independent learner → affiliation (S-76 E28). The same account asks to join an institution with its invite code; the request
// is a Pending membership that the institution's administrator approves in the console as usual. Nothing moves between
// workspaces: work made in the personal workspace stays there and the institution's queries are tenant-scoped, so it never
// sees it. Switching only changes which active membership the server treats as current (lib/server.ts currentMembership).
export default createEndpoint({
  description: 'Lists my workspaces, requests to join an institution with an invite code, and switches the current workspace',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('join'), inviteCode: z.string().min(4).max(40), role: z.enum(['Student', 'Faculty', 'Advisor']) }),
    z.object({ action: z.literal('switch'), membershipId: z.string().min(1).max(60) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const uid = context.user.id;
    await ensureAff();
    const sql = pg();
    const mine = async () => (await zite.memberships.findAll({ filters: { member: uid }, limit: 20 })).records;

    if (input.action === 'join') {
      await rateLimit('onboard.user', uid);
      const inst = await zite.institutions.findOne({ filters: { inviteCode: input.inviteCode.trim().toUpperCase() } });
      if (!inst) forbid('That invite code doesn’t match an institution. Check it with your administrator.');
      if (inst!.tenantType === 'Personal') forbid('Personal workspaces belong to one person and cannot be joined.');
      const here = (await mine()).find((m) => first(m.institution) === inst!.id);
      const why = joinBlocker({ role: input.role, alreadyThere: here ? here.status ?? 'Pending' : 'none' });
      if (why) forbid(why);
      const roles = [...new Set(['Student', input.role])];
      const m = await zite.memberships.create({ record: { label: `${context.user.email} · ${roles.join(', ')}`, member: uid, institution: inst!.id, roles, status: 'Pending' } as never });
      await sql.query(`INSERT INTO aff_events (user_id, step, membership_id, institution_id, note) VALUES ($1, 'join_request', $2, $3, $4)`, [uid, m.id, inst!.id, roles.join(',')]);
      await audit({ userId: uid, institutionId: inst!.id }, 'Join requested', `membership:${m.id}`, `Roles: ${roles.join(', ')} · existing account`, 'Invite code');
    }

    if (input.action === 'switch') {
      const m = (await mine()).find((x) => x.id === input.membershipId);
      if (!m || m.status !== 'Active') forbid('You can only switch to one of your own active workspaces.');
      await sql.query(`INSERT INTO aff_current (user_id, membership_id) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET membership_id = EXCLUDED.membership_id, set_at = now()`, [uid, m!.id]);
      await sql.query(`INSERT INTO aff_events (user_id, step, membership_id, institution_id) VALUES ($1, 'switch', $2, $3)`, [uid, m!.id, first(m!.institution) ?? null]);
    }

    const records = await mine();
    const current = await currentMembership(uid);
    const out: { id: string; status: string; roles: string[]; institutionName: string; personal: boolean; sample: boolean; current: boolean }[] = [];
    for (const m of records) {
      const inst = first(m.institution) ? await zite.institutions.findOne({ id: first(m.institution)! }) : undefined;
      out.push({ id: m.id, status: m.status ?? 'Pending', roles: m.roles ?? [], institutionName: inst?.name ?? 'Workspace', personal: inst?.tenantType === 'Personal', sample: !!inst?.isSample, current: m.id === current?.id });
    }
    return { workspaces: out };
  },
});
