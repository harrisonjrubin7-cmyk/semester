import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/fin';
import { ensureCoRoles, rolesOf } from '../lib/coRoles';
import { BRD_MIGRATION } from '../lib/brdMigration';

let ready: Promise<void> | null = null;
const ensureBrd = () => {
  if (!ready) ready = (async () => { await ensureCoRoles(); const sql = pg(); for (const s of BRD_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; });
  return ready;
};
const no = (m: string): never => { throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); };
type Fig = { label: string; value: number; unit: 'usd' | 'count'; kind: 'actual' | 'estimate'; note?: string };

/** Figures are computed here on the server, never sent by the browser. Sample rows are excluded and counted separately. */
export async function computeFigures(): Promise<Record<string, Fig>> {
  const real = `coalesce("isSample", false) = false`;
  const q = async (query: string) => Number(Object.values(((await zite.sql({ query })).rows as Record<string, unknown>[])[0] ?? { n: 0 })[0] ?? 0);
  const [acv, contracts, pipeline, won, risks, capV, capT, samples] = await Promise.all([
    q(`SELECT coalesce(sum("annualValueMinor"),0)::bigint FROM "Contracts" WHERE ${real} AND "state" = 'Active'`),
    q(`SELECT count(*)::int FROM "Contracts" WHERE ${real} AND "state" = 'Active'`),
    q(`SELECT coalesce(sum("amountMinor"),0)::bigint FROM "Deals" WHERE ${real} AND "stage" NOT IN ('Won','Lost')`),
    q(`SELECT count(*)::int FROM "Deals" WHERE ${real} AND "stage" = 'Won'`),
    q(`SELECT count(*)::int FROM "CompanyRisks" WHERE "status" IN ('Open','Mitigating') AND ("likelihood" = 'High' OR "impact" = 'Critical')`),
    q(`SELECT count(*)::int FROM "CapabilityRegister" WHERE "status" ~* '(verified|production|pilot)' AND "status" !~* 'unverified'`),
    q(`SELECT count(*)::int FROM "CapabilityRegister"`),
    q(`SELECT (SELECT count(*) FROM "Deals" WHERE "isSample") + (SELECT count(*) FROM "Contracts" WHERE "isSample")`),
  ]);
  return {
    acv: { label: 'Annual contract value (active contracts)', value: acv, unit: 'usd', kind: 'actual' },
    customers: { label: 'Active contracts', value: contracts, unit: 'count', kind: 'actual' },
    pipeline: { label: 'Open pipeline', value: pipeline, unit: 'usd', kind: 'estimate', note: 'Unweighted; not a forecast.' },
    won: { label: 'Deals won', value: won, unit: 'count', kind: 'actual' },
    risks: { label: 'High/critical open risks', value: risks, unit: 'count', kind: 'actual' },
    capVerified: { label: 'Capabilities verified or beyond', value: capV, unit: 'count', kind: 'actual', note: `of ${capT} tracked` },
    samples: { label: 'Sample rows excluded', value: samples, unit: 'count', kind: 'actual' },
  };
}

// Board and Investor (APP-031): readers see released snapshots only; drafts are visible to preparers and approvers.
export default createEndpoint({
  description: 'Board reporting: prepare frozen snapshots, release them with independent approval, and show released snapshots to board readers',
  authenticated: true,
  inputSchema: z.discriminatedUnion('op', [
    z.object({ op: z.literal('list') }),
    z.object({ op: z.literal('preview') }),
    z.object({ op: z.literal('create'), id: z.string().min(8).max(80), period: z.string().max(60), narrative: z.string().max(5000) }),
    z.object({ op: z.literal('release'), id: z.string(), seenHash: z.string() }),
    z.object({ op: z.literal('withdraw'), id: z.string(), reason: z.string().max(500) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureBrd();
    const sql = pg();
    const me = context.user.id;
    const roles = await rolesOf(me);
    const staff = roles.includes('board_preparer') || roles.includes('board_approver');
    if (!staff && !roles.includes('board_reader')) no('You don’t have access to board reporting.');
    const fail = (e: string | null) => { if (e) no(e); };
    if (input.op === 'preview') { if (!roles.includes('board_preparer')) no('Only preparers preview figures.'); return { figures: await computeFigures() }; }
    if (input.op === 'create') fail(((await sql.query(`SELECT brd_create($1,$2,$3,$4::jsonb,$5) AS e`, [me, input.id, input.period, JSON.stringify(await computeFigures()), input.narrative])) as { e: string | null }[])[0].e);
    if (input.op === 'release') fail(((await sql.query(`SELECT brd_release($1,$2,$3) AS e`, [me, input.id, input.seenHash])) as { e: string | null }[])[0].e);
    if (input.op === 'withdraw') fail(((await sql.query(`SELECT brd_withdraw($1,$2,$3) AS e`, [me, input.id, input.reason])) as { e: string | null }[])[0].e);
    const rows = (await sql.query(staff ? `SELECT * FROM brd_snapshots ORDER BY number DESC LIMIT 50` : `SELECT * FROM brd_snapshots WHERE state = 'released' ORDER BY number DESC LIMIT 50`)) as Record<string, unknown>[];
    const { records: users } = await zite.auth.findAllUsers({ limit: 200 });
    const name = (id: unknown) => { if (!id) return ''; const u = users.find((x) => x.id === String(id)); return u ? (u.id === me ? 'You' : u.name || u.email) : 'Unknown'; };
    return {
      me, roles, staff,
      snapshots: rows.map((s) => ({ id: String(s.id), number: Number(s.number), period: String(s.period), figures: s.figures as Record<string, Fig>, narrative: String(s.narrative),
        hash: String(s.content_hash), state: String(s.state), preparedBy: name(s.prepared_by), preparedById: String(s.prepared_by), releasedBy: name(s.released_by),
        releasedAt: s.released_at ? String(s.released_at) : null, createdAt: String(s.created_at), withdrawnReason: (s.withdrawn_reason as string) ?? '' })),
    };
  },
});
