import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { PTA_MIGRATION } from '../lib/ptaMigration';
import { RSA_MIGRATION } from '../lib/rsaMigration';
import { GRT_MIGRATION } from '../lib/grtMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...PTA_MIGRATION, ...RSA_MIGRATION, ...GRT_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

// E24 Grants and Sponsored Projects: grant register on E23 projects, two-person sponsor
// verification, PI spend reports. Rules: lib/grtMigration.ts.
export default createEndpoint({
  description: 'Sponsored-project grants: recording, sponsor verification, activation, and spend reports',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('create'), projectCode: z.string().max(20).default(''), sponsorOrgId: z.number().int().nullable().default(null), sponsorName: z.string().min(2).max(160), title: z.string().min(5).max(160), amountCents: z.number().int().min(1).max(1_000_000_000_00), piEmail: z.string().email().max(200), startsOn: DATE, endsOn: DATE }),
    z.object({ action: z.literal('verify'), id: z.number().int(), note: z.string().min(5).max(500) }),
    z.object({ action: z.literal('activate'), id: z.number().int() }),
    z.object({ action: z.literal('decline'), id: z.number().int(), note: z.string().min(5).max(500) }),
    z.object({ action: z.literal('report'), id: z.number().int(), period: z.string().min(3).max(60), spentCents: z.number().int().min(0).max(1_000_000_000_00), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('close'), id: z.number().int() }),
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
    const memberByEmail = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      return uid;
    };
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage grants officers.');
      const uid = await memberByEmail(input.email);
      fail(await one(`SELECT grt_set_staff($1,$2,$3,$4) AS r`, [me, T, uid, input.on]));
      await audit(a, `Grants officer ${input.on ? 'granted' : 'revoked'}`, `grt_staff:${uid}`, '', 'Administrator');
    }
    if (input.action === 'create') {
      const pi = await memberByEmail(input.piEmail);
      const out = await one(`SELECT grt_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS r`, [me, T, input.projectCode || null, input.sponsorOrgId, input.sponsorName, input.title, input.amountCents, pi, input.startsOn ?? null, input.endsOn ?? null]);
      if (!out || !out.startsWith('ok:')) forbid(out ?? 'Failed.');
      const newId = Number(out!.split(':')[1]);
      result = { grantId: newId };
      await audit(a, 'Grant recorded', `grt_grant:${newId}`, `${input.sponsorName} · ${input.title}`, 'Grants officer');
    }
    if (input.action === 'verify') { fail(await one(`SELECT grt_verify($1,$2,$3,$4) AS r`, [me, T, input.id, input.note])); await audit(a, 'Grant sponsor verified', `grt_grant:${input.id}`, input.note.slice(0, 200), 'Grants officer'); }
    if (input.action === 'activate') fail(await one(`SELECT grt_activate($1,$2,$3) AS r`, [me, T, input.id]));
    if (input.action === 'decline') { fail(await one(`SELECT grt_decline($1,$2,$3,$4) AS r`, [me, T, input.id, input.note])); await audit(a, 'Grant declined', `grt_grant:${input.id}`, input.note.slice(0, 200), 'Grants officer'); }
    if (input.action === 'report') fail(await one(`SELECT grt_report($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.id, input.period, input.spentCents, input.note]));
    if (input.action === 'close') fail(await one(`SELECT grt_close($1,$2,$3) AS r`, [me, T, input.id]));

    const isOfficer = Boolean(((await sql.query(`SELECT grt_is_officer($1,$2) AS b`, [T, me])) as Row[])[0]?.b);
    const [grants, reports, projects, orgs, staff] = await Promise.all([
      sql.query(isOfficer
        ? `SELECT g.*, r.project_code FROM grt_grants g LEFT JOIN rsa_requests r ON r.id = g.project_id WHERE g.tenant_id = $1 ORDER BY g.created_at DESC LIMIT 200`
        : `SELECT g.*, r.project_code FROM grt_grants g LEFT JOIN rsa_requests r ON r.id = g.project_id WHERE g.tenant_id = $1 AND g.pi_id = $2 ORDER BY g.created_at DESC LIMIT 100`, isOfficer ? [T] : [T, me]),
      sql.query(`SELECT rep.* FROM grt_reports rep JOIN grt_grants g ON g.id = rep.grant_id WHERE g.tenant_id = $1 ORDER BY rep.at DESC LIMIT 400`, [T]),
      sql.query(`SELECT project_code, title FROM rsa_requests WHERE tenant_id = $1 AND project_code IS NOT NULL AND state IN ('approved','closed') ORDER BY project_code`, [T]),
      sql.query(`SELECT id, name FROM pta_orgs ORDER BY name`),
      sql.query(`SELECT user_id FROM grt_staff WHERE tenant_id = $1 AND revoked_at IS NULL ORDER BY granted_at`, [T]),
    ]) as [Row[], Row[], Row[], Row[], Row[]];
    const orgName = new Map(orgs.map((o) => [String(o.id), String(o.name)]));
    const names = await userNames([...grants.flatMap((g) => [g.pi_id, g.created_by, g.verified_by]), ...reports.map((r) => r.actor_id), ...staff.map((s) => s.user_id)].filter(Boolean).map(String));
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
    return {
      result, isAdmin, isOfficer, institutionName: a.institutionName ?? null,
      officers: staff.map((s) => ({ name: nm(s.user_id), me: s.user_id === me })),
      projects: projects.map((p) => ({ code: String(p.project_code), title: String(p.title) })),
      orgs: orgs.map((o) => ({ id: Number(o.id), name: String(o.name) })),
      grants: grants.map((g) => { const reps = reports.filter((r) => String(r.grant_id) === String(g.id)); const latest = reps[0];
        return { id: Number(g.id), title: String(g.title), sponsor: String(g.sponsor_name), sponsorOrg: g.sponsor_org_id ? orgName.get(String(g.sponsor_org_id)) ?? null : null,
          projectCode: g.project_code ? String(g.project_code) : null, amountCents: Number(g.amount_cents), pi: nm(g.pi_id), piMe: g.pi_id === me,
          state: String(g.state), createdBy: nm(g.created_by), createdByMe: g.created_by === me,
          verifiedBy: nm(g.verified_by), verificationNote: String(g.verification_note), startsOn: day(g.starts_on), endsOn: day(g.ends_on),
          spentCents: latest ? Number(latest.spent_cents) : 0,
          reports: reps.slice(0, 12).map((r) => ({ period: String(r.period), spentCents: Number(r.spent_cents), note: String(r.note), by: nm(r.actor_id), at: iso(r.at) })) }; }),
    };
  },
});
