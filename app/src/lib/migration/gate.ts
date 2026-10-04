/**
 * The data-quality gate: whether a domain's results are enough to proceed.
 *
 * Three refusals are the point of this file.
 *
 * 1. **Counts alone never pass.** A domain needs a check that actually looked
 *    at something in every evidence class (`REQUIRED_EVIDENCE`). Row-count
 *    equality is reported as `row_count_only` so the reason is readable.
 * 2. **A check that examined nothing is not a pass.** An empty extract makes
 *    every comparison trivially true; that is a broken probe, not a clean one.
 * 3. **Critical failures are never tolerated or waived.** Thresholds apply to
 *    the rest, and only to failures nobody has dispositioned.
 *
 * A failure is *dispositioned* when the exception queue (`exceptions.ts`) holds
 * it as verified, out of scope, or waived. The gate takes those as a set of
 * `failureKey`s so the queue and the gate cannot disagree about what is open.
 */
import { EVIDENCE_CLASSES, REQUIRED_EVIDENCE, SEVERITIES } from './types.ts';
import type { CheckResult, DataDomain, EvidenceClass, Failure, Severity } from './types.ts';

/** Highest tolerated unexplained-failure rate per severity, as a fraction of what was examined. */
export type Thresholds = Readonly<Record<Severity, number>>;

/** The floor. A domain may ask for stricter; nobody may ask for looser. */
export const DEFAULT_THRESHOLDS: Thresholds = { critical: 0, high: 0.001, medium: 0.01, low: 0.05 };

/** Stricter-only override. Throws on any value looser than the base, so a quiet loosening is a failing test, not a judgement call. */
export function tighten(base: Thresholds, override: Partial<Thresholds>): Thresholds {
  const out = { ...base };
  for (const s of SEVERITIES) {
    const v = override[s];
    if (v === undefined) continue;
    if (!(v >= 0 && v <= base[s])) throw new RangeError(`threshold for ${s} may only tighten: ${v} is not within 0..${base[s]}`);
    out[s] = v;
  }
  return out;
}

export function failureKey(checkId: string, f: Failure): string {
  return `${checkId}|${f.ref}|${f.code}`;
}

export type ReasonCode = 'no_checks' | 'row_count_only' | 'missing_evidence_class' | 'vacuous_check' | 'critical_failure' | 'rate_exceeded';

export interface Reason {
  code: ReasonCode;
  detail: string;
}

export interface GateResult {
  domain: DataDomain;
  passed: boolean;
  reasons: Reason[];
  /** Evidence classes with at least one check that examined something. */
  covered: EvidenceClass[];
  /** Open (undispositioned) failures per severity. */
  open: Record<Severity, number>;
}

export function evaluateGate(
  domain: DataDomain,
  results: readonly CheckResult[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
  dispositioned: ReadonlySet<string> = new Set(),
): GateResult {
  const mine = results.filter((r) => r.domain === domain);
  const reasons: Reason[] = [];
  const open: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };

  if (mine.length === 0) {
    return { domain, passed: false, reasons: [{ code: 'no_checks', detail: 'no results for this domain' }], covered: [], open };
  }

  for (const r of mine) {
    if (r.examined === 0) reasons.push({ code: 'vacuous_check', detail: r.id });
  }

  const covered = EVIDENCE_CLASSES.filter((c) => mine.some((r) => r.evidenceClass === c && r.examined > 0));
  if (covered.length === 1 && covered[0] === 'count') {
    reasons.push({ code: 'row_count_only', detail: 'only volumes were compared' });
  }
  for (const c of REQUIRED_EVIDENCE) {
    if (!covered.includes(c)) reasons.push({ code: 'missing_evidence_class', detail: c });
  }

  const examined: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of mine) {
    examined[r.severity] += r.examined;
    for (const f of r.failures) if (!dispositioned.has(failureKey(r.id, f))) open[r.severity]++;
  }

  if (open.critical > 0) reasons.push({ code: 'critical_failure', detail: `${open.critical} open` });
  for (const s of SEVERITIES) {
    if (s === 'critical') continue;
    const rate = examined[s] === 0 ? 0 : open[s] / examined[s];
    if (rate > thresholds[s]) reasons.push({ code: 'rate_exceeded', detail: `${s}: ${open[s]}/${examined[s]} > ${thresholds[s]}` });
  }

  return { domain, passed: reasons.length === 0, reasons, covered, open };
}
