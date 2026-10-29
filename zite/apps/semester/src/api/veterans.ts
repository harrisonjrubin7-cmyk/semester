import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, ids, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { VET_MIGRATION, VET_CHAPTERS } from '../lib/vetMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of VET_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const ENROLLED = ['Enrolled', 'Completed'];

/** The student's enrolled sections in a term at this institution, with course credits. Computed here, never sent by a client. */
async function termLines(student: string, term: string, tenant: string) {
  const enr = (await zite.enrollments.findAll({ filters: { student }, limit: 500 })).records.filter((e) => ENROLLED.includes(e.status ?? ''));
  const scope = await tenantScope(tenant);
  const out: { sectionId: string; course: string; credits: number }[] = [];
  for (const e of enr) {
    const secId = ids(e.section)[0];
    if (!secId || !scope.sections.has(secId)) continue;   // this institution's sections only
    const s = await zite.sections.findOne({ id: secId });
    if (!s || (s.term ?? '').toLowerCase() !== term.toLowerCase()) continue;
    const c = ids(s.course)[0] ? await zite.courses.findOne({ id: ids(s.course)[0] }) : null;
    out.push({ sectionId: s.id, course: (s.label ?? c?.title ?? 'Course').split(' · ')[0], credits: Number(c?.credits ?? 0) });
  }
  return out;
}

