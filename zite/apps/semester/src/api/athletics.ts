import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope, ids } from '../lib/server';
import { pg } from '../lib/pg';
import { ATH_MIGRATION, ATH_RULE_KINDS } from '../lib/athMigration';
import { computeFacts, EnrolRow, Facts } from '../lib/athleticsFacts';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of ATH_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Athletics compliance: the institution's versioned eligibility rules, teams and rosters, term roster reviews evaluated in the
// database on facts computed here from enrolments, course credits and current official grades, exceptions with a second
// officer, and certification by someone other than the opener. Officers and administrators only; athletes' facts stay here.
export default createEndpoint({
  description: 'Athletics compliance: versioned eligibility rules, rosters, term roster reviews, exceptions and certification',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setOfficer'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('rules'), step: z.enum(['draft', 'edit', 'approve']), id: z.number().int().nullable(), expectedVersion: z.number().int().nullable(),
      rules: z.array(z.object({ kind: z.enum(ATH_RULE_KINDS), value: z.number() })).max(10).optional(), note: z.string().max(500).optional(), seen: z.string().max(64).optional() }),
    z.object({ action: z.literal('team'), step: z.enum(['create', 'add', 'remove']), teamId: z.number().int().nullable(), name: z.string().max(120).optional(), sport: z.string().max(60).optional(), email: z.string().email().max(200).optional(), studentId: z.string().max(80).optional() }),
    z.object({ action: z.literal('openReview'), teamId: z.number().int(), term: z.string().min(3).max(40) }),
    z.object({ action: z.literal('line'), step: z.enum(['eligible', 'ineligible', 'request_exception', 'approve_exception']), reviewId: z.number().int(), studentId: z.string().max(80), reason: z.string().max(2000).optional(), reference: z.string().max(200).optional() }),
    z.object({ action: z.literal('certify'), reviewId: z.number().int(), expectedVersion: z.number().int(), note: z.string().max(1000).optional() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const officer = ((await sql.query(`SELECT ath_is_officer($1,$2) AS o`, [T, me])) as { o: boolean }[])[0].o;
    if (!officer && !isAdmin) forbid('Athletics compliance is for compliance officers and institution administrators.');
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const okOr = (r: string | null) => { if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.'); return r!.slice(3); };
    const scope = await tenantScope(T);
    const byEmail = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !scope.members.has(uid)) forbid('That person is not a member of your institution.');
      return uid!;
    };

    if (input.action === 'setOfficer') {
      const uid = await byEmail(input.email);
      const r = await one(`SELECT ath_set_officer($1,$2,$3,$4,$5) AS r`, [T, me, isAdmin, uid, input.on]); if (r) forbid(r);
      await audit(a, input.on ? 'Athletics compliance officer appointed' : 'Athletics compliance officer removed', `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'rules') {
      const id = okOr(await one(`SELECT ath_rule_set($1,$2,$3,$4,$5,$6::jsonb,$7,$8) AS r`, [T, me, input.step, input.id, input.expectedVersion, input.rules ? JSON.stringify(input.rules) : null, input.note ?? null, input.seen ?? null]));
      if (input.step === 'approve') await audit(a, 'Eligibility rules approved', `athRules:${id}`, '', 'Compliance officer');
    }
    if (input.action === 'team') {
      const sid = input.step === 'add' ? await byEmail(input.email ?? '') : input.studentId ?? null;
      okOr(await one(`SELECT ath_team($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, input.step, input.teamId, input.name ?? null, input.sport ?? null, sid]));
    }
    if (input.action === 'openReview') {
      // Facts for every active roster athlete, from this institution's sections only.
      const roster = ((await sql.query(`SELECT student_id FROM ath_roster r JOIN ath_teams t ON t.id = r.team_id WHERE r.team_id = $1 AND t.tenant_id = $2 AND r.active`, [input.teamId, T])) as Row[]).map((r) => String(r.student_id));
      const facts: Record<string, Facts> = {};
      const secCache = new Map<string, { term: string | null; credits: number }>();
      for (const sid of roster) {
        const enr = (await zite.enrollments.findAll({ filters: { student: sid }, limit: 500 })).records;
        const rows: EnrolRow[] = [];
        for (const e of enr) {
          const secId = ids(e.section)[0];
          if (!secId || !scope.sections.has(secId)) continue;
          if (!secCache.has(secId)) {
            const s = await zite.sections.findOne({ id: secId });
            const cId = s ? ids(s.course)[0] : undefined;
            const c = cId ? await zite.courses.findOne({ id: cId }) : null;
            secCache.set(secId, { term: s?.term ?? null, credits: Number(c?.credits ?? 0) });
          }
          const grades = ids(e.officialGradeRecords).length ? (await zite.officialGradeRecords.findAll({ filters: { enrollment: e.id }, limit: 20 })).records.filter((g) => g.recordState === 'Current') : [];
          const sc = secCache.get(secId)!;
          rows.push({ status: String(e.status ?? ''), term: sc.term, credits: sc.credits, grade: grades[0]?.grade ?? null });
        }
        facts[sid] = computeFacts(rows, input.term);
      }
      const id = okOr(await one(`SELECT ath_open_review($1,$2,$3,$4,$5::jsonb) AS r`, [T, me, input.teamId, input.term, JSON.stringify(facts)]));
      await audit(a, 'Athletics roster review opened', `athReview:${id}`, input.term, 'Compliance officer');
    }
    if (input.action === 'line') okOr(await one(`SELECT ath_line($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, input.step, input.reviewId, input.studentId, input.reason ?? null, input.reference ?? null]));
    if (input.action === 'certify') {
      const id = okOr(await one(`SELECT ath_certify($1,$2,$3,$4,$5,$6) AS r`, [T, me, isAdmin, input.reviewId, input.expectedVersion, input.note ?? null]));
      await audit(a, 'Athletics roster review certified', `athReview:${id}`, input.note ?? '', isAdmin && !officer ? 'Administrator' : 'Compliance officer');
    }

    const [rules, teams, roster, reviews, lines, officers] = await Promise.all([
      sql.query(`SELECT * FROM ath_rule_sets WHERE tenant_id = $1 ORDER BY version DESC LIMIT 10`, [T]) as Promise<Row[]>,
      sql.query(`SELECT * FROM ath_teams WHERE tenant_id = $1 AND active ORDER BY name`, [T]) as Promise<Row[]>,
      sql.query(`SELECT r.* FROM ath_roster r JOIN ath_teams t ON t.id = r.team_id WHERE t.tenant_id = $1 AND r.active`, [T]) as Promise<Row[]>,
      sql.query(`SELECT v.*, s.version AS rules_version FROM ath_reviews v JOIN ath_rule_sets s ON s.id = v.rule_set_id WHERE v.tenant_id = $1 ORDER BY v.created_at DESC LIMIT 50`, [T]) as Promise<Row[]>,
      sql.query(`SELECT l.* FROM ath_review_lines l JOIN ath_reviews v ON v.id = l.review_id WHERE v.tenant_id = $1`, [T]) as Promise<Row[]>,
      sql.query(`SELECT user_id FROM ath_officers WHERE tenant_id = $1 AND revoked_at IS NULL`, [T]) as Promise<Row[]>,
    ]);
    const names = await userNames([...roster.map((r) => String(r.student_id)), ...officers.map((o) => String(o.user_id)), ...rules.flatMap((r) => [String(r.author_id), String(r.approver_id ?? '')]),
      ...reviews.flatMap((v) => [String(v.opened_by), String(v.certified_by ?? '')]), ...lines.flatMap((l) => [String(l.exception_by ?? ''), String(l.exception_approved_by ?? '')])].filter(Boolean));
    const nm = (id: unknown) => (id ? names[String(id)] ?? 'Member' : null);
    return {
      me, officer, isAdmin, kinds: ATH_RULE_KINDS, officers: officers.map((o) => nm(o.user_id)),
      rules: rules.map((r) => ({ id: Number(r.id), version: Number(r.version), rules: r.rules as { kind: string; value: number }[], hash: String(r.rules_hash), note: String(r.note), state: String(r.state), mine: r.author_id === me, author: nm(r.author_id), approver: nm(r.approver_id), approvedAt: iso(r.approved_at), rev: Number(r.rev) })),
      teams: teams.map((t) => ({ id: Number(t.id), name: String(t.name), sport: String(t.sport), roster: roster.filter((r) => Number(r.team_id) === Number(t.id)).map((r) => ({ id: String(r.student_id), name: nm(r.student_id) })) })),
      reviews: reviews.map((v) => ({ id: Number(v.id), teamId: Number(v.team_id), team: String(teams.find((t) => Number(t.id) === Number(v.team_id))?.name ?? 'Team'), term: String(v.term), rulesVersion: Number(v.rules_version), state: String(v.state),
        openedBy: nm(v.opened_by), openedByMe: v.opened_by === me, certifiedBy: nm(v.certified_by), certifiedAt: iso(v.certified_at), note: String(v.note), rev: Number(v.rev),
        lines: lines.filter((l) => Number(l.review_id) === Number(v.id)).map((l) => ({ studentId: String(l.student_id), name: nm(l.student_id), facts: l.facts as Facts, results: l.results as { kind: string; required: number; actual: number | null; pass: boolean }[], passes: Boolean(l.passes),
          outcome: l.outcome ? String(l.outcome) : null, exceptionReason: l.exception_reason ? String(l.exception_reason) : null, exceptionRef: l.exception_ref ? String(l.exception_ref) : null, exceptionBy: nm(l.exception_by), exceptionByMe: l.exception_by === me, exceptionApprovedBy: nm(l.exception_approved_by) })) })),
    };
  },
});
