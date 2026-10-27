import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { AUD_MIGRATION } from '../lib/audMigration';
import { AREAS, SEVERITIES, FINDING_LABEL, FindingState } from '../lib/auditRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of AUD_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
const SHA = z.string().regex(/^[0-9a-f]{64}$/, 'SHA-256 is 64 lowercase hex characters');
const KEY = z.string().min(8).max(80);

// Audit and Assurance (S-76 E32). Access is purpose-bound: an administrator grants a named person a purpose, areas and an end
// date (aud_grants); every read and write re-checks aud_live(), so revocation and expiry apply on the next request. There is
// no read-all role: administrators see grants and finding counts, auditors see only their live areas, management owners see
// only the findings issued to them (never the evidence). Evidence is a reference and a SHA-256, not a copy of the data.
// Approved synthetic testing stays in Security Lab. Rules: lib/audMigration.ts.
export default createEndpoint({
  description: 'Audit and assurance: purpose-bound auditor grants, controls, plans, evidence references, tests, findings, management response, remediation and independent verification',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('grant'), email: z.string().email().max(200), purpose: z.string().min(10).max(500), areas: z.array(z.enum(AREAS)).min(1).max(AREAS.length), days: z.number().int().min(1).max(180) }),
    z.object({ action: z.literal('revoke'), grantId: z.number().int() }),
    z.object({ action: z.literal('control'), code: z.string().regex(/^[A-Z]{2,6}-[0-9]{1,4}$/), area: z.enum(AREAS), title: z.string().min(3).max(200), objective: z.string().max(2000).default('') }),
    z.object({ action: z.literal('plan'), grantId: z.number().int(), area: z.enum(AREAS), title: z.string().min(3).max(200), note: z.string().max(2000).default('') }),
    z.object({ action: z.literal('planStep'), planId: z.number().int(), to: z.enum(['fieldwork', 'reporting', 'closed']), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('evidence'), planId: z.number().int(), ref: z.string().min(3).max(500), sha256: SHA, note: z.string().max(1000).default(''), requestKey: KEY }),
    z.object({ action: z.literal('reproduce'), evidenceId: z.number().int(), sha256: z.string().max(80) }),
    z.object({ action: z.literal('test'), planId: z.number().int(), controlId: z.number().int(), evidenceIds: z.array(z.number().int()).min(1).max(50), sampleSize: z.number().int().min(1).max(100000), result: z.enum(['pass', 'fail', 'exception']), note: z.string().max(2000).default('') }),
    z.object({ action: z.literal('issue'), planId: z.number().int(), controlId: z.number().int().nullable(), severity: z.enum(SEVERITIES), title: z.string().min(3).max(200), detail: z.string().max(4000).default(''), ownerEmail: z.string().email().max(200), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), requestKey: KEY }),
    z.object({ action: z.literal('finding'), findingId: z.number().int(), step: z.enum(['respond', 'remediate', 'verify_accept', 'verify_reject']), text: z.string().max(4000).default(''), evidenceId: z.number().int().nullable().default(null), expectedVersion: z.number().int() }),
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
    const ok = (out: string | null) => { if (!out || !(out.startsWith('ok:') || out.startsWith('replay:'))) forbid(out ?? 'Failed.'); return Number(out!.split(':')[1]); };
    const none = (out: string | null) => { if (out) forbid(out); };
    const userByEmail = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      if (!rows[0]) forbid('No Semester account uses that email. Ask them to sign in once first.');
      const id = String((rows[0] as Row).id);
      const { records } = await zite.memberships.findAll({ filters: { member: id }, limit: 20 });
      const inT = records.some((m) => m.status === 'Active' && ([] as string[]).concat((m.institution as unknown as string[] | string | undefined) ?? []).includes(T));
      if (!inT) forbid('That person is not an active member of this institution.');
      return id;
    };
    const notify = (to: string, body: string) => zite.messages.create({ record: { body, sender: me, recipients: [to], isNotification: true } as never }).catch(() => undefined);
    let result: unknown = null;

    if (input.action === 'grant') {
      if (!isAdmin) forbid('Only an administrator grants audit access.');
      const uid = await userByEmail(input.email);
      result = { grantId: ok(await one(`SELECT aud_grant($1,$2,$3,$4,$5,$6) AS r`, [me, T, uid, input.purpose, input.areas, input.days])) };
      await audit(a, 'audit.grant', `aud_grant:${String(result && (result as Row).grantId)}`, `${input.areas.join(',')} for ${input.days} days`, 'administrator');
      await notify(uid, `You have audit access to ${input.areas.join(', ')} for ${input.days} days: ${input.purpose}. Open Audit and assurance.`);
    }
    if (input.action === 'revoke') {
      if (!isAdmin) forbid('Only an administrator revokes audit access.');
      none(await one(`SELECT aud_revoke($1,$2,$3) AS r`, [me, T, input.grantId]));
      await audit(a, 'audit.revoke', `aud_grant:${input.grantId}`, '', 'administrator');
    }
    if (input.action === 'control') result = { controlId: ok(await one(`SELECT aud_control($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.code, input.area, input.title, input.objective])) };
    if (input.action === 'plan') result = { planId: ok(await one(`SELECT aud_plan($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.grantId, input.area, input.title, input.note])) };
    if (input.action === 'planStep') none(await one(`SELECT aud_plan_step($1,$2,$3,$4,$5) AS r`, [me, T, input.planId, input.to, input.expectedVersion]));
    if (input.action === 'evidence') result = { evidenceId: ok(await one(`SELECT aud_evidence_add($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.planId, input.ref, input.sha256, input.note, input.requestKey])) };
    if (input.action === 'reproduce') {
      const out = await one(`SELECT aud_reproduce($1,$2,$3,$4) AS r`, [me, T, input.evidenceId, input.sha256]);
      if (out !== 'match' && out !== 'mismatch') forbid(out ?? 'Failed.');
      result = { match: out === 'match' };
    }
    if (input.action === 'test') result = { testId: ok(await one(`SELECT aud_test($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, T, input.planId, input.controlId, input.evidenceIds, input.sampleSize, input.result, input.note])) };
    if (input.action === 'issue') {
      const owner = await userByEmail(input.ownerEmail);
      const fid = ok(await one(`SELECT aud_issue($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS r`, [me, T, input.planId, input.controlId, input.severity, input.title, input.detail, owner, input.due, input.requestKey]));
      result = { findingId: fid };
      await notify(owner, `An audit finding (${input.severity}) was issued to you: ${input.title}. Open Audit and assurance to respond.`);
    }
    if (input.action === 'finding') {
      none(await one(`SELECT aud_finding_step($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.findingId, input.step, input.text, input.evidenceId, input.expectedVersion]));
      const f = ((await sql.query(`SELECT owner_id, issued_by, title FROM aud_findings WHERE id = $1`, [input.findingId])) as Row[])[0];
      if (f && input.step.startsWith('verify')) await notify(String(f.owner_id), `Audit finding "${f.title}" was ${input.step === 'verify_accept' ? 'verified and closed' : 'returned: remediation not accepted'}.`);
      if (f && (input.step === 'respond' || input.step === 'remediate')) await notify(String(f.issued_by), `Management ${input.step === 'respond' ? 'responded to' : 'remediated'} audit finding "${f.title}".`);
    }

    // Reads, scoped by role. Live areas are re-read every request.
    const grants = (await sql.query(`SELECT * FROM aud_grants WHERE tenant_id = $1 AND (auditor_id = $2 OR $3) ORDER BY granted_at DESC LIMIT 200`, [T, me, isAdmin])) as Row[];
    const live = new Set<string>();
    for (const g of grants) if (g.auditor_id === me && !g.revoked_at && new Date(String(g.expires_at)) > new Date()) for (const ar of g.areas as string[]) live.add(ar);
    const areas = [...live];
    const plans = areas.length ? ((await sql.query(`SELECT * FROM aud_plans WHERE tenant_id = $1 AND area = ANY($2) ORDER BY created_at DESC LIMIT 100`, [T, areas])) as Row[]) : [];
    const planIds = plans.map((p) => Number(p.id));
    const controls = areas.length ? ((await sql.query(`SELECT * FROM aud_controls WHERE tenant_id = $1 AND area = ANY($2) ORDER BY code`, [T, areas])) as Row[]) : [];
    const evidence = planIds.length ? ((await sql.query(`SELECT * FROM aud_evidence WHERE plan_id = ANY($1) ORDER BY collected_at`, [planIds])) as Row[]) : [];
    const tests = planIds.length ? ((await sql.query(`SELECT * FROM aud_tests WHERE plan_id = ANY($1) ORDER BY tested_at`, [planIds])) as Row[]) : [];
    const findings = (await sql.query(`SELECT f.*, p.area, p.title AS plan_title FROM aud_findings f JOIN aud_plans p ON p.id = f.plan_id WHERE f.tenant_id = $1 AND (f.owner_id = $2 OR p.id = ANY($3)) ORDER BY f.created_at DESC LIMIT 300`, [T, me, planIds])) as Row[];
    const summary = isAdmin ? ((await sql.query(`SELECT p.area, f.state, count(*)::int AS n FROM aud_findings f JOIN aud_plans p ON p.id = f.plan_id WHERE f.tenant_id = $1 GROUP BY 1, 2`, [T])) as Row[]) : [];
    if (areas.length && input.action === 'get') await sql.query(`INSERT INTO aud_events (tenant_id, subject, step, actor_id, note) VALUES ($1, 'access', 'view', $2, $3)`, [T, me, areas.join(',')]);
    const names = await userNames([...grants.flatMap((g) => [g.auditor_id, g.granted_by, g.revoked_by]), ...findings.flatMap((f) => [f.owner_id, f.issued_by, f.remediated_by, f.verified_by]), ...evidence.map((e) => e.collected_by), ...tests.map((t) => t.tester_id)].filter(Boolean).map(String));
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    const ctl = (id: unknown) => { const c = controls.find((x) => String(x.id) === String(id)); return c ? `${c.code} ${c.title}` : null; };

    return {
      result, isAdmin, areas, institutionName: a.institutionName,
      grants: grants.map((g) => ({ id: Number(g.id), auditor: nm(g.auditor_id), mine: g.auditor_id === me, purpose: String(g.purpose), areas: g.areas as string[], grantedBy: nm(g.granted_by),
        grantedAt: iso(g.granted_at), expiresAt: iso(g.expires_at), revokedAt: iso(g.revoked_at), revokedBy: nm(g.revoked_by), live: !g.revoked_at && new Date(String(g.expires_at)) > new Date() })),
      controls: controls.map((c) => ({ id: Number(c.id), code: String(c.code), area: String(c.area), title: String(c.title), objective: String(c.objective) })),
      plans: plans.map((p) => ({ id: Number(p.id), area: String(p.area), title: String(p.title), scopeNote: String(p.scope_note), state: String(p.state), version: Number(p.version), grantId: Number(p.grant_id),
        evidence: evidence.filter((e) => String(e.plan_id) === String(p.id)).map((e) => ({ id: Number(e.id), ref: String(e.ref), sha256: String(e.sha256), note: String(e.note), collectedBy: nm(e.collected_by), collectedAt: iso(e.collected_at) })),
        tests: tests.filter((t) => String(t.plan_id) === String(p.id)).map((t) => ({ id: Number(t.id), control: ctl(t.control_id), evidenceIds: (t.evidence_ids as unknown[]).map(Number), sampleSize: Number(t.sample_size), result: String(t.result), note: String(t.note), tester: nm(t.tester_id), testedAt: iso(t.tested_at) })) })),
      findings: findings.map((f) => {
        const auditorView = planIds.includes(Number(f.plan_id));
        return { id: Number(f.id), planTitle: String(f.plan_title), area: String(f.area), severity: String(f.severity), title: String(f.title), detail: String(f.detail), state: String(f.state),
          stateLabel: FINDING_LABEL[String(f.state) as FindingState], owner: nm(f.owner_id), mineToAnswer: f.owner_id === me, auditorView, issuedBy: nm(f.issued_by), due: day(f.due),
          response: String(f.response), remediationNote: String(f.remediation_note), remediatedBy: nm(f.remediated_by), remediatedByMe: f.remediated_by === me, remediatedAt: iso(f.remediated_at),
          verifiedBy: nm(f.verified_by), verifiedAt: iso(f.verified_at), verifyEvidenceId: auditorView && f.verify_evidence_id ? Number(f.verify_evidence_id) : null, version: Number(f.version), control: ctl(f.control_id) };
      }),
      summary: summary.map((s) => ({ area: String(s.area), state: String(s.state), n: Number(s.n) })),
    };
  },
});
