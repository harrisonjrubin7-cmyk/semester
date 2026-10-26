import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/fin';
import { ensureAtlas } from '../lib/atlasServer';
import { rolesOf } from '../lib/coRoles';
import { DIMENSIONS, satisfied, coverage, SEVERITIES, CLAIM_KINDS, approverRole } from '../lib/atlasRules';
import { ROLE_APP_ROWS } from '../../../semester/src/lib/roleApps';

type Row = Record<string, unknown>;
const fail = (m: string): never => { const e = new ZiteError(m); e.userFacingMessage = m; throw e; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);

// Semester Atlas (S-71, S-73), company side. Coverage reads the one maintained role register (apps/semester/src/lib/roleApps.ts);
// capability status is eight independent dimensions from Security Lab's recorded evidence; the gap register and claims
// registry are enforced in lib/atlMigration.ts. Atlas explains and tracks; it never executes institutional transactions and
// holds no student records. Internal Zite app: only workspace members reach it; decisions use company roles (co_roles).
export default createEndpoint({
  description: 'Atlas: coverage with explicit denominators, eight-dimension capability status from evidence, gap register, claims registry',
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('openGap'), requestKey: z.string().min(8).max(100), subject: z.string().min(3).max(160), title: z.string().min(5).max(200), detail: z.string().max(4000).default(''),
      severity: z.enum(SEVERITIES), ownerEmail: z.string().email().max(200) }),
    z.object({ action: z.literal('gapStep'), id: z.number().int(), step: z.enum(['start', 'resolve', 'accept_risk', 'reopen']), expectedVersion: z.number().int(), note: z.string().max(2000).default('') }),
    z.object({ action: z.literal('proposeClaim'), requestKey: z.string().min(8).max(100), claim: z.string().min(10).max(1000), kind: z.enum(CLAIM_KINDS), audience: z.string().min(3).max(200),
      scope: z.string().min(3).max(300), evidence: z.string().min(20).max(4000), reviewBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    z.object({ action: z.literal('claimStep'), id: z.number().int(), step: z.enum(['approve', 'reject', 'reverify', 'withdraw']), expectedVersion: z.number().int(), note: z.string().max(2000).default(''),
      reviewBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureAtlas();
    const sql = pg();
    const me = context.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const one = async (q: string, p: unknown[]) => { const r = ((await sql.query(q, p)) as { e: string | null }[])[0].e; if (r) fail(r); };
    let result: unknown = null;

    if (input.action === 'openGap') {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.ownerEmail.trim()] });
      const owner = rows[0] ? String((rows[0] as Row).id) : fail('No workspace member has that email.');
      const out = ((await sql.query(`SELECT atl_gap_open($1,$2,$3,$4,$5,$6,$7) AS r`, [me, input.requestKey, input.subject, input.title, input.detail, input.severity, owner])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) fail(out);
      result = { id: Number(out.split(':')[1]) };
    }
    if (input.action === 'gapStep') await one(`SELECT atl_gap_step($1,$2,$3,$4,$5) AS e`, [input.id, me, input.step, input.expectedVersion, input.note]);
    if (input.action === 'proposeClaim') {
      const out = ((await sql.query(`SELECT atl_claim_propose($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date) AS r`, [me, input.requestKey, input.claim, input.kind, input.audience, input.scope, input.evidence, input.reviewBy, today])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) fail(out);
      result = { id: Number(out.split(':')[1]) };
    }
    if (input.action === 'claimStep') await one(`SELECT atl_claim_step($1,$2,$3,$4,$5,$6::date,$7::date) AS e`, [input.id, me, input.step, input.expectedVersion, input.note, today, input.reviewBy]);

    // Coverage from the maintained role register: explicit denominators.
    const caps = ROLE_APP_ROWS.flatMap(([, , , c]) => c);
    const built = caps.filter((c) => c[2] === 'existing').length, partial = caps.filter((c) => c[2] === 'incomplete').length;
    const rolesFull = ROLE_APP_ROWS.filter(([, , , c]) => c.every((x) => x[2] === 'existing')).length;

    // Capability register (Security Lab) with per-dimension evidence.
    const [reg, ev] = await Promise.all([zite.capabilityRegister.findAll({ limit: 2000 }), zite.capabilityEvidence.findAll({ limit: 5000 })]);
    const capabilities = reg.records.map((r) => {
      const mine = ev.records.filter((e) => (Array.isArray(e.capability) ? e.capability : [e.capability]).includes(r.id));
      const s = satisfied(mine.map((e) => ({ stage: String(e.stage ?? ''), environment: String(e.environment ?? '') })));
      return { id: r.id, capability: r.capability ?? '', domain: r.domain ?? '', app: r.app ?? '', dims: s, evidenceCount: mine.length };
    });
    const dimCounts = Object.fromEntries(DIMENSIONS.map((d) => [d, coverage(capabilities.filter((c) => c.dims[d]).length, capabilities.length || null).label]));

    const gaps = (await sql.query(`SELECT * FROM atl_gaps ORDER BY (state IN ('resolved','risk_accepted')), array_position(ARRAY['critical','high','medium','low','informational'], severity), updated_at DESC LIMIT 500`)) as Row[];
    const claims = (await sql.query(`SELECT * FROM atl_claims ORDER BY (state <> 'approved'), updated_at DESC LIMIT 500`)) as Row[];
    const ids = [...new Set([...gaps.flatMap((g) => [String(g.owner_id), String(g.created_by)]), ...claims.flatMap((c) => [String(c.owner_id), String(c.approver_id ?? '')])].filter(Boolean))];
    const users = ids.length ? (await zite.sql({ query: `SELECT "id","name","email" FROM "ziteUsers" WHERE "id" = ANY($1)`, params: [ids] })).rows as Row[] : [];
    const nm = (id: unknown) => { const u = users.find((x) => x.id === id); return u ? String(u.name || u.email) : id ? 'Member' : ''; };
    const myRoles = await rolesOf(me);

    return {
      result, today, myRoles, dimensions: DIMENSIONS,
      coverage: {
        roleApps: ROLE_APP_ROWS.length, capabilities: coverage(built, caps.length).label, partial, missing: caps.length - built - partial, rolesFull: coverage(rolesFull, ROLE_APP_ROWS.length).label,
        workflowContracts: coverage(0, null).label, activation: coverage(0, null).label,
      },
      dimCounts, capabilities,
      gaps: gaps.map((g) => ({ id: Number(g.id), subject: String(g.subject), title: String(g.title), detail: String(g.detail), severity: String(g.severity), owner: nm(g.owner_id), mine: g.owner_id === me,
        openedBy: nm(g.created_by), state: String(g.state), version: Number(g.version), resolution: String(g.resolution), updatedAt: iso(g.updated_at) })),
      claims: claims.map((c) => ({ id: Number(c.id), ref: `CLM-${c.id}`, claim: String(c.claim), kind: String(c.kind), needs: approverRole(c.kind as never), audience: String(c.audience), scope: String(c.scope),
        evidence: String(c.evidence), reviewBy: day(c.review_by), expired: (day(c.review_by) ?? '') < today, owner: nm(c.owner_id), mine: c.owner_id === me, approver: nm(c.approver_id),
        state: String(c.state), version: Number(c.version), note: String(c.note), updatedAt: iso(c.updated_at) })),
    };
  },
});
