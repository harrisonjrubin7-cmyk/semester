/**
 * The provider registry: what Semester may say about a vendor, and why.
 *
 * Maturity is what the connector does. A certification or partnership is a
 * claim about a relationship, and it is only ever said when a row of evidence
 * says it, with a person who verified it and a date it expires. Everything
 * that names a provider — the in-app list, the public site, a sales deck —
 * reads `providerClaim`, so there is no second place to write "certified".
 *
 * `authorized_writeback` maturity turns nothing on. Writeback stays behind its
 * own `writeback.*` flag and a school's approval (see `adapter.ts`).
 *
 * See `docs/PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md`.
 */

export type Maturity = 'planned' | 'manual' | 'read_only' | 'incremental' | 'event_driven' | 'authorized_writeback';

export const MATURITIES: readonly Maturity[] = [
  'planned', 'manual', 'read_only', 'incremental', 'event_driven', 'authorized_writeback',
];

export const MATURITY_WORDS: Record<Maturity, string> = {
  planned: 'Planned',
  manual: 'File import',
  read_only: 'Reads from it',
  incremental: 'Keeps up to date',
  event_driven: 'Updates as it changes',
  authorized_writeback: 'Can write back where a school approves',
};

export interface Evidence {
  kind: 'certification' | 'partnership';
  /** What exactly was certified or agreed — "LTI 1.3 Advantage Complete", "data-sharing agreement". */
  what: string;
  /** A person's name. A system, a script or an empty string is not a verifier. */
  verifiedBy: string;
  verifiedAt: string;
  expiresAt: string | null;
  document: string;
}

export interface Provider {
  id: string;
  name: string;
  maturity: Maturity;
  connectorOwner: string;
  supportOwner: string;
  compatibilityVersion: string | null;
  lastValidatedAt: string | null;
  evidence: readonly Evidence[];
}

/** Evidence that counts today: named person, real dates, not expired. */
export function liveEvidence(p: Provider, now: Date): Evidence[] {
  return p.evidence.filter((e) => {
    const verified = Date.parse(e.verifiedAt);
    if (!e.verifiedBy.trim() || /^(system|script|auto|bot)\b/i.test(e.verifiedBy.trim())) return false;
    if (!Number.isFinite(verified) || verified > now.getTime()) return false;
    if (e.expiresAt !== null) {
      const expires = Date.parse(e.expiresAt);
      if (!Number.isFinite(expires) || expires <= now.getTime()) return false;
    }
    return e.document.trim().length > 0;
  });
}

/**
 * The words Semester may use about a provider, today. Maturity always; a
 * certification or partnership only with live evidence for it; "last checked"
 * only when a contract test run is recorded.
 */
export function providerClaim(p: Provider, now: Date): { maturity: string; claims: string[]; lastChecked: string | null } {
  const live = liveEvidence(p, now);
  const claims = [
    ...live.filter((e) => e.kind === 'certification').map((e) => `Certified: ${e.what}`),
    ...live.filter((e) => e.kind === 'partnership').map((e) => `Partner: ${e.what}`),
  ];
  return { maturity: MATURITY_WORDS[p.maturity], claims, lastChecked: p.lastValidatedAt };
}

/** Everything wrong with a registry row before it can be listed. */
export function providerProblems(p: Provider): string[] {
  const out: string[] = [];
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(p.id)) out.push('id must be a lowercase slug');
  if (!MATURITIES.includes(p.maturity)) out.push('unknown maturity');
  if (p.maturity !== 'planned' && !p.connectorOwner.trim()) out.push('a built connector needs an owner');
  if (p.maturity !== 'planned' && !p.supportOwner.trim()) out.push('a built connector needs a support owner');
  if (['incremental', 'event_driven', 'authorized_writeback'].includes(p.maturity) && !p.lastValidatedAt) {
    out.push('a syncing connector needs a recorded contract test run');
  }
  return out;
}
