/**
 * Data quality thresholds, and the verdict they produce.
 *
 * Three outcomes, and the difference between the last two is the point:
 *
 * - `fail`: the migration put something wrong in the target. A critical defect
 *   that is the migration's, a major one in a high-stakes domain, a rate over
 *   the threshold, or counts that do not reconcile.
 * - `hold`: nothing is known to be wrong, but the checks do not support
 *   "right". A check examined no rows, the probes were never proven against
 *   this data, or one missed. A clean report from a check that could not have
 *   failed is not a clean report.
 * - `pass`: no migration defect, every check looked at something, every probe
 *   was proven to notice its own kind of defect.
 *
 * Defects the source already had are *inherited*. They never fail the
 * migration — they go to the exception queue for the institution to fix or
 * waive — but they are counted and reported, because "we carried your mess
 * faithfully" is only an answer if the mess is written down.
 *
 * A school may set a stricter threshold and never a looser one, for the same
 * reason a tenant classification rule may only tighten the platform floor.
 */
import { redactReference } from '../integration/redact.ts';
import type { ProbeProof } from './engine.ts';
import type { CountRow } from './engine.ts';
import type { DomainSpec, InvariantResult, Origin, Severity } from './types.ts';

/** Critical is always zero and is not a setting. These are the rates of the rest. */
export interface Policy {
  /** Migration-origin major findings as a fraction of what that check examined. */
  majorMaxRate: number;
  minorMaxRate: number;
}

export const POLICY: Readonly<Record<DomainSpec['stakes'], Policy>> = {
  high: { majorMaxRate: 0, minorMaxRate: 0.005 },
  standard: { majorMaxRate: 0.001, minorMaxRate: 0.01 },
};

/** A requested policy, or why it is refused. Looser than the floor is never accepted. */
export function tightenPolicy(floor: Policy, requested: Policy): { ok: true; policy: Policy } | { ok: false; why: string } {
  for (const k of ['majorMaxRate', 'minorMaxRate'] as const) {
    if (!Number.isFinite(requested[k]) || requested[k] < 0) return { ok: false, why: `${k} must be a number from 0 up.` };
    if (requested[k] > floor[k]) return { ok: false, why: `${k} may only be stricter than the platform threshold (${floor[k]}).` };
  }
  return { ok: true, policy: requested };
}

export type Verdict = 'pass' | 'hold' | 'fail';

export interface Tally {
  critical: number;
  major: number;
  minor: number;
}

export interface Evaluation {
  domain: string;
  verdict: Verdict;
  reasons: string[];
  /** What the migration got wrong. */
  migration: Tally;
  /** What the source already had. The institution's to resolve. */
  inherited: Tally;
  vacuous: string[];
  probes: 'proven' | 'missing' | 'incomplete';
  countParity: 'ok' | 'mismatch';
  /** Checks the institution confirmed have a legitimately empty population. */
  attestedEmpty: string[];
}

const zero = (): Tally => ({ critical: 0, major: 0, minor: 0 });

export interface EvaluateInput {
  domain: DomainSpec;
  results: readonly InvariantResult[];
  parity: readonly CountRow[];
  /** From `proveProbes` on this same data; absent means never run. */
  probes?: readonly ProbeProof[];
  /** Invariant ids the institution attests have no population (no waitlists this term, say). */
  attestedEmpty?: readonly string[];
  policy?: Policy;
}

