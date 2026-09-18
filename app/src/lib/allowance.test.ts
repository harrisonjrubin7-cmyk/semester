/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MONTHLY_CALLS, MONTHLY_CALLS, costLine, costShort, readLimit, spell } from './allowance';

/**
 * One figure, two languages, and a test that can see both.
 *
 * The shared key's monthly allowance is enforced in
 * `supabase/functions/claude/index.ts`, which runs on Deno on a server, and
 * stated in `lib/allowance.ts`, which runs in a browser. Nothing imports
 * across that line and nothing can: they are separate deployments in separate
 * runtimes.
 *
 * So the only thing that can hold them together is a test that reads the other
 * one as text. That is a coarse instrument, and it is the right one here for
 * the reason `lib/pushchain.test.ts` gives for its own: the failure is a
 * number disagreeing across a boundary where each side is correct on its own,
 * and no unit test of either side can see it.
 *
 * What it is protecting against is not a crash. It is the app telling a new
 * account "sixty a month" on its first screen while the server has been
 * raised to two hundred — a sentence that is simply false, arriving in the one
 * place `screens/Onboarding.tsx` was rewritten to stop lying.
 */
const repo = join(process.cwd(), '..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('the shared key allowance', () => {
  it('matches the Edge Function that actually enforces it', () => {
    const fn = read('supabase/functions/claude/index.ts');
    const line = fn.match(/const MONTHLY_CALLS = Number\(Deno\.env\.get\('MONTHLY_CALL_LIMIT'\) \?\? '(\d+)'\)/);

    /*
     * The control, and it is the point of writing the match out in full.
     *
     * A regex that stops matching — because somebody renamed the constant, or
     * moved it, or changed how the default is written — returns null, and a
     * test that only compared numbers when it found one would pass silently
     * for the rest of the repository's life. A probe that cannot see the thing
     * it is checking has to fail, not shrug.
     */
    expect(line, 'could not find MONTHLY_CALLS in the Edge Function — has it moved?').toBeTruthy();
    // Against the *default*, which is what both sides fall back to when
    // nothing is configured. `MONTHLY_CALLS` follows an override where a
    // deployment sets one, and then only this repository's defaults can be
    // compared.
    expect(Number(line![1])).toBe(DEFAULT_MONTHLY_CALLS);
  });

  it('survives the empty string a deploy actually produces', () => {
    /*
     * The bug this replaces, and it was the shipped path rather than an edge
     * case. `?? '60'` falls back on `undefined`, not on `''`, and `''` is what
     * `.github/workflows/pages.yml` writes for
     * `${{ vars.X || secrets.X }}` when neither is configured — the state every
     * deployment is in until somebody sets one. `app/.env.example` ships the
     * name empty too.
     *
     * `Number('')` is `0`, so a deployed copy would have told a new account it
     * gets *zero* generations a month while the server allowed sixty: the app's
     * first screen contradicting the server, which is the single failure this
     * whole module was written to prevent. Caught by a review bot on the pull
     * request, not by the first version of this file.
     */
    expect(readLimit('')).toBe(DEFAULT_MONTHLY_CALLS);
    expect(readLimit('   ')).toBe(DEFAULT_MONTHLY_CALLS);
    expect(readLimit(undefined)).toBe(DEFAULT_MONTHLY_CALLS);
  });

  it('refuses anything that is not a real allowance', () => {
    // A cap of nought, a negative, a fraction of a call, or a word. None of
    // them is a number of generations, and a default beats a nonsense.
    for (const bad of ['0', '-5', '1.5', 'sixty', 'NaN', 'Infinity']) {
      expect(readLimit(bad), bad).toBe(DEFAULT_MONTHLY_CALLS);
    }
  });

  it('takes a real override, which is the point of having one', () => {
    // The control for the two above: if `readLimit` simply returned the
    // default always, every case so far would pass and the setting would be
    // dead.
    expect(readLimit('200')).toBe(200);
    expect(readLimit(' 120 ')).toBe(120);
  });

  it('is the number the Edge Function says out loud when it refuses', () => {
    // The 429 body interpolates `MONTHLY_CALLS`, so a student who hits the cap
    // is told the same figure onboarding told them. This pins that it is still
    // interpolated rather than written out by hand beside it.
    const fn = read('supabase/functions/claude/index.ts');
    expect(fn).toContain('${MONTHLY_CALLS} generations this month');
  });
});

describe('what the app says it costs', () => {
  it('says the three unconditional things before the metered one', () => {
    const line = costLine();
    const free = line.indexOf('Free');
    const metered = line.indexOf('shared key');
    expect(free).toBeGreaterThanOrEqual(0);
    expect(metered).toBeGreaterThan(free);
  });

  it('never says unlimited, which is the one word that would be false', () => {
    /*
     * The whole reason this module exists.
     *
     * The proposal that started it asked for "free, unlimited courses, no
     * credit card". Courses are unlimited; generations are not, and two
     * shipped screens already say so — `settings/Assistant.tsx` and
     * `lib/claude.ts`'s "The shared key has run out for this month". Putting
     * "unlimited" next to the AI on a first run would make the app's first
     * sentence contradict its own settings screen.
     */
    for (const said of [costLine(), costShort()]) {
      expect(said.toLowerCase()).not.toContain('unlimited');
    }
  });

  it('carries the allowance as a figure rather than a hard-coded word', () => {
    // If the deployment raises the limit, the sentence moves with it. A
    // literal "sixty" in the copy is the drift this module exists to stop.
    expect(costLine()).toContain(spell(MONTHLY_CALLS));
  });

  it('spells small numbers and gives up gracefully on odd ones', () => {
    expect(spell(60)).toBe('sixty');
    expect(spell(5)).toBe('five');
    expect(spell(100)).toBe('a hundred');
    expect(spell(137)).toBe('137');
    expect(spell(-1)).toBe('-1');
  });
});
