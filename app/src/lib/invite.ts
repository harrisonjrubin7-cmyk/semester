/**
 * Saying why an account could not be made, when the reason is the invite list.
 *
 * The gate itself is a trigger on `auth.users` —
 * `supabase/migrations/20260921002428_invites.sql` — and it has to be there
 * rather than here, because the key this app carries is publishable and
 * anybody holding it can call the auth endpoint without ever loading this
 * file. **Everything in this module is an explanation. None of it is the
 * enforcement**, and `invite.test.ts` asserts that in the only way it can: by
 * checking that nothing here ever returns "you may proceed", only sentences.
 *
 * What the gate leaves behind is unreadable. A trigger that raises during
 * sign-up reaches the browser as
 *
 *     Database error saving new user
 *
 * which tells somebody who was not invited nothing at all, and tells somebody
 * who *was* invited that the app is broken. Both of those are worse than the
 * truth, and during a pilot the second one costs a tester.
 */

/**
 * The shapes the gate's refusal arrives in.
 *
 * Two, and there was very nearly a third. The same trigger is reached by two
 * paths — an email sign-up fails inside the call, and an OAuth sign-in fails
 * after the redirect — so a separate `unexpected_failure.*saving new user`
 * pattern was written for the second, on the assumption that it looked
 * different.
 *
 * It does not. Supabase's OAuth callback carries the same sentence, so the
 * first pattern already matched it and the third could not fire. Removing it
 * left every test green, which is how it was found, and it is gone for the
 * reason a dead bed check in the housing adapter is gone: **a guard that
 * cannot fire is worse than no guard, because it reads like coverage that is
 * not there.** The test for the OAuth-shaped message stays, because what it
 * documents — that the combined form is recognised — is still true.
 */
const REFUSALS = [/database error saving new user/i, /semester: not on the invite list/i];

/** Whether this failure is the invite gate rather than something broken. */
export const refusedByInvite = (said: string): boolean => REFUSALS.some((r) => r.test(said));

/**
 * What to put on the screen.
 *
 * Returns the original message untouched when it is not the gate, because a
 * module that rewrote every sign-up failure into "you are not invited" would
 * hide a genuine outage behind a plausible sentence — and during a pilot the
 * people who would notice are the ones being told to go away.
 */
export function explainSignUp(said: string, address?: string): string {
  if (!refusedByInvite(said)) return said;
  return (
    `Semester is invite-only while it is being piloted, and ${
      address ? `${address} is` : 'this address is'
    } not on the list yet. ` +
    'If you were expecting to be, it may be that you were invited at a different address — ' +
    'try the one the invitation was sent to. Nothing was created and nothing was lost.'
  );
}

/**
 * The same, for a sign-in that came back from a provider.
 *
 * A separate sentence because the situation genuinely differs: somebody who
 * has just been bounced through Google has no form in front of them to try a
 * different address in, and telling them to "try the other one" without saying
 * how is the kind of instruction that reads as helpful and is not.
 */
export function explainProvider(said: string, provider: string): string {
  if (!refusedByInvite(said)) return said;
  return (
    `Semester is invite-only while it is being piloted, and the address on your ${provider} account ` +
    'is not on the list yet. Signing in with a different account, or with an email and password, ' +
    'will use a different address. Nothing was created.'
  );
}
