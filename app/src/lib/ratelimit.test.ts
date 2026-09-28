import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { explain } from './classmates';
import { classify } from './failure';

/*
 * The rate limit on the browser's direct writes speaks to the student in the
 * database's own words.
 *
 * `20260928230000_direct_rate_limits.sql` refuses an insert past its limit
 * with SQLSTATE 54000 and a sentence written to be shown as it stands, because
 * most write paths show `error.message` verbatim — `lib/feedback.ts`,
 * `lib/mentors.ts`, `lib/help-routes.ts`, `community/client.ts` — and the rest
 * pass through anything they do not recognise. Two of those do recognise
 * words, and would turn this sentence into different, wrong advice if it ever
 * contained them: `formshare.ts` reads /row-level security|policy/ as "this
 * form has stopped taking answers", and `explain` in `classmates.ts` reads
 * "row-level security" as an unconfirmed address.
 *
 * So the sentence is read out of the migration, not repeated here, and held
 * to that.
 */

const MIGRATION = join(
  process.cwd(),
  '..',
  'supabase',
  'migrations',
  '20260928230000_direct_rate_limits.sql',
);

function refusal(): { message: string; code: string } {
  const sql = readFileSync(MIGRATION, 'utf8');
  // Every raise, then the one a student can reach: the other is an argument
  // check on a function no client may call.
  const raises = [...sql.matchAll(/raise exception '((?:[^']|'')+)'\s*using errcode = '(\w+)'/g)]
    .map((m) => ({ message: m[1].replace(/''/g, "'"), code: m[2] }))
    .filter((r) => !r.message.startsWith('take_direct_rate_limit:'));
  if (raises.length !== 1) throw new Error(`expected one refusal in the migration, found ${raises.length}`);
  return raises[0];
}

describe('the direct-write rate limit, as the student reads it', () => {
  it('is found in the migration at all', () => {
    // The control for everything below: a regex that matched nothing would
    // make every other assertion here about an empty string.
    const { message, code } = refusal();
    expect(message.length).toBeGreaterThan(20);
    expect(code).toBe('54000');
  });

  it('is a calm sentence with nothing of the database in it', () => {
    const { message } = refusal();
    expect(message).toBe("You've sent a lot in a short time — try again in a few minutes.");
    expect(message).not.toMatch(/rate.?limit|bucket|sqlstate|54000|table|insert/i);
  });

  it('is not mistaken for a closed form or an unconfirmed address', () => {
    const { message } = refusal();
    expect(message).not.toMatch(/row-level security|policy/i);
    expect(explain(message)).toBe(message);
  });

  it('is classified as a rate limit by its code', () => {
    const { message, code } = refusal();
    expect(classify({ code, message, status: 413 })).toBe('RATE_LIMITED');
  });
});
