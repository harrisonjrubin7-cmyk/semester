import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { PTA_MIGRATION } from '../lib/ptaMigration';
import { CNT_MIGRATION } from '../lib/cntMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...PTA_MIGRATION, ...CNT_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

// E12 Contracts: contract managers (granted by an administrator) draft contracts with partner
// organizations and propose exact terms; an administrator of the organization accepts the exact
// hash (see partners endpoint, action acceptContract). Rules: lib/cntMigration.ts.
export default createEndpoint({
  description: 'Institution contracts with partner organizations: managers, drafts, hash-pinned term proposals and closing',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('create'), orgId: z.number().int(), title: z.string().min(3).max(160), kind: z.enum(['supplier', 'service', 'partner', 'other']), valueCents: z.number().int().min(0).max(1_000_000_000_00), startsOn: DATE, endsOn: DATE }),
    z.object({ action: z.literal('propose'), id: z.number().int(), terms: z.string().min(20).max(20000), valueCents: z.number().int().min(0).max(1_000_000_000_00), startsOn: DATE, endsOn: DATE }),
    z.object({ action: z.literal('close'), id: z.number().int(), step: z.enum(['ended', 'terminated']) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const a = await requireAccess(me);
    const T = a.institutionId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out) forbid(out); };
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage contract managers.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(await one(`SELECT cnt_set_staff($1,$2,$3,$4) AS r`, [me, T, uid, input.on]));
      await audit(a, `Contract manager ${input.on ? 'granted' : 'revoked'}`, `cnt_staff:${uid}`, '', 'Administrator');
    }
    if (input.action === 'create') {
      const out = await one(`SELECT cnt_create($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, T, input.orgId, input.title, input.kind, input.valueCents, input.startsOn ?? null, input.endsOn ?? null]);
      if (!out || !out.startsWith('ok:')) forbid(out ?? 'Failed.');
      const newId = Number(out!.split(':')[1]);
      result = { contractId: newId };
      await audit(a, 'Contract created', `contract:${newId}`, input.title, 'Contract manager');
    }
    if (input.action === 'propose') {
      fail(await one(`SELECT cnt_propose($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.id, input.terms, input.valueCents, input.startsOn ?? null, input.endsOn ?? null]));
      await audit(a, 'Contract terms proposed', `contract:${input.id}`, '', 'Contract manager');
    }
    if (input.action === 'close') {
      fail(await one(`SELECT cnt_close($1,$2,$3,$4) AS r`, [me, T, input.id, input.step]));
      await audit(a, `Contract ${input.step}`, `contract:${input.id}`, '', 'Contract manager');
    }

    const isManager = ((await sql.query(`SELECT cnt_is_manager($1,$2) AS m`, [T, me])) as { m: boolean }[])[0].m;
    const [contracts, orgs, staff] = await Promise.all([
      sql.query(`SELECT c.*, o.name AS org_name FROM cnt_contracts c JOIN pta_orgs o ON o.id = c.org_id WHERE c.tenant_id = $1 ORDER BY c.updated_at DESC LIMIT 300`, [T]),
      sql.query(`SELECT DISTINCT o.id, o.name FROM pta_relationships r JOIN pta_orgs o ON o.id = r.org_id WHERE r.tenant_id = $1 AND r.state NOT IN ('offboarded','rejected') ORDER BY o.name`, [T]),
      sql.query(`SELECT user_id FROM cnt_staff WHERE tenant_id = $1 AND revoked_at IS NULL ORDER BY granted_at`, [T]),
    ]) as [Row[], Row[], Row[]];
    const names = await userNames([...contracts.flatMap((c) => [c.created_by, c.proposed_by, c.accepted_by]), ...staff.map((s) => s.user_id)].filter(Boolean).map(String));
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    return {
      result, isAdmin, isManager, institutionName: a.institutionName ?? null,
      orgs: orgs.map((o) => ({ id: Number(o.id), name: String(o.name) })),
      managers: staff.map((s) => ({ name: nm(s.user_id), me: s.user_id === me })),
      contracts: contracts.map((c) => ({ id: Number(c.id), orgId: Number(c.org_id), org: String(c.org_name), title: String(c.title), kind: String(c.kind),
        valueCents: Number(c.value_cents), startsOn: day(c.starts_on), endsOn: day(c.ends_on), state: String(c.state), version: Number(c.version),
        terms: String(c.terms_text), termsHash: c.terms_hash ? String(c.terms_hash) : null, acceptedBy: nm(c.accepted_by), acceptedAt: iso(c.accepted_at),
        createdBy: nm(c.created_by), proposedBy: nm(c.proposed_by), mine: c.created_by === me })),
    };
  },
});
