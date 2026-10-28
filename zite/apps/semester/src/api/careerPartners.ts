import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAction, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { CRR_DECISIONS } from '../lib/crrMigration';
import { ensureCrr } from '../lib/crrServer';

type Row = Record<string, unknown>;

export default createEndpoint({
  description: 'Career partnerships: institution staff approve, decline or revoke employers who want to reach their students',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('decide'), employerId: z.string(), decision: z.enum(CRR_DECISIONS), expectedVersion: z.number().int(), note: z.string().max(500) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'approval.decide');
    const isStaff = a.roles.some((r) => r === 'Staff' || r === 'Administrator');
    if (!isStaff) forbid('Only institution staff decide employer partnerships.');
    await ensureCrr();
    const T = a.institutionId;
    if (input.action === 'decide') {
      const r = String(((await pg().query(`SELECT crr_decide($1,$2,$3,$4,$5,$6,$7) AS r`, [a.userId, T, isStaff, input.employerId, input.decision, input.expectedVersion, input.note])) as Row[])[0].r);
      if (!r.startsWith('ok')) forbid(r);
      await audit(a, `Employer partnership ${input.decision.toLowerCase()}`, `employer:${input.employerId}`, input.note, a.roles.join(', '));
      return { ok: true };
    }
    const rows = (await pg().query(`SELECT employer_id, employer_name, status, version, requested_at, decided_by, decided_at, note FROM crr_partners WHERE tenant_id = $1 ORDER BY (status = 'Pending') DESC, requested_at DESC LIMIT 500`, [T])) as Row[];
    const names = await userNames(rows.map((r) => String(r.decided_by ?? '')).filter(Boolean));
    return {
      partners: rows.map((r) => ({
        employerId: String(r.employer_id), name: String(r.employer_name), status: String(r.status), version: Number(r.version),
        requestedAt: new Date(String(r.requested_at)).toISOString(), decidedBy: r.decided_by ? names[String(r.decided_by)] ?? 'Staff' : null, note: String(r.note ?? ''),
      })),
    };
  },
});