// Veterans benefits certification (vet-001): student intake; certifying-official review of each enrolled course; certification
// computed in the database; VA reference recorded after the official submits in the VA's own system (nothing is sent from here).
export default createEndpoint({
  description: 'Veterans benefits: student certification requests and certifying-official review (no submission to the VA from here)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('intake'), term: z.string().max(40), chapter: z.enum(VET_CHAPTERS), level: z.enum(['undergraduate', 'graduate']), program: z.string().max(120), coeOnFile: z.boolean() }),
    z.object({ action: z.literal('review'), step: z.enum(['start', 'amend', 'decide', 'return', 'certify', 'record_ref', 'withdraw']), id: z.number().int(), version: z.number().int(),
      lineId: z.number().int().optional(), applicable: z.boolean().optional(), reason: z.string().max(1000).optional(), reference: z.string().max(80).optional() }),
    z.object({ action: z.literal('official'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('policy'), level: z.enum(['undergraduate', 'graduate']), full: z.number().min(1).max(30), threeQuarter: z.number().min(0.5).max(30), half: z.number().min(0.5).max(30) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const official = ((await sql.query(`SELECT vet_is_official($1,$2) AS o`, [T, me])) as { o: boolean }[])[0].o;
    const student = a.roles.includes('Student');
    const call = async (q: string, p: unknown[]) => { const r = ((await sql.query(q, p)) as { r: string | null }[])[0].r; if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.'); return r!.slice(3); };

    if (input.action === 'intake') {
      const { action: _a, ...p } = input;
      await call(`SELECT vet_intake($1,$2,$3,$4::jsonb) AS r`, [T, me, student, JSON.stringify(p)]);
    } else if (input.action === 'review') {
      const req = ((await sql.query(`SELECT student_id, term FROM vet_requests WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!req) forbid('Request not found.');
      const p: Record<string, unknown> = { lineId: input.lineId, applicable: input.applicable, reason: input.reason, reference: input.reference };
      if (input.step === 'start' || input.step === 'amend') p.lines = await termLines(String(req.student_id), String(req.term), T);
      await call(`SELECT vet_review($1,$2,$3,$4,$5,$6::jsonb) AS r`, [T, me, input.step, input.id, input.version, JSON.stringify(p)]);
      if (['certify', 'record_ref', 'return'].includes(input.step)) await audit(a, `Veterans certification ${input.step}`, `vet:${input.id}`, '', official ? 'Certifying official' : 'Student');
    } else if (input.action === 'official') {
      const u = (await zite.auth.findAllUsers({ limit: 500 })).records.find((x) => (x.email ?? '').toLowerCase() === input.email.toLowerCase());
      if (!u) forbid('No user with that email.');
      const m = (await zite.memberships.findAll({ filters: { institution: T }, limit: 2000 })).records.some((x) => ids(x.member).includes(u!.id) && x.status === 'Active');
      if (!m) forbid('That person is not an active member of this institution.');
      await call(`SELECT vet_set_official($1,$2,$3,$4,$5) AS r`, [T, me, isAdmin, u!.id, input.on]);
      await audit(a, input.on ? 'Certifying official appointed' : 'Certifying official removed', `user:${u!.id}`, '', 'Administrator');
    } else if (input.action === 'policy') {
      await call(`SELECT vet_set_policy($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.level, input.full, input.threeQuarter, input.half]);
    }

    // Students see only their own requests; officials see the institution's queue; administrators see the official list only.
    const reqs = (official
      ? await sql.query(`SELECT * FROM vet_requests WHERE tenant_id = $1 AND (state <> 'withdrawn' OR student_id = $2) ORDER BY state = 'certified', created_at DESC LIMIT 200`, [T, me])
      : await sql.query(`SELECT * FROM vet_requests WHERE tenant_id = $1 AND student_id = $2 ORDER BY created_at DESC`, [T, me])) as Row[];
    const idsList = reqs.map((r) => Number(r.id));
    const [lines, certs, pols, offs] = await Promise.all([
      idsList.length ? sql.query(`SELECT * FROM vet_lines WHERE request_id = ANY($1::bigint[]) ORDER BY id`, [idsList]) as Promise<Row[]> : Promise.resolve([] as Row[]),
      idsList.length ? sql.query(`SELECT * FROM vet_certifications WHERE request_id = ANY($1::bigint[]) ORDER BY id`, [idsList]) as Promise<Row[]> : Promise.resolve([] as Row[]),
      sql.query(`SELECT level, t.full_time, t.three_quarter, t.half_time, t.confirmed_by FROM unnest(ARRAY['undergraduate', 'graduate']) level, LATERAL vet_threshold($1, level) t`, [T]) as Promise<Row[]>,
      (isAdmin || official) ? sql.query(`SELECT user_id FROM vet_officials WHERE tenant_id = $1 AND revoked_at IS NULL`, [T]) as Promise<Row[]> : Promise.resolve([] as Row[]),
    ]);
    // Enrolment drift: an official sees when the current enrolled credits differ from what was certified.
    const drift: Record<number, number | null> = {};
    if (official) for (const r of reqs.filter((x) => x.state === 'certified')) {
      const cur = certs.filter((c) => Number(c.request_id) === Number(r.id) && !c.superseded_by)[0];
      if (!cur) continue;
      const now = await termLines(String(r.student_id), String(r.term), T);
      const was = ((cur.facts as { lines: { sectionId: string }[] }).lines ?? []).map((l) => l.sectionId).sort().join(',');
      drift[Number(r.id)] = was === now.map((l) => l.sectionId).sort().join(',') ? null : now.reduce((s, l) => s + l.credits, 0);
    }
    const names = await userNames([...reqs.map((r) => String(r.student_id)), ...certs.map((c) => String(c.certified_by)), ...offs.map((o) => String(o.user_id))]);
    return {
      me, official, isAdmin, student, chapters: VET_CHAPTERS,
      policies: pols.map((p) => ({ level: String(p.level), full: Number(p.full_time), threeQuarter: Number(p.three_quarter), half: Number(p.half_time), confirmed: !!p.confirmed_by })),
      officials: offs.map((o) => names[String(o.user_id)] ?? 'Member'),
      requests: reqs.map((r) => ({
        id: Number(r.id), student: official ? names[String(r.student_id)] ?? 'Student' : 'You', mine: r.student_id === me, term: String(r.term), chapter: String(r.chapter), level: String(r.level),
        program: String(r.program), coeOnFile: !!r.coe_on_file, state: String(r.state), returnReason: String(r.return_reason), version: Number(r.version), createdAt: iso(r.created_at),
        lines: lines.filter((l) => Number(l.request_id) === Number(r.id)).map((l) => ({ id: Number(l.id), course: String(l.course), credits: Number(l.credits), applicable: l.applicable as boolean | null, reason: String(l.reason) })),
        certifications: certs.filter((c) => Number(c.request_id) === Number(r.id)).map((c) => ({ id: Number(c.id), credits: Number(c.credits), trainingTime: String(c.training_time), by: names[String(c.certified_by)] ?? 'Official',
          at: iso(c.certified_at), current: !c.superseded_by, amends: c.amends ? Number(c.amends) : null, vaRef: (c.external_ref as string) ?? null })),
        driftCredits: drift[Number(r.id)] ?? null, drifted: Number(r.id) in drift && drift[Number(r.id)] !== null,
      })),
    };
  },
});
