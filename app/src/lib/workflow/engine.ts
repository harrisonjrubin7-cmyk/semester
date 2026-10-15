/**
 * The policy engine: given a workflow's published definition and what is known
 * about a student, what the student is told (D-1018).
 *
 * The brief asks for "deterministic rules, not vague AI judgments":
 *
 *     IF student is enrolled in a program AND term is active AND prerequisite
 *     is complete THEN show the action; ELSE explain the blocker and the
 *     official next step.
 *
 * That is `evaluate`. Each check in the definition is a fact, a comparison and
 * a value. They run in the order written. There is no expression, no model and
 * no clock: the same definition and the same facts give the same answer.
 *
 * ## Three answers, not two
 *
 * A check passes, fails, or **cannot be told** because the fact is not known.
 * Not knowing is never a pass: the student is not offered the action on a
 * guess, and is not told they are ineligible on one either. They are told what
 * could not be checked and where the official answer is. `eligible` is `true`
 * only when every check passed, `false` when any failed, and `null` otherwise
 * — the third is the "human takeover when the system is uncertain" the brief
 * asks for.
 *
 * ## What it never does
 *
 * It does not fetch a fact. Where a fact comes from — the student information
 * system, the registrar's feed — is the integration's business, with its own
 * field allowlist; the engine takes what it is handed. It does not run a
 * workflow either: no student, request or answer is stored by anything here.
 */
import { FACTS, OPS, type Definition, type FactKey, type Requirement, type Step } from './spec';

export type FactValue = boolean | number;
/** What is known. A fact that is absent is unknown, not false. */
export type Facts = Partial<Record<FactKey, FactValue>>;

export interface CheckResult {
  id: string;
  fact: FactKey;
  status: 'passed' | 'failed' | 'unknown';
  /** Said to the student when the check did not pass. */
  explain: string;
  next_step: string;
}

export interface Evaluation {
  /** `true` every check passed; `false` one failed; `null` none failed but one could not be told. */
  eligible: boolean | null;
  checks: CheckResult[];
  /** The failed checks, in the order written. */
  blockers: CheckResult[];
  /** The checks that could not be told, in the order written. */
  unknown: CheckResult[];
  /** The office the workflow hands off to, when it does. */
  handoff: string | null;
}

/** Whether a fact meets a requirement: true, false, or null when the fact is unknown or of the wrong type. */
export function meets(rq: Requirement, facts: Facts): boolean | null {
  const spec = FACTS[rq.fact];
  const v = facts[rq.fact];
  if (v === undefined) return null;
  if (spec.type === 'bool') return typeof v === 'boolean' ? v === rq.value : null;
  if (typeof v !== 'number' || typeof rq.value !== 'number' || !Number.isFinite(v)) return null;
  if (!(OPS.int as readonly string[]).includes(rq.op)) return null;
  switch (rq.op) {
    case 'eq': return v === rq.value;
    case 'neq': return v !== rq.value;
    case 'gte': return v >= rq.value;
    case 'lte': return v <= rq.value;
    default: return null;
  }
}

export function evaluate(def: Definition, facts: Facts): Evaluation {
  const checks: CheckResult[] = (def.requires ?? []).map((rq) => {
    const m = meets(rq, facts);
    return {
      id: rq.id,
      fact: rq.fact,
      status: m === null ? 'unknown' : m ? 'passed' : 'failed',
      explain: m === null ? 'This could not be checked from what Semester has.' : rq.explain,
      next_step: m === null ? 'Ask the office named on this workflow; they can check it against the official record.' : rq.next_step,
    };
  });
  const blockers = checks.filter((c) => c.status === 'failed');
  const unknown = checks.filter((c) => c.status === 'unknown');
  return {
    eligible: blockers.length > 0 ? false : unknown.length > 0 ? null : true,
    checks,
    blockers,
    unknown,
    handoff: def.handoff ?? null,
  };
}

/** The sentence a student reads at the top of an evaluation. */
export function headline(e: Evaluation): string {
  if (e.eligible === true) return 'You meet what this needs. You can go on.';
  if (e.eligible === false) {
    return e.blockers.length === 1 ? 'One thing stands in the way.' : `${e.blockers.length} things stand in the way.`;
  }
  return e.handoff
    ? `Semester cannot tell yet. ${e.handoff} can check this against the official record.`
    : 'Semester cannot tell yet. The office that runs this can check it against the official record.';
}

/**
 * The steps as the student sees them, in order, each marked for who acts. The
 * handoff step names the office; nothing here writes into an official system.
 */
export function walkthrough(def: Definition): { step: Step; who: string; note: string }[] {
  return def.steps.map((step) => ({
    step,
    who: step.owner,
    note: step.kind === 'official_handoff' && def.handoff ? `Handed to ${def.handoff}. That office keeps the official record.` : '',
  }));
}
