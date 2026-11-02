import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { pg } from '../lib/fin';
import { rolesOf } from '../lib/coRoles';

// Trust Center edits: one person proposes with evidence, a different privacy officer approves, and only then does the
// public site change. Same tables the public site reads (it seeds them on first view; ON CONFLICT keeps edits).
const DDL = [
  `CREATE TABLE IF NOT EXISTS site_trust_controls (section TEXT NOT NULL CHECK (section IN ('security','privacy','ai','accessibility')), control TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('In place','Verified in test','In progress','Not yet in place')), detail TEXT NOT NULL DEFAULT '', sort INT NOT NULL DEFAULT 0,
    reviewed_on DATE NOT NULL DEFAULT '2026-10-22', PRIMARY KEY (section, control))`,
  `CREATE TABLE IF NOT EXISTS site_subprocessors (name TEXT PRIMARY KEY, purpose TEXT NOT NULL, added_on DATE NOT NULL DEFAULT '2026-10-22', active BOOLEAN NOT NULL DEFAULT true)`,
  `CREATE TABLE IF NOT EXISTS site_trust_changes (id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('control','subprocessor')), payload JSONB NOT NULL,
    evidence TEXT NOT NULL, proposed_by TEXT NOT NULL, proposed_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    decided_by TEXT, decided_name TEXT, decision_note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_at TIMESTAMPTZ,
    CHECK (decided_by IS NULL OR decided_by <> proposed_by))`,
];
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) { const s = pg(); ready = (async () => { for (const q of DDL) await s.query(q); })().catch((e) => { ready = null; throw e; }); } return ready; };
const fail = (m: string): never => { const e = new ZiteError(m); e.userFacingMessage = m; throw e; };

const STATUS = ['In place', 'Verified in test', 'In progress', 'Not yet in place'] as const;
const SECTIONS = ['security', 'privacy', 'ai', 'accessibility'] as const;

