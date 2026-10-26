import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { tenantSources } from '../lib/sourcesServer';
import { sisBlock } from '../lib/sources';
import { pg, ensureSchema, sha256, dispatchOutbox } from '../lib/pg';
import { zite } from 'zitejs/db';
import { requireAction, first, forbid, audit, tenantScope } from '../lib/server';
import { decideRegistration } from '../lib/registrarRules';

/**
 * Registrar commits or rejects a submitted registration request. Rules live in lib/registrarRules (unit-tested).
 * Commits run as one Postgres transaction (lib/pg.ts, migrations/001) with a row lock on capacity and an idempotency key.
 */
export default createEndpoint({
  description: 'Registrar commits or rejects a submitted registration request with capacity and version checks',
  authenticated: true,
  inputSchema: z.object({
    requestId: z.string(),
    decision: z.enum(['commit', 'reject']),
    expectedSectionVersion: z.number().int(),
    note: z.string().max(500).optional(),
  }),
  outputSchema: z.object({ state: z.string(), resultCode: z.string(), message: z.string() }),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'registration.request.decide');
    const tenant = await tenantScope(a.institutionId);
    const req = await zite.registrationRequests.findOne({ id: input.requestId });
    if (!req) forbid('That request is not in your institution.');
    const sectionId = first(req!.section) ?? '';
    const section = sectionId ? await zite.sections.findOne({ id: sectionId }) : null;
    const { rows } = await zite.sql({
      query: `SELECT COUNT(*)::int AS n FROM "Enrollments" e JOIN "EnrollmentsSections" l ON l."enrollmentsId" = e.id WHERE l."sectionsId" = $1 AND e."status" = 'Enrolled'`,
      params: [sectionId],
    });
    const version = section?.recordVersion ?? 1;
    const out = decideRegistration({
      decider: { id: a.userId, institutionId: a.institutionId },
      request: { studentId: first(req!.student) ?? '', institutionId: first(req!.institution) ?? '', state: req!.state ?? 'Submitted', sectionInTenant: tenant.sections.has(sectionId) },
      section: { version, state: section?.sectionState, capacity: section?.capacity ?? null, enrolled: Number((rows[0] as { n?: number })?.n ?? 0) },
      expectedVersion: input.expectedSectionVersion,
      decision: input.decision,
    });

    if (out.kind === 'deny') forbid(out.message);
    if (out.kind === 'noop') return { state: req!.state!, resultCode: req!.resultCode ?? 'OK', message: 'Already decided — no change made.' };
    if (out.kind === 'stale') return { state: req!.state ?? 'Submitted', resultCode: 'STALE_VERSION', message: 'The section changed since you opened it. Reload and review again.' };

    // Invariant-bearing write: command + seat + receipt + audit + outbox in ONE Postgres transaction (reg_decide).
    // Capacity is enforced there under a row lock, so concurrent commits cannot oversell a section.
    // Stale source feeds block consequential commands (contract). Rejections still go through.
    if (out.kind !== 'reject') {
      const blocked = sisBlock(await tenantSources(a.institutionId));
      if (blocked) return { state: req!.state ?? 'Submitted', resultCode: 'SOURCE_STALE', message: blocked };
    }
    await ensureSchema();
    const studentId = first(req!.student) ?? '';
    const decision = out.kind === 'reject' ? 'reject' : 'commit';
    const note = out.kind === 'reject' ? (input.decision === 'reject' && input.note ? input.note : out.message) : input.note ?? '';
    const commandKey = `registrar:${req!.id}`;
    const hash = await sha256(JSON.stringify({ requestId: req!.id, decision, sectionId, studentId }));
    const res = (await pg().query(`SELECT reg_decide($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS r`,
      [a.institutionId, commandKey, hash, a.userId, decision, sectionId, studentId, req!.id, section?.capacity ?? null, note])) as { r: { conflict?: boolean; replay?: boolean; state: string; resultCode: string; message: string } }[];
    const r = res[0].r;
    if (r.conflict) throw new ZiteError('This request was already decided differently. Reload before deciding again.');
    if (!r.replay) {
      await audit(a, `Registration ${r.state.toLowerCase()}`, `registrationRequest:${req!.id}`, `${r.resultCode} · receipt ${commandKey}`, 'Registrar');
      if (r.state === 'Committed') await zite.sections.update({ id: sectionId, record: { recordVersion: version + 1 } as never });
    }
    // Side effect on Zite records: dispatched from the outbox. If it fails it stays pending until reconciled.
    const d = await dispatchOutbox(a.institutionId, commandKey);
    const suffix = d.failed ? ' Saved in the registrar ledger; the student record will update when reconciliation runs.' : '';
    return { state: r.state, resultCode: r.resultCode, message: r.message + suffix };
  },
});
