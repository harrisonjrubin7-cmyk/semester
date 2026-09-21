/**
 * The heavy half of landing from a Brightspace launch.
 *
 * `lib/ltiarrival.ts` asks whether this load is a launch and takes the values
 * off the address bar. This module is what happens next, and it reaches
 * `lib/cloud.ts` — which is exactly why the question is not asked here. See
 * that file's header, and `ENGINEERING-AUDIT.md` §1 for what asking a cheap
 * question from inside an expensive module cost the last time.
 *
 * `main.tsx` reaches this through `import()` on the load that is a launch, and
 * on no other.
 */

import { cloud } from './cloud';
import type { Handoff } from './ltiarrival';

/** What `adopt` can come back with. The words are the database's. */
export type Adopted = 'ok' | 'signed-out' | 'stale' | 'same-account' | 'in-use' | 'failed';

/**
 * One sentence a person reads, for each word the database returns.
 *
 * The division `claim_referral` and the invite gate both draw: the database
 * answers with a word for a log, and turning it into English is the client's
 * job. Keeping the sentences here rather than in a screen means the two places
 * that will eventually show this cannot drift apart.
 */
export function saidAbout(what: Adopted): string {
  switch (what) {
    case 'ok':
      return 'Connected. Opening Semester from Brightspace will use your own account from now on.';
    case 'signed-out':
      return 'Sign in to the Semester account you already have, then try again.';
    case 'stale':
      return 'That link has expired. Open Semester from Brightspace again to start over.';
    case 'same-account':
      return 'This is already your account — there is nothing to connect.';
    case 'in-use':
      /*
       * The one refusal that is not the student doing anything wrong, and the
       * only one that needs a person. Saying "contact us" beats implying they
       * can fix it by trying harder.
       */
      return 'The account Brightspace made for you already has work in it, so connecting would mean merging two accounts. Get in touch and we will do it by hand.';
    default:
      return 'Something went wrong connecting your account. Nothing was changed.';
  }
}

/**
 * Establish the session the launch minted.
 *
 * `verifyOtp` with the token hash, which is what `generateLink` produced on
 * the server. This is the only place in the app a session arrives from
 * anywhere but a sign-in form or an OAuth round trip.
 */
export async function consume(handoff: Handoff): Promise<boolean> {
  const db = await cloud();
  const { error } = await db.auth.verifyOtp({
    token_hash: handoff.token,
    type: 'magiclink',
  });
  if (error) {
    console.error(`lti landing: could not establish the session — ${error.message}`);
    return false;
  }
  return true;
}

/**
 * Attach this launch to the account the student is signed in to.
 *
 * Called while signed in as the account they already had — which is the half
 * of the proof this side holds. The other half is the ticket, which only the
 * server could have minted. `adopt_lti_identity` is the only function in this
 * schema a signed-in account may call for a reason, and the reason is this.
 */
export async function adopt(ticket: string): Promise<Adopted> {
  const db = await cloud();
  const { data, error } = await db.rpc('adopt_lti_identity', { want_ticket: ticket });
  if (error) {
    console.error(`lti adopt failed: ${error.message}`);
    return 'failed';
  }
  return (data as Adopted) ?? 'failed';
}