export function evaluateDomain(input: EvaluateInput): Evaluation {
  const policy = input.policy ?? POLICY[input.domain.stakes];
  const attested = new Set(input.attestedEmpty ?? []);
  const migration = zero();
  const inherited = zero();
  const fail: string[] = [];
  const hold: string[] = [];

  for (const r of input.results) {
    const mine: Record<Severity, number> = { critical: 0, major: 0, minor: 0 };
    for (const f of r.findings) {
      (f.origin === 'migration' ? migration : inherited)[f.severity] += 1;
      if (f.origin === 'migration') mine[f.severity] += 1;
    }
    if (mine.critical > 0) fail.push(`${r.invariant}: ${mine.critical} critical defect${mine.critical === 1 ? '' : 's'} introduced by the migration`);
    const rate = (n: number) => (r.examined === 0 ? 0 : n / r.examined);
    if (mine.major > 0 && rate(mine.major) > policy.majorMaxRate) fail.push(`${r.invariant}: major defects at ${(rate(mine.major) * 100).toFixed(2)}% exceed ${(policy.majorMaxRate * 100).toFixed(2)}%`);
    if (mine.minor > 0 && rate(mine.minor) > policy.minorMaxRate) fail.push(`${r.invariant}: minor defects at ${(rate(mine.minor) * 100).toFixed(2)}% exceed ${(policy.minorMaxRate * 100).toFixed(2)}%`);
  }

  const mismatched = input.parity.filter((c) => !c.ok);
  for (const c of mismatched) fail.push(`${c.entity}: ${c.target} rows loaded, ${c.expected} expected (${c.source} source − ${c.excluded} excluded − ${c.merged} merged)`);

  const vacuous = input.results.filter((r) => r.examined === 0 && !attested.has(r.invariant)).map((r) => r.invariant);
  if (vacuous.length) hold.push(`${vacuous.length} check${vacuous.length === 1 ? '' : 's'} examined no rows and prove nothing: ${vacuous.join(', ')}`);

  let probes: Evaluation['probes'] = 'proven';
  if (!input.probes) {
    probes = 'missing';
    hold.push('the checks have not been proven to detect injected defects on this data');
  } else {
    const unproven = input.domain.invariants.filter((s) => {
      const p = input.probes!.find((x) => x.invariant === s.id);
      return !p || (p.status !== 'detected' && !(attested.has(s.id) && (p.status === 'vacuous' || p.status === 'unmutable')));
    });
    if (unproven.length) {
      probes = 'incomplete';
      hold.push(`${unproven.length} check${unproven.length === 1 ? ' is' : 's are'} not proven to detect defects: ${unproven.map((s) => s.id).join(', ')}`);
    }
  }

  const verdict: Verdict = fail.length ? 'fail' : hold.length ? 'hold' : 'pass';
  return {
    domain: input.domain.id,
    verdict,
    reasons: [...fail, ...hold],
    migration,
    inherited,
    vacuous,
    probes,
    countParity: mismatched.length ? 'mismatch' : 'ok',
    attestedEmpty: [...attested].sort(),
  };
}

/* ── The report: redacted, so it can be filed and shown ────────────────── */

export interface ReportFinding {
  /** `sha256:…`, salted by tenant. Useless to anyone who does not already hold the id. */
  ref: string;
  origin: Origin;
  severity: Severity;
  what: string;
}

export interface ReportInvariant {
  invariant: string;
  kind: string;
  severity: Severity;
  examined: number;
  total: number;
  truncated: boolean;
  findings: ReportFinding[];
}

export interface Report {
  domain: string;
  evaluation: Evaluation;
  invariants: ReportInvariant[];
}

/** Findings kept per check in a report. More than this is a verdict, not a list. */
export const REPORT_CAP = 1000;

export async function toReport(tenantId: string, evaluation: Evaluation, results: readonly InvariantResult[]): Promise<Report> {
  const invariants = await Promise.all(
    results.map(async (r) => {
      const kept = r.findings.slice(0, REPORT_CAP);
      const findings = await Promise.all(
        kept.map(async (f) => ({ ref: await redactReference(tenantId, `${f.invariant}:${f.key}`), origin: f.origin, severity: f.severity, what: f.what })),
      );
      return { invariant: r.invariant, kind: r.kind, severity: r.severity, examined: r.examined, total: r.findings.length, truncated: r.findings.length > kept.length, findings };
    }),
  );
  return { domain: evaluation.domain, evaluation, invariants };
}
