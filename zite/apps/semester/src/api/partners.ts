import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { PTA_MIGRATION } from '../lib/ptaMigration';
import { SCOPES, relStatus, accessLive, RelState } from '../lib/partnerRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of PTA_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
const SC = z.array(z.enum(SCOPES)).min(1).max(SCOPES.length);

// Partner Administration (S-76 E30). Outside organizations do not need an institution membership: any signed-in person can
// register an organization (becoming its first admin), manage its members, apply to institutions and accept agreements.
// Institutions decide separately through partner managers (granted by an administrator), who verify, propose terms and
// scopes, suspend and offboard. Access for other modules is pta_live(tenant, org, scope). Rules: lib/ptaMigration.ts.
export default createEndpoint({
  description: 'Partner organizations: registration, members, applications to institutions, verification, agreements, scopes, suspension and offboarding',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('register'), name: z.string().min(2).max(120), kind: z.enum(['marketplace', 'transfer', 'research', 'employer', 'service']), website: z.string().max(200).default('') }),
    z.object({ action: z.literal('member'), orgId: z.number().int(), email: z.string().email().max(200), role: z.enum(['admin', 'member', 'remove']) }),
    z.object({ action: z.literal('apply'), orgId: z.number().int(), institutionId: z.string().min(1).max(100), scopes: SC, note: z.string().max(2000).default('') }),
    z.object({ action: z.literal('accept'), relId: z.number().int(), expectedVersion: z.number().int(), hash: z.string().min(10).max(100) }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('manage'), relId: z.number().int(), step: z.enum(['verify', 'reject', 'propose', 'suspend', 'reinstate', 'offboard']), expectedVersion: z.number().int(), note: z.string().max(2000).default(''),
      text: z.string().max(10000).default(''), validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null), scopes: z.array(z.enum(SCOPES)).default([]) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const userByEmail = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      if (!rows[0]) forbid('No Semester account uses that email. Ask them to sign in once first.');
      return String((rows[0] as Row).id);
    };
    // Institution context is optional: outside partners have none.
    let a: Awaited<ReturnType<typeof requireAccess>> | null = null;
    try { a = await requireAccess(me); } catch { a = null; }
    let isAdmin = false;
    if (a) { try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ } }
    const T = a?.institutionId ?? null;
    const manager = T ? !!(((await sql.query(`SELECT pta_is_manager($1,$2) AS m`, [T, me])) as { m: boolean }[])[0].m) : false;
    const log = async (action: string, ref: string, detail: string, role: string) => { if (a) await audit(a, action, ref, detail, role); };
    let result: unknown = null;

    if (input.action === 'register') {
      const out = await one(`SELECT pta_register($1,$2,$3,$4) AS r`, [me, input.name, input.kind, input.website]);
      if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.');
      result = { orgId: Number(out!.slice(3)) };
    }
    if (input.action === 'member') {
      const uid = await userByEmail(input.email);
      fail(await one(`SELECT pta_member($1,$2,$3,$4) AS r`, [me, input.orgId, uid, input.role === 'remove' ? null : input.role]));
    }
    if (input.action === 'apply') {
      const inst = await zite.institutions.findOne({ id: input.institutionId });
      if (!inst) forbid('Institution not found.');
      const out = await one(`SELECT pta_apply($1,$2,$3,$4::text[],$5) AS r`, [me, input.institutionId, input.orgId, input.scopes, input.note]);
      if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.');
      result = { relId: Number(out!.slice(3)) };
    }
    if (input.action === 'accept') fail(await one(`SELECT pta_accept($1,$2,$3,$4) AS r`, [me, input.relId, input.expectedVersion, input.hash]));
    if (input.action === 'setStaff') {
      if (!isAdmin || !T) forbid('Only administrators manage partner managers.');
      const uid = await userByEmail(input.email);
      if (!(await tenantScope(T!)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(await one(`SELECT pta_set_staff($1,$2,$3,$4) AS r`, [me, T, uid, input.on]));
      await log(input.on ? 'Partner manager granted' : 'Partner manager removed', `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'manage') {
      if (!T) forbid('Only partner managers of an institution do this.');
      fail(await one(`SELECT pta_manage($1,$2,$3,$4,$5,$6,$7,$8,$9::text[]) AS r`, [me, T, input.relId, input.step, input.expectedVersion, input.note, input.text, input.validTo, input.scopes]));
      await log(`Partner: ${input.step}`, `partner:${input.relId}`, input.note.slice(0, 200), 'Partner manager');
      const admins = (await sql.query(`SELECT m.user_id FROM pta_relationships r JOIN pta_members m ON m.org_id = r.org_id AND m.role = 'admin' AND m.removed_at IS NULL WHERE r.id = $1`, [input.relId])) as Row[];
      if (admins.length) await zite.messages.create({ record: { body: 'There is an update to your organization’s partnership in Semester. Open Partners to see it.', sender: me, recipients: admins.map((x) => String(x.user_id)), isNotification: true } as never }).catch(() => undefined);
    }

    // Read model.
    const now = new Date();
    const myOrgs = (await sql.query(`SELECT o.*, m.role FROM pta_orgs o JOIN pta_members m ON m.org_id = o.id WHERE m.user_id = $1 AND m.removed_at IS NULL ORDER BY o.name`, [me])) as Row[];
    const orgIds = myOrgs.map((o) => Number(o.id));
    const members = orgIds.length ? (await sql.query(`SELECT * FROM pta_members WHERE org_id = ANY($1::bigint[]) AND removed_at IS NULL ORDER BY role, added_at`, [orgIds])) as Row[] : [];
    const rels = orgIds.length ? (await sql.query(`SELECT * FROM pta_relationships WHERE org_id = ANY($1::bigint[]) ORDER BY updated_at DESC`, [orgIds])) as Row[] : [];
    const queue = manager && T ? (await sql.query(`SELECT r.*, o.name AS org_name, o.kind AS org_kind, o.website FROM pta_relationships r JOIN pta_orgs o ON o.id = r.org_id WHERE r.tenant_id = $1 ORDER BY (r.state IN ('applied','verified','agreement_pending')) DESC, r.updated_at DESC LIMIT 500`, [T])) as Row[] : [];
    const staff = isAdmin && T ? (await sql.query(`SELECT user_id FROM pta_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const institutions = await zite.institutions.findAll({ limit: 200 });
    const instName = Object.fromEntries(institutions.records.map((i) => [i.id, i.name ?? 'Institution']));
    const names = await userNames([...new Set([...members.map((m) => String(m.user_id)), ...staff.map((s) => String(s.user_id)), ...queue.flatMap((q) => [q.verified_by, q.proposed_by, q.accepted_by]).filter(Boolean).map(String)])]);
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    const rel = (r: Row) => {
      const st = String(r.state) as RelState, to = r.valid_to ? new Date(String(r.valid_to) + 'T23:59:59Z') : null;
      return { id: Number(r.id), institution: instName[String(r.tenant_id)] ?? 'Institution', state: st, status: relStatus(st, to, now), live: accessLive(st, to, now), version: Number(r.version),
        requestedScopes: (r.requested_scopes as string[]) ?? [], scopes: (r.scopes as string[]) ?? [], validTo: day(r.valid_to), agreementText: String(r.agreement_text), agreementHash: r.agreement_hash ? String(r.agreement_hash) : null,
        statusNote: String(r.status_note), acceptedAt: iso(r.accepted_at) };
    };

    return {
      result, scopes: SCOPES, isAdmin, manager, institutionName: a?.institutionName ?? null,
      institutions: institutions.records.filter((i) => !i.isSample).map((i) => ({ id: i.id, name: i.name ?? 'Institution' })),
      myOrgs: myOrgs.map((o) => ({ id: Number(o.id), name: String(o.name), kind: String(o.kind), website: String(o.website), role: String(o.role),
        members: members.filter((m) => String(m.org_id) === String(o.id)).map((m) => ({ name: names[String(m.user_id)] ?? 'Member', role: String(m.role), me: m.user_id === me })),
        relationships: rels.filter((r) => String(r.org_id) === String(o.id)).map(rel) })),
      queue: queue.map((r) => ({ ...rel(r), org: String(r.org_name), orgKind: String(r.org_kind), website: String(r.website), applicationNote: String(r.application_note),
        verifiedBy: nm(r.verified_by), verifiedByMe: r.verified_by === me, verificationNote: String(r.verification_note), proposedBy: nm(r.proposed_by), acceptedBy: nm(r.accepted_by) })),
      staff: staff.map((s) => nm(s.user_id)),
    };
  },
});
