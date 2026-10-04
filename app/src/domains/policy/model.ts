import type { Principal } from '../identity';

/**
 * What this person may be offered, decided in one place.
 *
 * One function, `decide`, answers one question in one shape, and every domain
 * asks it instead of testing `role === 'student'` where it happens to be. It is
 * the client-side counterpart of the decision point in
 * `packages/institution/src/policy.ts` (ADR 0007) and uses the same vocabulary —
 * `allow` with obligations, or `deny` with a reason and a sentence — so a rule
 * that moves to the server moves without being rewritten.
 *
 * **It is for deciding what to offer, never what to allow.** The database's row
 * level security is the boundary (ADR 0002). A wrong answer here can hide
 * something from somebody entitled to it; it cannot hand anybody data. That is
 * why the one mode with a server-side meaning — read-only — is an *obligation*
 * the caller honours rather than a denial it could skip.
 *
 * Fail closed: an action with no rule is denied, and so is a role a rule does
 * not name. Widening access is a one-line change to `RULES`, and the test that
 * walks every action against every role makes that line visible in review.
 */

export const POLICY_ACTIONS = [
  'today.view',
  'task.read',
  'task.write',
  'calendar.read',
  'calendar.write',
] as const;
export type PolicyAction = (typeof POLICY_ACTIONS)[number];

export const isPolicyAction = (value: unknown): value is PolicyAction =>
  typeof value === 'string' && (POLICY_ACTIONS as readonly string[]).includes(value);

/** Things the caller must do if it acts on an `allow`. */
export type Obligation = 'keep_on_device';

export type DenyReason = 'unknown_action' | 'role_not_served';

export type Decision =
  | { allow: true; obligations: readonly Obligation[] }
  | { allow: false; reason: DenyReason; message: string };

/** What the host says about the environment the decision is made in. */
export interface PolicyEnvironment {
  /** The deployment is in read-only mode: writes are kept on this device until it ends. */
  readOnly: boolean;
}

interface Context {
  principal: Principal;
  environment: PolicyEnvironment;
}

type Rule = (ctx: Context) => Decision;

const allow = (obligations: readonly Obligation[] = []): Decision => ({ allow: true, obligations });
const deny = (reason: DenyReason, message: string): Decision => ({ allow: false, reason, message });

/** The decision surface on Today is written for a student's own semester. */
const studentOnly: Rule = ({ principal }) =>
  principal.role === 'student'
    ? allow()
    : deny('role_not_served', 'Today is built around a student’s own semester. Your home is somewhere else.');

/** A person's own workspace is theirs whatever their role: reading it is always offered. */
const anyone: Rule = () => allow();

/** Writing is offered to anyone, but in read-only mode it only ever stays on this device. */
const writes: Rule = ({ environment }) => allow(environment.readOnly ? ['keep_on_device'] : []);

export const RULES: Readonly<Record<PolicyAction, Rule>> = {
  'today.view': studentOnly,
  'task.read': anyone,
  'task.write': writes,
  'calendar.read': anyone,
  'calendar.write': writes,
};

/** Answer one question. Fails closed on anything the table does not name. */
export function decide(principal: Principal, action: string, environment: PolicyEnvironment): Decision {
  if (!isPolicyAction(action)) return deny('unknown_action', 'That isn’t something Semester offers.');
  return RULES[action]({ principal, environment });
}
