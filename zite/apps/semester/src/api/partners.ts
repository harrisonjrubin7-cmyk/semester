import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { PTA_MIGRATION } from '../lib/ptaMigration';
import { TRF_MIGRATION } from '../lib/trfMigration';
import { PRC_MIGRATION } from '../lib/prcMigration';
import { SUP_MIGRATION } from '../lib/supMigration';
import { CNT_MIGRATION } from '../lib/cntMigration';
import { RSA_MIGRATION } from '../lib/rsaMigration';
import { SCOPES, relStatus, accessLive, RelState } from '../lib/partnerRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...TRF_MIGRATION, ...PTA_MIGRATION, ...PRC_MIGRATION, ...SUP_MIGRATION, ...CNT_MIGRATION, ...RSA_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
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
    z.object({ action: z.literal('articulate'), relId: z.number().int(), course: z.string().min(3).max(30), outcome: z.enum(['equivalent', 'elective', 'no_credit']), code: z.string().max(20).default(''),
      credits: z.number().positive().max(12).nullable(), term: z.string().min(4).max(20) }),
    z.object({ action: z.literal('orderAck'), relId: z.number().int(), poId: z.number().int(), kind: z.enum(['acknowledged', 'shipped']), note: z.string().max(300).default('') }),
    z.object({ action: z.literal('acceptContract'), contractId: z.number().int(), expectedVersion: z.number().int(), hash: z.string().min(10).max(100) }),
    z.object({ action: z.literal('submitResearch'), relId: z.number().int(), title: z.string().min(5).max(160), summary: z.string().min(20).max(4000), amountCents: z.number().int().min(0).max(1_000_000_000_00) }),
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
    if (input.action === 'articulate') {
      const out = await one(`SELECT pta_propose_articulation($1,$2,$3,$4,$5,$6,$7) AS r`, [me, input.relId, input.course, input.outcome, input.code || null, input.credits, input.term]);
      if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.');
      result = { ruleId: Number(out!.slice(3)) };
    }
    if (input.action === 'orderAck') {
      const rel = (await sql.query(`SELECT tenant_id, org_id FROM pta_relationships WHERE id = $1`, [input.relId])) as Row[];
      if (!rel.length) forbid('Relationship not found.');
      fail(await one(`SELECT sup_ack($1,$2,$3,$4,$5,$6) AS r`, [me, String(rel[0].tenant_id), Number(rel[0].org_id), input.poId, input.kind, input.note]));
      result = { acked: input.poId };
    }
    if (input.action === 'submitResearch') {
      const relRows = (await sql.query(`SELECT r.tenant_id, r.org_id FROM pta_relationships r WHERE r.id = $1 AND EXISTS (SELECT 1 FROM pta_members m WHERE m.org_id = r.org_id AND m.user_id = $2)`, [input.relId, me])) as Row[];
      const rel = relRows[0];
      if (!rel) forbid('That relationship is not yours.');
      fail(await one(`SELECT rsa_submit_partner($1,$2,$3,$4,$5,$6) AS r`, [me, String(rel!.tenant_id), Number(rel!.org_id), input.title, input.summary, input.amountCents]));
      result = { submitted: true };
    }
    if (input.action === 'acceptContract') {
      fail(await one(`SELECT cnt_accept($1,$2,$3,$4) AS r`, [me, input.contractId, input.expectedVersion, input.hash]));
      result = { accepted: input.contractId };
    }
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
    const arts = orgIds.length ? (await sql.query(`SELECT * FROM trf_rules WHERE partner_org_id = ANY($1::bigint[]) ORDER BY created_at DESC LIMIT 300`, [orgIds])) as Row[] : [];
    const ordersByRel = new Map<string, Row[]>();
    for (const r of rels) { if (String(r.state) === 'active' && ((r.scopes as string[]) ?? []).includes('view_orders')) ordersByRel.set(`${r.tenant_id}:${r.org_id}`, (await sql.query(`SELECT * FROM sup_orders($1,$2)`, [String(r.tenant_id), Number(r.org_id)])) as Row[]); }
    const contractsByRel = new Map<string, Row[]>();
    for (const r of rels) contractsByRel.set(`${r.tenant_id}:${r.org_id}`, (await sql.query(`SELECT * FROM cnt_contracts WHERE tenant_id = $1 AND org_id = $2 ORDER BY updated_at DESC LIMIT 100`, [String(r.tenant_id), Number(r.org_id)])) as Row[]);
    const researchByRel = new Map<string, Row[]>();
    for (const r of rels) researchByRel.set(`${r.tenant_id}:${r.org_id}`, (await sql.query(`SELECT * FROM rsa_requests WHERE tenant_id = $1 AND org_id = $2 ORDER BY created_at DESC LIMIT 50`, [String(r.tenant_id), Number(r.org_id)])) as Row[]);
    const rel = (r: Row) => {
      const st = String(r.state) as RelState, to = r.valid_to ? new Date(String(r.valid_to) + 'T23:59:59Z') : null;
      return { id: Number(r.id), institution: instName[String(r.tenant_id)] ?? 'Institution', state: st, status: relStatus(st, to, now), live: accessLive(st, to, now), version: Number(r.version),
        requestedScopes: (r.requested_scopes as string[]) ?? [], scopes: (r.scopes as string[]) ?? [], validTo: day(r.valid_to), agreementText: String(r.agreement_text), agreementHash: r.agreement_hash ? String(r.agreement_hash) : null,
        statusNote: String(r.status_note), acceptedAt: iso(r.accepted_at),
        articulations: arts.filter((x) => String(x.tenant_id) === String(r.tenant_id) && String(x.partner_org_id) === String(r.org_id))
          .map((x) => ({ id: Number(x.id), course: String(x.ext_course), outcome: String(x.outcome), code: (x.internal_code as string) ?? null, state: String(x.state), note: (x.decision_note as string) ?? '' })),
        orders: (ordersByRel.get(`${r.tenant_id}:${r.org_id}`) ?? []).map((x) => ({ poId: Number(x.po_id), supplier: String(x.supplier), description: String(x.description), amount: Number(x.amount), state: String(x.po_state), received: Number(x.received), invoiced: Number(x.invoiced), ackKind: x.ack_kind ? String(x.ack_kind) : null, ackAt: iso(x.ack_at) })),
        contracts: (contractsByRel.get(`${r.tenant_id}:${r.org_id}`) ?? []).map((x) => ({ id: Number(x.id), title: String(x.title), kind: String(x.kind), valueCents: Number(x.value_cents), startsOn: day(x.starts_on), endsOn: day(x.ends_on), state: String(x.state), version: Number(x.version), terms: String(x.terms_text), termsHash: x.terms_hash ? String(x.terms_hash) : null })),
        researchRequests: (researchByRel.get(`${r.tenant_id}:${r.org_id}`) ?? []).map((x) => ({ id: Number(x.id), title: String(x.title), state: String(x.state), projectCode: x.project_code ? String(x.project_code) : null, amountCents: Number(x.amount_cents) })) };
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
