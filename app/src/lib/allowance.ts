/**
 * What this app costs, said once.
 *
 * Three of the four things worth saying are unconditionally true and were
 * nowhere on any screen: there is no payment code in this repository at all —
 * no checkout, no plan, no tier, no price — nothing asks for a card, and
 * nothing caps how many courses you add. A student could use the whole app for
 * a term without ever learning that, because the app never said so.
 *
 * ## The fourth thing is a number, and a number is the dangerous kind
 *
 * Reading a syllabus for you is the one part that costs real money to run, so
 * the shared key is metered: an allowance per account per calendar month, and
 * your own key instead of it has no limit at all. That is a good offer and
 * worth saying plainly.
 *
 * It is also the one claim here that can go stale, and this app has been burnt
 * by exactly that. `screens/Onboarding.tsx` used to tell a new account "We
 * found 38 dated obligations across four courses" before they had uploaded
 * anything — *"The first thing the app said was false, which is a bad way to
 * be trusted with a semester."* An allowance written into onboarding by hand,
 * while the real cap sits in a server environment variable, is the same
 * mistake with a longer fuse: nothing goes red, the sentence simply stops
 * being true the day somebody raises the limit in a dashboard.
 *
 * So the number has one home on this side — here — and `allowance.test.ts`
 * reads the Edge Function's own default and fails if the two ever disagree.
 * Two languages, one figure, and a test that can see both.
 *
 * ## Why a default rather than a fetch
 *
 * The honest alternative is asking the server, and the server already answers:
 * every reply from `supabase/functions/claude` carries `X-Calls-Remaining`.
 * But onboarding runs before an account exists and before any call has been
 * made, so there is nothing to ask and nobody to ask it for. What a first run
 * can honestly state is the allowance this build ships with, which is what
 * this is — and a deployment that changes it sets `VITE_MONTHLY_CALL_LIMIT`
 * to match, which the guard then checks.
 */

const env = import.meta.env as unknown as Record<string, string | undefined>;

/**
 * The shared key's monthly allowance, as this build understands it.
 *
 * Must equal `MONTHLY_CALL_LIMIT`'s default in
 * `supabase/functions/claude/index.ts`. `allowance.test.ts` is what makes
 * "must" mean something.
 */
export const MONTHLY_CALLS = Number(env.VITE_MONTHLY_CALL_LIMIT ?? '60');

/**
 * Spelt out, because a sentence about money reads better in words.
 *
 * Only to twenty, and past that it falls back to the figure — a sentence
 * saying "one hundred and twenty generations" is worse than one saying "120",
 * and inventing a full number-speller for a settings line nobody will read
 * aloud is the kind of thing that ends up with its own test file.
 */
const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
];

export function spell(n: number): string {
  if (!Number.isInteger(n) || n < 0) return String(n);
  if (n <= 20) return WORDS[n];
  if (n <= 100 && n % 10 === 0) {
    const tens: Record<number, string> = {
      30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty',
      70: 'seventy', 80: 'eighty', 90: 'ninety', 100: 'a hundred',
    };
    return tens[n] ?? String(n);
  }
  return String(n);
}

/**
 * The whole claim, in one sentence, for a screen that has room for one.
 *
 * Deliberately in this order: the three unconditional facts first, because
 * they are the ones that are simply true and the ones no competitor matches,
 * and the metered part last with its escape hatch attached. A student who
 * reads only the first half has not been misled.
 */
export function costLine(): string {
  return (
    `Free, and there is nothing to buy: no card, no subscription, and no limit on how many ` +
    `courses you add. Reading a syllabus for you is the one part that costs anything to run, ` +
    `so a signed-in account gets ${spell(MONTHLY_CALLS)} of those a month on the shared key — ` +
    `or add your own key and there is no limit on that either.`
  );
}

/**
 * The short form, for the first screen of onboarding.
 *
 * The long one is four clauses and the promise screen already carries a
 * sentence about what the app does. This says the part somebody is actually
 * wondering about on screen one.
 */
export function costShort(): string {
  return `Free — no card, no subscription, no limit on courses.`;
}