export default createEndpoint({
  description: 'Trust Center: propose control and subprocessor changes with evidence; a second privacy officer approves before the public site changes',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'proposeControl', 'proposeSubprocessor', 'approve', 'reject', 'withdraw']),
    section: z.enum(SECTIONS).optional(), control: z.string().optional(), status: z.enum(STATUS).optional(), detail: z.string().optional(),
    name: z.string().optional(), purpose: z.string().optional(), active: z.boolean().optional(),
    evidence: z.string().optional(), changeId: z.number().optional(), note: z.string().optional(),
  }),
  outputSchema: z.object({
    canDecide: z.boolean(),
    controls: z.array(z.object({ section: z.string(), control: z.string(), status: z.string(), detail: z.string(), reviewedOn: z.string() })),
    subprocessors: z.array(z.object({ name: z.string(), purpose: z.string(), addedOn: z.string(), active: z.boolean() })),
    changes: z.array(z.object({ id: z.number(), kind: z.string(), summary: z.string(), evidence: z.string(), status: z.string(), proposedBy: z.string(), decidedBy: z.string(), note: z.string(), at: z.string(), mine: z.boolean() })),
  }),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const who = `${context.user.firstName ?? ''} ${context.user.lastName ?? ''}`.trim() || context.user.email;
    const canDecide = (await rolesOf(me)).includes('privacy_officer');
    const evidence = (input.evidence ?? '').trim();

    if (input.action === 'proposeControl') {
      const control = (input.control ?? '').trim();
      if (!input.section || !input.status || control.length < 3) fail('Choose a section, a control name and a status.');
      // Status, not certifications: a verified claim needs a dated source.
      if ((input.status === 'In place' || input.status === 'Verified in test') && evidence.length < 15) fail('A verified status needs evidence: what was checked, how, and when.');
      if (evidence.length < 5) fail('Say why this change is needed.');
      await sql.query(`INSERT INTO site_trust_changes (kind, payload, evidence, proposed_by, proposed_name) VALUES ('control', $1, $2, $3, $4)`,
        [JSON.stringify({ section: input.section, control, status: input.status, detail: (input.detail ?? '').trim().slice(0, 600) }), evidence, me, who]);
    } else if (input.action === 'proposeSubprocessor') {
      const name = (input.name ?? '').trim(), purpose = (input.purpose ?? '').trim();
      if (name.length < 2 || (input.active !== false && purpose.length < 10)) fail('Give the service name and what it does with data.');
      if (evidence.length < 5) fail('Say why (e.g. contract signed, DPA reference).');
      await sql.query(`INSERT INTO site_trust_changes (kind, payload, evidence, proposed_by, proposed_name) VALUES ('subprocessor', $1, $2, $3, $4)`,
        [JSON.stringify({ name, purpose: purpose.slice(0, 300), active: input.active !== false }), evidence, me, who]);
    } else if (input.action === 'withdraw') {
      // The proposer may pull back their own pending proposal. Not a decision, so decided_by stays empty.
      const r = (await sql.query(`UPDATE site_trust_changes SET status = 'rejected', decided_name = $3, decision_note = 'Withdrawn by proposer', decided_at = now()
        WHERE id = $1 AND proposed_by = $2 AND status = 'pending' RETURNING id`, [input.changeId, me, who])) as unknown[];
      if (!r.length) fail('Only your own pending proposals can be withdrawn.');
    } else if (input.action === 'approve' || input.action === 'reject') {
      if (!canDecide) fail('Only a privacy officer can decide Trust Center changes.');
      const rows = (await sql.query(`SELECT * FROM site_trust_changes WHERE id = $1`, [input.changeId])) as { id: number; kind: string; payload: Record<string, unknown>; proposed_by: string; status: string }[];
      const c = rows[0];
      if (!c || c.status !== 'pending') fail('This change was already decided.');
      if (c.proposed_by === me) fail('You proposed this change, so someone else has to decide it.');
      const note = (input.note ?? '').trim();
      if (input.action === 'reject' && note.length < 5) fail('Add a short reason.');
      if (input.action === 'approve') {
        const p = c.payload;
        if (c.kind === 'control') {
          await sql.query(`INSERT INTO site_trust_controls (section, control, status, detail, sort, reviewed_on) VALUES ($1,$2,$3,$4,(SELECT coalesce(max(sort),0)+1 FROM site_trust_controls),current_date)
            ON CONFLICT (section, control) DO UPDATE SET status = EXCLUDED.status, detail = EXCLUDED.detail, reviewed_on = current_date`, [p.section, p.control, p.status, p.detail]);
        } else {
          await sql.query(`INSERT INTO site_subprocessors (name, purpose, active) VALUES ($1,$2,$3)
            ON CONFLICT (name) DO UPDATE SET purpose = CASE WHEN EXCLUDED.purpose = '' THEN site_subprocessors.purpose ELSE EXCLUDED.purpose END, active = EXCLUDED.active`, [p.name, p.purpose, p.active]);
        }
      }
      await sql.query(`UPDATE site_trust_changes SET status = $2, decided_by = $3, decided_name = $4, decision_note = $5, decided_at = now() WHERE id = $1 AND status = 'pending'`,
        [c.id, input.action === 'approve' ? 'approved' : 'rejected', me, who, note]);
    }

    const [controls, subs, changes] = await Promise.all([
      sql.query(`SELECT section, control, status, detail, to_char(reviewed_on,'YYYY-MM-DD') AS "reviewedOn" FROM site_trust_controls ORDER BY section, sort`),
      sql.query(`SELECT name, purpose, to_char(added_on,'YYYY-MM-DD') AS "addedOn", active FROM site_subprocessors ORDER BY name`),
      sql.query(`SELECT * FROM site_trust_changes ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 100`),
    ]);
    return {
      canDecide,
      controls: controls as { section: string; control: string; status: string; detail: string; reviewedOn: string }[],
      subprocessors: subs as { name: string; purpose: string; addedOn: string; active: boolean }[],
      changes: (changes as { id: number; kind: string; payload: Record<string, string | boolean>; evidence: string; status: string; proposed_name: string; proposed_by: string; decided_name: string | null; decision_note: string | null; created_at: string }[]).map((c) => ({
        id: Number(c.id), kind: c.kind,
        summary: c.kind === 'control' ? `${c.payload.section} · ${c.payload.control} → ${c.payload.status}` : `${c.payload.active === false ? 'Remove' : 'Add/update'} ${c.payload.name}`,
        evidence: c.evidence, status: c.status, proposedBy: c.proposed_name, decidedBy: c.decided_name ?? '', note: c.decision_note ?? '', at: new Date(c.created_at).toISOString(), mine: c.proposed_by === me,
      })),
    };
  },
});
