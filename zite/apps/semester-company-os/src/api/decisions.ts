import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { pg } from '../lib/fin';
import { DECISION_SEEDS, checkTransition, nextStatus, Act, DecisionStatus } from '../lib/decisionRules';

// Decision register: the inputs the blueprint says must be answered, not guessed. Every change is appended to a history.
const DDL = [
  `CREATE TABLE IF NOT EXISTS co_decisions (key TEXT PRIMARY KEY, input TEXT NOT NULL, controls TEXT NOT NULL, sort INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','proposed','decided')), answer TEXT NOT NULL DEFAULT '', evidence TEXT NOT NULL DEFAULT '',
    proposed_by TEXT, proposed_name TEXT, decided_by TEXT, decided_name TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (decided_by IS NULL OR decided_by <> proposed_by))`,
  `CREATE TABLE IF NOT EXISTS co_decision_events (id BIGSERIAL PRIMARY KEY, key TEXT NOT NULL REFERENCES co_decisions(key), kind TEXT NOT NULL, detail TEXT NOT NULL, actor TEXT NOT NULL, actor_name TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now())`,
];
let ready: Promise<void> | null = null;
const ensure = () => {
  if (!ready) {
    const s = pg();
    ready = (async () => {
      for (const q of DDL) await s.query(q);
      for (const [i, [k, inp, c]] of DECISION_SEEDS.entries()) await s.query(`INSERT INTO co_decisions (key, input, controls, sort) VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO NOTHING`, [k, inp, c, i]);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
};
const fail = (m: string): never => { const e = new ZiteError(m); e.userFacingMessage = m; throw e; };

const item = z.object({ key: z.string(), input: z.string(), controls: z.string(), status: z.string(), answer: z.string(), evidence: z.string(), proposedBy: z.string(), decidedBy: z.string(), mine: z.boolean(), updatedAt: z.string() });

export default createEndpoint({
  authenticated: true,
  description: 'Decision register: propose answers with evidence; a different person confirms before a decision counts',
  inputSchema: z.object({
    action: z.enum(['list', 'propose', 'confirm', 'reopen']), key: z.string().optional(),
    answer: z.string().optional(), evidence: z.string().optional(), reason: z.string().optional(),
  }),
  outputSchema: z.object({ items: z.array(item), events: z.array(z.object({ key: z.string(), kind: z.string(), detail: z.string(), actor: z.string(), at: z.string() })) }),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const who = `${context.user.firstName ?? ''} ${context.user.lastName ?? ''}`.trim() || context.user.email;

    if (input.action !== 'list') {
      const rows = (await sql.query(`SELECT status, proposed_by FROM co_decisions WHERE key = $1`, [input.key])) as { status: DecisionStatus; proposed_by: string | null }[];
      if (!rows[0]) fail('That decision does not exist.');
      const act: Act = input.action === 'propose' ? { kind: 'propose', answer: input.answer ?? '', evidence: input.evidence ?? '' }
        : input.action === 'confirm' ? { kind: 'confirm' } : { kind: 'reopen', reason: input.reason ?? '' };
      const err = checkTransition({ status: rows[0].status, proposedBy: rows[0].proposed_by }, act, me);
      if (err) fail(err);
      const to = nextStatus(act);
      // Guard on the status we read so two people acting at once cannot both succeed.
      const q = act.kind === 'propose'
        ? sql.query(`UPDATE co_decisions SET status=$3, answer=$4, evidence=$5, proposed_by=$6, proposed_name=$7, decided_by=NULL, decided_name=NULL, updated_at=now() WHERE key=$1 AND status=$2 RETURNING key`, [input.key, rows[0].status, to, act.answer.trim(), act.evidence.trim(), me, who])
        : act.kind === 'confirm'
          ? sql.query(`UPDATE co_decisions SET status=$3, decided_by=$4, decided_name=$5, updated_at=now() WHERE key=$1 AND status=$2 RETURNING key`, [input.key, rows[0].status, to, me, who])
          : sql.query(`UPDATE co_decisions SET status=$3, decided_by=NULL, decided_name=NULL, updated_at=now() WHERE key=$1 AND status=$2 RETURNING key`, [input.key, rows[0].status, to]);
      if (!((await q) as unknown[]).length) fail('Someone else changed this just now. Refresh and try again.');
      const detail = act.kind === 'propose' ? act.answer.trim().slice(0, 200) : act.kind === 'reopen' ? act.reason.trim() : 'Confirmed';
      await sql.query(`INSERT INTO co_decision_events (key, kind, detail, actor, actor_name) VALUES ($1,$2,$3,$4,$5)`, [input.key, act.kind, detail, me, who]);
    }

    const [items, events] = await Promise.all([
      sql.query(`SELECT * FROM co_decisions ORDER BY sort`),
      sql.query(`SELECT key, kind, detail, actor_name, at FROM co_decision_events ORDER BY at DESC LIMIT 50`),
    ]);
    return {
      items: (items as Record<string, string | null>[]).map((r) => ({ key: r.key!, input: r.input!, controls: r.controls!, status: r.status!, answer: r.answer ?? '', evidence: r.evidence ?? '',
        proposedBy: r.proposed_name ?? '', decidedBy: r.decided_name ?? '', mine: r.proposed_by === me, updatedAt: new Date(r.updated_at!).toISOString() })),
      events: (events as Record<string, string>[]).map((e) => ({ key: e.key, kind: e.kind, detail: e.detail, actor: e.actor_name, at: new Date(e.at).toISOString() })),
    };
  },
});
