import type { AuthorizationDecision } from '@semester/institution';

/**
 * The actions a person takes on their own things, and the one rule that
 * governs them.
 *
 * Personal data is not the policy decision point's business. A task or a note
 * is protected where it is stored — the working copy never leaves the device
 * unless the student signs in, and then owner-only row-level security guards
 * the second copy (ADR 0001, ADR 0002). What the interface needs is smaller:
 * to know, before drawing a button, whether pressing it could possibly be
 * allowed, so it can say so instead of failing. That is all this answers, and
 * it is advisory in exactly the sense `lib/role.ts` already is.
 *
 * Every action is named, and an unnamed one is refused. Adding a line here is
 * the same kind of decision as adding one to `POLICY_ACTIONS` in the package:
 * it is a statement that the action exists.
 */
export const PERSONAL_ACTIONS = ['tasks.read', 'tasks.create', 'tasks.complete', 'tasks.reopen', 'calendar.read', 'today.view'] as const;
export type PersonalAction = (typeof PERSONAL_ACTIONS)[number];

export const isPersonalAction = (value: unknown): value is PersonalAction =>
  typeof value === 'string' && (PERSONAL_ACTIONS as readonly string[]).includes(value);

/** What the rule needs to know about who is acting. Identity's `Subject` satisfies it. */
export interface PersonalActor {
  readonly id: string | null;
}

export interface PersonalResource {
  /** Absent on anything that has only ever lived on this device. */
  readonly ownerId?: string | null;
}

/**
 * Allowed unless the thing belongs to somebody else.
 *
 * A device-local thing has no owner and is the actor's. A thing with an owner
 * is the actor's only if they are that account — which means a signed-out
 * device holding another account's synced data may not act on it, the case
 * the owner-only database policy exists for and the interface should not
 * invite.
 */
export function decidePersonal(actor: PersonalActor, action: string, resource: PersonalResource = {}): AuthorizationDecision {
  if (!isPersonalAction(action)) {
    return { allow: false, reasonCode: 'action_unknown', userMessage: 'This action is not one Semester knows how to authorize.' };
  }
  if (resource.ownerId != null && resource.ownerId !== actor.id) {
    return { allow: false, reasonCode: 'not_owner', userMessage: 'This belongs to a different account. Sign in to it to make changes.', userAction: { label: 'Sign in', kind: 'open_screen' } };
  }
  return { allow: true, obligations: [] };
}
