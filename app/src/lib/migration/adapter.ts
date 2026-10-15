/**
 * From rows to the gate: run a domain's executable checks and hand the
 * results to `gate.ts` in the shape it already reads.
 *
 * `checks.ts` holds primitives that compare rows a caller has already
 * assembled and redacted; `workbooks.ts` says which checks each domain needs.
 * Nothing connected the two to actual source and target files. `engine.ts` does
 * that — it executes a domain's declared checks against a `Pair` — and this
 * file is the seam that turns what it finds into `CheckResult`s, so the gate,
 * the exception queue, the ledger and the Migration Center bridge need no
 * second code path for "results from the engine".
 *
 * What it adds on the way through:
 *
 * - **References, not keys.** A finding's source key never leaves the process;
 *   it is replaced by a tenant-salted reference (`integration/redact.ts`).
 * - **Evidence classes.** Each kind of check says what it proves. A `preserved`
 *   check that compares fields proves `semantic`; the same check's link
 *   findings prove `relationship`; it never claims a class it did not examine.
 * - **Stakes.** A domain where one wrong record is a harm gets stricter
 *   thresholds, through the same `tighten` that refuses a looser one.
 * - **Proof the checks work.** `proveProbes` injects a defect of each check's
 *   own kind and the ones that did not notice are listed, for the gate to hold.
 */
import { redactReference } from '../integration/redact.ts';
import { countParity } from './checks.ts';
import { CLASS_OF_KIND, countsFor, proveProbes, runDomain, type ProbeProof } from './engine.ts';
import type { DomainSpec, Gravity, InvariantResult, InvariantSpec, Pair } from './engine-types.ts';
import { DEFAULT_THRESHOLDS, tighten, type Thresholds } from './gate.ts';
import { EVIDENCE_CLASSES, type CheckResult, type EvidenceClass, type Failure, type Severity } from './types.ts';

/** The engine grades findings in three; the pack in four. `low` is for counts, which are never enough alone. */
export const SEVERITY_OF: Readonly<Record<Gravity, Severity>> = { critical: 'critical', major: 'high', minor: 'medium' };

/**
 * Thresholds for a domain. Where one wrong record harms a person (grades,
 * balances, consents, access, documents) no major defect is tolerated and minor
 * ones half as many as elsewhere. Built with `tighten`, so it cannot be looser
 * than the floor.
 */
export function thresholdsFor(stakes: DomainSpec['stakes']): Thresholds {
  return stakes === 'high' ? tighten(DEFAULT_THRESHOLDS, { high: 0, medium: 0.005 }) : DEFAULT_THRESHOLDS;
}

/** The classes a check actually examines, which is not always the kind's default. */
export function examinedClasses(spec: InvariantSpec): EvidenceClass[] {
  if (spec.kind === 'preserved') {
    return [...(spec.fields.length > 0 ? (['semantic'] as const) : []), ...((spec.links?.length ?? 0) > 0 ? (['relationship'] as const) : [])];
  }
  return [CLASS_OF_KIND[spec.kind]];
}

export interface Evaluated {
  results: CheckResult[];
  proofs: ProbeProof[];
  /** Checks not proven to detect a defect of their own kind on this data, and not attested as legitimately empty. */
  unproven: string[];
  /**
   * Every result id that belongs to an attested check. One check can yield
   * several results (a `preserved` check that compares fields and links is
   * `semantic` and `relationship`), and the attestation covers all of them.
   */
  attestedResultIds: Set<string>;
}

export async function runChecks(spec: DomainSpec, pair: Pair, tenantId: string, attestedEmpty: readonly string[] = []): Promise<Evaluated> {
  const raw = runDomain(spec, pair);
  const proofs = proveProbes(spec, pair);
  const attested = new Set(attestedEmpty);
  const results: CheckResult[] = [];

  const counts = countsFor(spec, pair);
  results.push(countParity({ id: `${spec.id}.count.volumes`, domain: spec.id, severity: 'low' }, counts.source, counts.target, counts.expectedRejected));

  for (const r of raw) {
    const s = spec.invariants.find((x) => x.id === r.invariant)!;
    results.push(...(await toResults(spec, s, r, tenantId)));
  }

  const unproven = spec.invariants
    .filter((s) => {
      const p = proofs.find((x) => x.invariant === s.id);
      return !p || (p.status !== 'detected' && !(attested.has(s.id) && (p.status === 'vacuous' || p.status === 'unmutable')));
    })
    .map((s) => s.id);
  const attestedResultIds = new Set(results.filter((r) => [...attested].some((id) => r.id === id || r.id.startsWith(`${id}:`))).map((r) => r.id));
  return { results, proofs, unproven, attestedResultIds };
}

async function toResults(spec: DomainSpec, s: InvariantSpec, r: InvariantResult, tenantId: string): Promise<CheckResult[]> {
  const home = examinedClasses(s);
  const groups = new Map<string, { evidenceClass: EvidenceClass; gravity: Gravity; found: InvariantResult['findings'] }>();
  const slot = (evidenceClass: EvidenceClass, gravity: Gravity) => {
    const k = `${evidenceClass}|${gravity}`;
    if (!groups.has(k)) groups.set(k, { evidenceClass, gravity, found: [] });
    return groups.get(k)!;
  };
  // Every class this check examined appears, even with no failures: "looked and found nothing" is evidence.
  for (const c of home) slot(c, s.gravity);
  for (const f of r.findings) slot(f.evidenceClass, f.gravity).found.push(f);

  const out: CheckResult[] = [];
  let first = true;
  for (const g of groups.values()) {
    const failures: Failure[] = await Promise.all(
      g.found.map(async (f) => ({ ref: await redactReference(tenantId, `${f.invariant}:${f.key}`), code: f.code, origin: f.origin })),
    );
    out.push({
      id: first ? s.id : `${s.id}:${g.evidenceClass}:${g.gravity}`,
      domain: spec.id,
      evidenceClass: g.evidenceClass,
      severity: SEVERITY_OF[g.gravity],
      examined: r.examined,
      failures,
    });
    first = false;
  }
  return out;
}

/**
 * The evidence classes a domain's executable checks cover on their own. Counts
 * are always compared. What is left over is what only evidence from outside the
 * two extracts can supply (a sample of real sign-ins, a retrieval test), and the
 * gate will refuse the domain until that arrives as `external-checks.json`.
 */
export function executableCoverage(spec: DomainSpec): EvidenceClass[] {
  const covered = new Set<EvidenceClass>(['count']);
  for (const s of spec.invariants) for (const c of examinedClasses(s)) covered.add(c);
  return EVIDENCE_CLASSES.filter((c) => covered.has(c));
}
