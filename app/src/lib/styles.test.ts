import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check } from '../../../pipeline/restyle.mjs';
import { pointsAtSomebody } from '../../../pipeline/likeness.mjs';
import { performableWith, STYLE_IDS, STYLES, VOICES } from '../../../pipeline/styles.mjs';

/**
 * The six hosting styles, as structural parameters.
 *
 * §4 of the roadmap names six podcast formats as tone references and then says
 * the workable version is to lift the *structure* each runs on: "Nobody needs
 * to sound like a particular podcaster. They need the pacing of a long curious
 * tangent that circles back to the point." `styles.mjs` has claimed since it
 * was written that "nothing here is a person, a show, or a voice", and until
 * now nothing checked it.
 *
 * The guard lives here because the module is pure and this is where CI runs —
 * the arrangement `restyle.test.ts` already uses for the checker these presets
 * are fed through.
 */

const styles = STYLE_IDS.map((id: string) => [id, STYLES[id]] as const);

describe('the presets as a set', () => {
  it('is the six the roadmap names', () => {
    expect(STYLE_IDS).toHaveLength(6);
    expect(new Set(STYLE_IDS).size).toBe(6);
  });

  it('gives every one a label, a blurb, rules and a voice', () => {
    for (const [id, style] of styles) {
      expect(style.label, id).toBeTruthy();
      expect(style.blurb.length, id).toBeGreaterThan(30);
      expect(style.rules.length, id).toBeGreaterThanOrEqual(4);
      expect(VOICES, id).toContain(style.voice);
    }
  });

  it('does not say the same thing twice under two names', () => {
    /*
     * The failure a set of presets degrades into: six entries, four of which
     * are the same instruction reworded. Every rule in the file is compared
     * with every other, because two presets that share a rule are two presets
     * that will produce the same rewrite for the lines that rule governs.
     */
    const seen = new Map<string, string>();
    for (const [id, style] of styles) {
      for (const rule of style.rules) {
        const key = rule.toLowerCase().replace(/[^a-z ]/g, '').trim();
        expect(seen.get(key), `${id} repeats a rule from ${seen.get(key)}`).toBeUndefined();
        seen.set(key, id);
      }
      expect(style.label, id).not.toBe(STYLES[STYLE_IDS.find((o: string) => o !== id)!].label);
    }
  });
});

describe('nothing here is a person, a show, or a voice', () => {
  it('is checked rather than asserted, by the rule the other two use', () => {
    /*
     * §7: "No real person's name, voice or likeness in any persona preset or
     * character sheet." It reads as being about personas and is not — six
     * podcast formats were named as references when this was planned, and a
     * preset that reached for one of them by name is exactly the thing the
     * roadmap decided against in its own §4.
     *
     * `likeness.mjs` is the same module `personas.mjs` puts on an appearance
     * note and `broll.mjs` on a shot subject. Third caller.
     */
    for (const [id, style] of styles) {
      for (const text of [style.label, style.blurb, ...style.rules]) {
        expect(pointsAtSomebody(text), `${id}: ${text.slice(0, 60)}`).toBeUndefined();
      }
    }
  });

  it('would catch a preset that reached for one', () => {
    // The rule is only worth having if it fires. A style written the way the
    // roadmap warned against.
    expect(pointsAtSomebody('Pace it like a well-known morning show.')).toBeTruthy();
    expect(pointsAtSomebody('Host energy in the style of a late-night monologue.')).toBeTruthy();
  });
});

describe('what each preset needs a voice to do', () => {
  it('holds back exactly the one that needs range', () => {
    /*
     * This replaces a `NOT_YET` list of three that gave one reason covering
     * all of them. Two of the three wanted a level read all along —
     * reflection is what Piper is best at — and holding them back was one
     * true sentence doing duty for three presets.
     */
    const expressive = STYLE_IDS.filter((id: string) => STYLES[id].voice === 'expressive');
    expect(expressive).toEqual(['hype-reaction']);
  });

  it('says which are performable with the voice that is installed', () => {
    // `audio/synth.py` speaks with Piper, which reads evenly and does not do
    // range. Five of six, and the sixth is a voice decision rather than an
    // edit to this file.
    expect(performableWith('level')).toHaveLength(5);
    expect(performableWith('level')).not.toContain('hype-reaction');
    expect(performableWith('expressive')).toHaveLength(6);
  });
});

describe('the presets against the four shipped scripts', () => {
  /*
   * `check()` is what stands between a rewrite and the repository, and it has
   * to come back clean on a script that was never rewritten — a check that
   * flags a real script has a false-positive rate of one in one and would be
   * turned off the first time somebody used it. `restyle.test.ts` makes this
   * claim for the checker; this makes it for the six presets that feed it,
   * because a preset whose rules a rewrite cannot satisfy is a preset that
   * only ever produces discarded output.
   */
  const dir = new URL('../../../audio/scripts/', import.meta.url);
  const ids = ['bus1600', 'core2500', 'econ1020', 'psci1104'];

  for (const id of ids) {
    it(`leaves ${id} alone when nothing was changed`, () => {
      const script = JSON.parse(readFileSync(new URL(`${id}.json`, dir), 'utf8'));
      expect(check(script, script)).toEqual([]);
    });
  }

  it('asks every preset for something the scripts can actually carry', () => {
    /*
     * The one rule that is not about wording. `solo-aside` says the second
     * voice does not appear, and a script restyled that way still has to pass
     * `check()`'s speaker rule — so the style is only representable if using
     * one of the two declared voices is allowed. It is; this pins that, because
     * a checker tightened to "every declared voice must be used" would make
     * the preset unshippable without anyone editing the preset.
     */
    const script = JSON.parse(readFileSync(new URL('econ1020.json', dir), 'utf8'));
    const oneVoice = {
      ...script,
      lines: script.lines.map((l: { v: string }) => ({ ...l, v: 'host' })),
    };
    expect(STYLES['solo-aside'].rules[0]).toContain('One speaker');
    expect(check(script, oneVoice)).toEqual([]);
  });
});
