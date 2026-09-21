import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isEpisodeScript } from './episodes';

const SCRIPTS = join('..', 'audio', 'scripts');

describe('telling a script from what was measured while speaking it', () => {
  it('keeps the script and skips every sidecar beside it', () => {
    expect(isEpisodeScript('econ1020.json')).toBe(true);
    expect(isEpisodeScript('econ1020.chapters.json')).toBe(false);
    expect(isEpisodeScript('econ1020.lines.json')).toBe(false);
  });

  it('skips a sidecar nobody has written yet', () => {
    /*
     * The point of the rule. `.words.json`, `.spend.json`, whatever comes
     * next — a walk that lists what to skip is wrong the day one is added,
     * and wrong silently, because a sidecar carries the same `id` and
     * `course` the walks search on.
     */
    expect(isEpisodeScript('econ1020.words.json')).toBe(false);
    expect(isEpisodeScript('econ1020.anything.at.all.json')).toBe(false);
  });

  it('skips what is not JSON', () => {
    expect(isEpisodeScript('econ1020')).toBe(false);
    expect(isEpisodeScript('README.md')).toBe(false);
  });

  it('finds exactly the four shipped scripts in the real directory', () => {
    // Against the directory rather than a fixture: the failure being guarded
    // against is a file appearing there that the rule has never seen.
    const kept = readdirSync(SCRIPTS).filter(isEpisodeScript).sort();
    expect(kept).toEqual(['bus1600.json', 'core2500.json', 'econ1020.json', 'psci1104.json']);
  });
});
