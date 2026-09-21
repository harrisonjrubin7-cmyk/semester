import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isEpisodeScript } from './episodes';

/**
 * The third walk, kept in step with the other two.
 *
 * `lib/episodes.ts` opens by naming the fault it was written for: three
 * separate walks told scripts from sidecars by listing the one sidecar that
 * existed, `.chapters.json`, and adding a second — `.lines.json` — broke one
 * of them and left the others "a directory-order coin-flip away".
 *
 * `isEpisodeScript` fixed the two walks inside `src`. `scripts/transcripts.mjs`
 * is the third, and it was not migrated: it still read the blocklist, so it
 * parsed `bus1600.lines.json` as a script and `npm run transcripts` died on
 * the first one with `TypeError … (reading 'replace')`. Nothing in the suite
 * ran it, so nothing said so.
 *
 * It cannot import `isEpisodeScript` — it is a plain `.mjs` build script and
 * that module is TypeScript — so it carries the same regular expression, and
 * this is what stops the copy drifting. Reading the source rather than the
 * behaviour, for the reason `isolation.test.ts` reads `vite.config.ts`: the
 * thing that goes wrong is the two falling out of step, and that is visible
 * in the text before it is visible in a run.
 */

const SCRIPT = join(process.cwd(), 'scripts/transcripts.mjs');
const SCRIPTS_DIR = join(process.cwd(), '..', 'audio', 'scripts');

/** The rule the build script actually applies, lifted out of its source. */
function ruleInScript(): RegExp {
  const src = readFileSync(SCRIPT, 'utf8');
  const m = src.match(/if \(!(\/\^.*?\/)\.test\(file\)\) continue;/);
  if (!m) throw new Error('transcripts.mjs no longer filters with a regular expression on `file`');
  const body = m[1].slice(1, -1);
  return new RegExp(body);
}

describe('the build script tells a script from a sidecar the same way the app does', () => {
  it('filters with a rule rather than a list of what to skip', () => {
    // A blocklist has to be edited every time something new is written down,
    // which is how this broke. The shape of the check is the fix.
    const src = readFileSync(SCRIPT, 'utf8');
    expect(src).not.toMatch(/endsWith\('\.chapters\.json'\)/);
    expect(() => ruleInScript()).not.toThrow();
  });

  it('agrees with `isEpisodeScript` on every name in audio/scripts', () => {
    const rule = ruleInScript();
    const names = readdirSync(SCRIPTS_DIR);
    // The directory has to hold at least one of each, or this proves nothing.
    expect(names.some((n) => isEpisodeScript(n))).toBe(true);
    expect(names.some((n) => !isEpisodeScript(n))).toBe(true);
    for (const name of names) {
      expect(rule.test(name), name).toBe(isEpisodeScript(name));
    }
  });

  it('agrees with it on the sidecars nobody has written yet', () => {
    const rule = ruleInScript();
    for (const name of ['econ1020.json', 'econ1020.chapters.json', 'econ1020.lines.json',
      'econ1020.words.json', 'econ1020.anything.at.all.json', 'README.md', 'econ1020']) {
      expect(rule.test(name), name).toBe(isEpisodeScript(name));
    }
  });
});
