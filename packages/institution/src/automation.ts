/**
 * How far Semester may go on the student's behalf, as one ladder.
 *
 * Every time something is automated the question is the same: is it telling,
 * suggesting, drafting, preparing, asking, doing, or checking that it was
 * done? `gateway.ts` already holds the two rungs that matter most to the
 * ground — `/actions/prepare` changes nothing, `/actions/commit` needs a
 * confirmation — and `DO-NOT-BUILD.md` rule 11 holds confirmation by review.
 * What was missing was the ladder itself, so that a new feature says which
 * rung it stands on and a test can say what that rung costs.
 *
 * The rule is one sentence: nothing reaches **execute** without a
 * confirmation, an authority, a policy and an audit trail, and nothing
 * reaches **verify** without having executed. A feature that inform-and-
 * recommends needs none of the four, and asks for none.
 *
 * Nothing here executes anything. It answers "may this go further?" and
 * names what is missing when it may not.
 *
 * It lives in the gateway contract because the gateway is its caller: the
 * commit path asks `mayStep` before it lets an adapter write, with the grounds
 * `groundsFor` reads from what the gateway has already checked. The browser
 * imports the same file through `@semester/institution`, so the vocabulary the
 * screens use for "prepare" and "confirm" is the one the server enforces.
 */

export const LEVELS = ['inform', 'recommend', 'draft', 'prepare', 'confirm', 'execute', 'verify'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_TEXT: Record<Level, { means: string; example: string }> = {
  inform: { means: 'Says what is true.', example: 'Registration opens in three days.' },
  recommend: { means: 'Suggests, with its reason.', example: 'Save two backups for this course.' },
  draft: { means: 'Writes something the student edits.', example: 'Draft an advisor agenda.' },
  prepare: { means: 'Assembles a package; changes nothing.', example: 'Create a registration handoff package.' },
  confirm: { means: 'The student explicitly approves a write, share or export.', example: 'Approve adding this to your calendar.' },
  execute: { means: 'An authorised system action runs.', example: 'The calendar event is created.' },
  verify: { means: 'Confirms the outcome from the source, when the source permits.', example: 'The event is there when read back.' },
};

/** What `execute` needs on top of a confirmation. */
export interface Grounds {
  /** The student, or someone entitled to act for them, approved this exact action. */
  confirmed: boolean;
  /** Who is entitled to do it: a role or a grant, named. */
  authority: string | null;
  /** The policy that permits it: a rule id, named. */
  policy: string | null;
  /** The audit record that will hold it: an event id or a journal key. */
  audit: string | null;
}

export const NO_GROUNDS: Grounds = { confirmed: false, authority: null, policy: null, audit: null };

export const rank = (l: Level): number => LEVELS.indexOf(l);

/** What is missing before `level` may run, in the order to fix it. Empty means it may. */
export function missing(level: Level, g: Grounds = NO_GROUNDS, executed = false): string[] {
  const out: string[] = [];
  if (rank(level) >= rank('confirm') && !g.confirmed) out.push('a confirmation');
  if (rank(level) >= rank('execute')) {
    if (!g.authority?.trim()) out.push('an authority');
    if (!g.policy?.trim()) out.push('a policy');
    if (!g.audit?.trim()) out.push('an audit trail');
  }
  if (level === 'verify' && !executed) out.push('an execution to verify');
  return out;
}

export interface Step {
  from: Level;
  to: Level;
}

/**
 * May a feature that stands on `from` go to `to`? Going down is always
 * allowed. Going up one rung asks for that rung's grounds. Jumping over
 * `confirm` — from anything below it straight to `execute` — is refused
 * whatever else is offered: the brief's line is that Semester never goes from
 * inform to execute without the four things, and a confirmation is the one
 * that cannot be supplied by configuration.
 */
export function mayStep(s: Step, g: Grounds = NO_GROUNDS, executed = false): { ok: boolean; missing: string[]; why: string } {
  if (rank(s.to) <= rank(s.from)) return { ok: true, missing: [], why: 'Going down the ladder asks for nothing.' };
  if (rank(s.to) >= rank('execute') && rank(s.from) < rank('confirm')) {
    return { ok: false, missing: ['a confirmation step before execute'], why: `${s.from} cannot go straight to ${s.to}; the student confirms first.` };
  }
  const m = missing(s.to, g, executed);
  return { ok: m.length === 0, missing: m, why: m.length ? `${s.to} needs ${m.join(', ')}.` : `${s.to} has what it needs.` };
}

/**
 * The grounds for one commit, read from what the gateway has already decided.
 *
 * Nothing is invented here: `confirmed` is the request's own explicit `true`,
 * `authority` is the institution and area the caller holds write access to,
 * `policy` is the action the adapter offered for this record, and `audit` is
 * the correlation id the journal will write the start of the action under. A
 * missing piece is null, so `missing` names it instead of the caller guessing.
 */
export function groundsFor(input: {
  confirmed: unknown;
  institutionId: string | null | undefined;
  area: string | null | undefined;
  actionId: string | null | undefined;
  correlationId: string | null | undefined;
}): Grounds {
  const has = (v: string | null | undefined): v is string => typeof v === 'string' && v.trim() !== '';
  return {
    confirmed: input.confirmed === true,
    authority: has(input.institutionId) && has(input.area) ? `${input.institutionId}:${input.area}:write` : null,
    policy: has(input.area) && has(input.actionId) ? `action:${input.area}:${input.actionId}` : null,
    audit: has(input.correlationId) ? `journal:${input.correlationId}` : null,
  };
}
