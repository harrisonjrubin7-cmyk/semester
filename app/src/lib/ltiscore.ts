/**
 * Tell Brightspace a quiz score, if there is anywhere to tell it.
 *
 * The heavy half of grade passback, and heavy for the same reason
 * `lib/ltilanding.ts` is: it reaches `lib/cloud.ts`. `screens/Drill.tsx`
 * reaches this through `import()` on the one render that has a finished
 * quiz, and on no other — a student who never opened Semester from an LMS
 * never downloads it.
 *
 * ## What it does not decide
 *
 * Whether anything is reported. That was decided in Brightspace, by an
 * instructor placing a link as a graded activity, and recorded on the server
 * at launch. This function sends a course code and a score and is told
 * whether they went anywhere; the ordinary answer, for almost every quiz in
 * this app, is that they did not, and the screen shows nothing.
 *
 * It says so when they did. A number leaving this device for a gradebook is
 * exactly the kind of thing `lib/role.ts` argues a student should never
 * find out about afterwards, so the one line the Drill screen adds is not
 * decoration: it is the promise being kept out loud.
 */

import { cloud, cloudConfigured } from './cloud';

/** What the server said. `reason` is a word for a log, never for a person. */
export type Reported =
  | { reported: true; course: string }
  | { reported: false; reason: string };

/**
 * One sentence for the screen, when there is one to show.
 *
 * Only the reported case has a sentence. Every refusal — no account, no
 * launch, not graded, no match — is the app doing nothing, and telling a
 * student "your score was not sent to a gradebook nobody set up" is noise
 * that reads as an error.
 */
export function saidAbout(what: Reported): string | null {
  return what.reported ? `Reported to Brightspace for ${what.course}.` : null;
}

export async function report(code: string, given: number, max: number): Promise<Reported> {
  if (!cloudConfigured) return { reported: false, reason: 'no-cloud' };
  if (!code.trim() || !Number.isFinite(given) || !Number.isFinite(max) || max <= 0) {
    return { reported: false, reason: 'nothing-to-report' };
  }

  const db = await cloud();
  const { data } = await db.auth.getSession();
  if (!data.session) return { reported: false, reason: 'signed-out' };

  /*
   * `functions.invoke` attaches the session and the publishable key itself,
   * which is why this is not a bare `fetch`: the two headers the function
   * needs are the two a hand-written call gets wrong on the day the key is
   * rotated. A sub-path in the name is passed through as one.
   */
  const { data: out, error } = await db.functions.invoke('lti/score', {
    body: { code: code.trim(), given, max },
  });
  if (error) {
    console.error(`lti score: ${error.message}`);
    return { reported: false, reason: 'failed' };
  }
  const answer = out as Partial<Reported> | null;
  if (answer && answer.reported === true && typeof answer.course === 'string') {
    return { reported: true, course: answer.course };
  }
  return {
    reported: false,
    reason: answer && typeof (answer as { reason?: unknown }).reason === 'string'
      ? (answer as { reason: string }).reason
      : 'failed',
  };
}
