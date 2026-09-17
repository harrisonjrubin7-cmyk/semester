import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A setting the deploy cannot supply is a setting the deployed app does not
 * have.
 *
 * This app reads fifteen `VITE_…` build inputs, and `app/.env.example`
 * documents every one of them. For most of this repository's life the Pages
 * workflow carried three: the Supabase pair and the push key. The other twelve
 * — the university gateway, the assistant proxy, the calendar forwarder, the
 * OAuth proxy, four client IDs and the four STUN/TURN settings — had no way
 * into a deployed build at all, and two of the entries documenting them say in
 * so many words that they are what a *deployed* copy uses.
 *
 * Nothing broke, which is why it lasted. Every one of them degrades politely:
 * the University screen says no approved connection is configured, Connect
 * offers the file route instead of a sign-in, the call screen says some
 * networks will refuse. A deployed copy looked exactly like a working app with
 * features deliberately switched off.
 *
 * ## The probe, and why the obvious one would have reported all clear
 *
 * The obvious way to find the inputs is to grep for `import.meta.env.VITE_X`.
 * It is wrong here, and quietly: `cloud.ts`, `connect.ts`, `rtc.ts`,
 * `feedlink.ts` and `assistant.ts` all take `const env = import.meta.env`
 * first and then read `env.VITE_X`, so nine of the fifteen — including
 * `VITE_SUPABASE_KEY`, which the deploy *does* carry — are invisible to it. A
 * probe that found six of fifteen and named none of the missing ones would
 * have read as a clean bill of health.
 *
 * So the probe matches the bare name anywhere in the source, and the first
 * test below is a control on the probe rather than on the workflow: it asserts
 * the set contains a name only the indirect form can produce. If somebody
 * narrows this scan back to the static form, that test goes red before the
 * coverage silently does.
 */

const ROOT = join(process.cwd(), '..');
const PAGES = join(ROOT, '.github', 'workflows', 'pages.yml');

/**
 * Names that are not an operator's to set, with the reason each is exempt.
 *
 * This list is load-bearing in the wrong direction — anything added to it
 * stops being checked — so the last test asserts every entry is a name the
 * source actually reads. An exemption for a setting nobody reads is either
 * stale or a place to hide one that is missing.
 */
const STAMPED: Record<string, string> = {
  VITE_BUILD_ID:
    'stamped by vite.config.ts on every build, so the service worker can tell one build from another. Not an operator setting.',
};

/**
 * Source with its comments taken out.
 *
 * Matching the bare name anywhere is what makes the indirect reads visible,
 * and the price is that prose naming a setting counts as reading one. That is
 * not hypothetical — the commit that added this file names the dead
 * `VITE_BUILD` in a comment explaining why it is dead, and the first version
 * of this scan then demanded the workflow carry it. Block comments and
 * whole-line `//` comments go; a trailing `// …` on a line of code stays,
 * which has never mattered here and would only ever over-report.
 */
const code = (text: string) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');

/** Every `VITE_…` name the app's own source reads, however it reads it. */
function inputsTheAppReads(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      // Tests stub these by name — `vi.stubEnv('VITE_SUPABASE_KEY', …)` — so a
      // scan that included them would count a name the app had stopped
      // reading, and the workflow would be asked to carry a dead setting.
      if (/\.test\.[cm]?[jt]sx?$/.test(entry)) continue;
      if (!/\.[cm]?[jt]sx?$/.test(entry)) continue;
      for (const m of code(readFileSync(path, 'utf8')).matchAll(/VITE_[A-Z0-9_]+/g)) found.add(m[0]);
    }
  };
  walk(join(process.cwd(), 'src'));
  return found;
}

describe('the build inputs a deploy can supply', () => {
  const read = inputsTheAppReads();
  const pages = readFileSync(PAGES, 'utf8');
  const settable = [...read].filter((name) => !(name in STAMPED)).sort();

  it('finds the names that are read through an aliased import.meta.env', () => {
    // The control on the probe. `cloud.ts` reads `env.VITE_SUPABASE_KEY`, and
    // a scan for the static form finds nothing here.
    expect(read, 'the probe missed an indirect read').toContain('VITE_SUPABASE_KEY');
    expect(read, 'the probe missed an indirect read').toContain('VITE_TURN_PASS');
  });

  it('does not count a name that only appears in a comment', () => {
    // `VITE_BUILD` was the diagnostics report's build stamp and was set by
    // nothing at all, so every diagnostics file ever sent said "dev" — see
    // `screens/Privacy.tsx`, which now reads the stamp that exists and
    // explains the old one in a comment. Counting that comment would ask the
    // deploy to carry a setting no code reads. If this ever goes red because
    // something started reading it for real, carry it and delete this test.
    expect(read, 'a commented-out name is being counted as a read').not.toContain('VITE_BUILD');
  });

  it('finds enough of them that a broken scan cannot pass', () => {
    // Fifteen today. The floor is deliberately below that so adding a setting
    // is not a failing test, and far enough above the exempt list that an
    // empty or half-walked scan is caught.
    expect(settable.length, `settable inputs found: ${settable.join(', ')}`).toBeGreaterThan(10);
  });

  for (const name of [...new Set([...inputsTheAppReads()])]
    .filter((n) => !(n in STAMPED))
    .sort()) {
    it(`offers ${name} to the Pages build`, () => {
      // The mapping line, not the bare name: a name in a comment would satisfy
      // a substring check while the build still never saw the value. It also
      // pins the shape — a repository variable winning over a secret of the
      // same name — and rules out the aliases the three original settings came
      // in under (`URL:`, `KEY:`, `VAPID:`). Those worked; what they were not
      // was checkable, which is how the other twelve went missing unnoticed.
      expect(
        pages,
        `${name} is read by the app but .github/workflows/pages.yml never maps it into the build`,
      ).toContain(`${name}: \${{ vars.${name} || secrets.${name} }}`);
    });
  }

  it('exempts only names the source actually reads', () => {
    for (const [name, why] of Object.entries(STAMPED)) {
      expect(read, `${name} is exempt (${why}) but nothing in src reads it`).toContain(name);
    }
  });
});
