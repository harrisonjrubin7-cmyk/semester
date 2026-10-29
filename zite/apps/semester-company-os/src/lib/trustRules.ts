// Trust Center rules (Trust Officer "trust room"). Pure: the endpoint calls these and the tests call them the same way.
// One person proposes with evidence; a different privacy officer decides; only an approval changes the public site.
export const TRUST_DDL = [
  `CREATE TABLE IF NOT EXISTS site_trust_controls (section TEXT NOT NULL CHECK (section IN ('security','privacy','ai','accessibility')), control TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('In place','Verified in test','In progress','Not yet in place')), detail TEXT NOT NULL DEFAULT '', sort INT NOT NULL DEFAULT 0,
    reviewed_on DATE NOT NULL DEFAULT '2026-10-22', PRIMARY KEY (section, control))`,
  `CREATE TABLE IF NOT EXISTS site_subprocessors (name TEXT PRIMARY KEY, purpose TEXT NOT NULL, added_on DATE NOT NULL DEFAULT '2026-10-22', active BOOLEAN NOT NULL DEFAULT true)`,
  `CREATE TABLE IF NOT EXISTS site_trust_changes (id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('control','subprocessor')), payload JSONB NOT NULL,
    evidence TEXT NOT NULL, proposed_by TEXT NOT NULL, proposed_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    decided_by TEXT, decided_name TEXT, decision_note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_at TIMESTAMPTZ,
    CHECK (decided_by IS NULL OR decided_by <> proposed_by))`,
];

export const TRUST_STATUS = ['In place', 'Verified in test', 'In progress', 'Not yet in place'] as const;
export const TRUST_SECTIONS = ['security', 'privacy', 'ai', 'accessibility'] as const;

/** Why a control proposal is refused, or null. A verified status is a claim and needs dated evidence. */
export function controlProblem(p: { section?: string; status?: string; control?: string; evidence?: string }): string | null {
  const control = (p.control ?? '').trim(), evidence = (p.evidence ?? '').trim();
  if (!p.section || !p.status || control.length < 3) return 'Choose a section, a control name and a status.';
  if ((p.status === 'In place' || p.status === 'Verified in test') && evidence.length < 15) return 'A verified status needs evidence: what was checked, how, and when.';
  if (evidence.length < 5) return 'Say why this change is needed.';
  return null;
}

export function subprocessorProblem(p: { name?: string; purpose?: string; active?: boolean; evidence?: string }): string | null {
  const name = (p.name ?? '').trim(), purpose = (p.purpose ?? '').trim();
  if (name.length < 2 || (p.active !== false && purpose.length < 10)) return 'Give the service name and what it does with data.';
  if ((p.evidence ?? '').trim().length < 5) return 'Say why (e.g. contract signed, DPA reference).';
  return null;
}

/** Why a decision is refused, or null. canDecide comes from server-held roles, never from the request. */
export function decideProblem(d: { canDecide: boolean; me: string; change?: { proposed_by: string; status: string }; action: 'approve' | 'reject'; note?: string }): string | null {
  if (!d.canDecide) return 'Only a privacy officer can decide Trust Center changes.';
  if (!d.change || d.change.status !== 'pending') return 'This change was already decided.';
  if (d.change.proposed_by === d.me) return 'You proposed this change, so someone else has to decide it.';
  if (d.action === 'reject' && (d.note ?? '').trim().length < 5) return 'Add a short reason.';
  return null;
}
