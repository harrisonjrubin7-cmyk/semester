import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe as group, expect, it } from 'vitest';
import {
  AXES,
  check,
  describe,
  EXPRESSIONS,
  panels,
  PERSONA_IDS,
  PERSONAS,
  ROLES,
  sheetJob,
  sheetPrompt,
  VIEWS,
  type Persona,
} from '../../../pipeline/personas.mjs';
import { clipKey } from '../../../video/src/clipspend';
import { ACCENTS } from './look';
import { isEpisodeScript } from './episodes';

/**
 * The recurring characters of the animated series.
 *
 * A character reference sheet is the one artefact of step 4 that cannot be
 * walked back: every clip of a course is generated against it, so the sheet
 * decides what four courses look like. §7 of the roadmap puts one rule on it —
 * "no real person's name, voice or likeness in any persona preset or character
 * sheet" — and a rule a document merely states is one a `--style "like
 * <somebody>"` walks straight through.
 *
 * So `pipeline/personas.mjs` makes appearance a choice from enumerated axes,
 * and this is what makes that structural rather than aspirational. The guard
 * lives here because the module is pure and this is where CI runs — the
 * arrangement `restyle.test.ts` and `align.test.ts` already use.
 */

const SCRIPTS = join('..', 'audio', 'scripts');

const persona = (over: Partial<Persona> = {}): Persona => ({
  ...PERSONAS['host-nell'],
  ...over,
});

group('the presets, as committed', () => {
  it('has one for each side of the conversation', () => {
    const roles = PERSONA_IDS.map((id) => PERSONAS[id].role).sort();
    expect(roles).toEqual([...ROLES].sort());
  });

  it('passes its own check', () => {
    // Including the notes. A preset edited by hand gets the same reading as
    // an argument typed at a terminal, which is the only version of this rule
    // that survives somebody being in a hurry.
    for (const id of PERSONA_IDS) expect(check(PERSONAS[id]), id).toEqual([]);
  });

  it('draws the two as counterparts rather than as the same person twice', () => {
    /*
     * A frame with both in it has to read as two characters. Build, age and
     * wardrobe are the three an image model acts on most directly, so they
     * are the three that have to differ.
     */
    const [a, b] = PERSONA_IDS.map((id) => PERSONAS[id]);
    for (const axis of ['build', 'age', 'wardrobe'] as const) {
      expect(a[axis], axis).not.toBe(b[axis]);
    }
  });

  it('spends an accent the app actually has', () => {
    // `tokensFor` resolves these in `video/src/Persona.tsx`. An id that is not
    // on the ramp is a persona whose colour was never contrast-audited —
    // `lib/contrast.test.ts` walks the ones that were.
    const ids = ACCENTS.map((a) => a.id);
    for (const id of PERSONA_IDS) expect(ids, id).toContain(PERSONAS[id].accent);
  });

  it('covers every speaker the four shipped scripts actually use', () => {
    /*
     * Read out of the scripts rather than restated. The series is the visual
     * form of the podcast, so a script that introduced a third speaker would
     * be a script with a character nobody had drawn — and the failure would
     * be an unlabelled figure in a rendered video, not an error.
     */
    const spoken = new Set<string>();
    for (const name of readdirSync(SCRIPTS).filter(isEpisodeScript)) {
      const script = JSON.parse(readFileSync(join(SCRIPTS, name), 'utf8'));
      for (const line of script.lines) spoken.add(line.v);
    }
    expect(spoken.size).toBeGreaterThan(0);
    const covered = new Set(PERSONA_IDS.map((id) => PERSONAS[id].role));
    expect([...spoken].sort()).toEqual([...covered].sort());
  });
});

group('what a persona is allowed to be', () => {
  it('refuses a value the axis does not offer', () => {
    // The axes are the mechanism, not decoration. An axis that quietly
    // accepts anything is a free-text appearance field with an enumeration's
    // name on it, and a free-text appearance field is where a likeness goes.
    expect(check(persona({ build: 'exactly like the man off the television' }))).toEqual([
      expect.stringContaining('build'),
    ]);
    expect(check(persona({ hair: undefined as unknown as string }))).toEqual([
      expect.stringContaining('hair'),
    ]);
  });

  it('refuses a role the scripts do not have', () => {
    expect(check(persona({ role: 'narrator' }))[0]).toContain('role');
  });

  it('refuses a note that points at somebody rather than describing', () => {
    for (const note of [
      'like the one off that programme',
      'in the style of a famous presenter',
      'modelled on a broadcaster',
      'based on a real tutor',
      'inspired by a documentary host',
      'a presenter-esque manner',
      'newsreader-like posture',
      'the energy of a chat show',
    ]) {
      expect(check(persona({ note })), note).toEqual([expect.stringContaining('points at somebody')]);
    }
  });

  it('refuses a capital letter anywhere but the first, which is the rule that works', () => {
    /*
     * The blunt one, and the one that catches a bare name — "ms frizzle
     * energy" has no "like" in it and a real attempt would be capitalised.
     * An appearance note has no reason to contain a proper noun, so the rule
     * costs nothing it should not cost.
     */
    expect(check(persona({ note: 'warm light, a bit like Tuesday' })).length).toBe(2);
    expect(check(persona({ note: 'standing under a Klieg lamp' }))).toEqual([
      expect.stringContaining('capital'),
    ]);
    // …and the first character may be one, so a note can start a sentence.
    expect(check(persona({ note: 'Low afternoon light, shoulders relaxed' }))).toEqual([]);
  });

  it('accepts the notes somebody would actually write', () => {
    for (const note of [
      'low afternoon light, shoulders relaxed',
      'leaning slightly in, mid-question, eyebrows up',
      'seated, three-quarter turn, hands visible',
      '',
    ]) {
      expect(check(persona({ note })), note).toEqual([]);
    }
  });

  it('wants one ordinary given name and nothing more', () => {
    expect(check(persona({ name: 'Nell' }))).toEqual([]);
    expect(check(persona({ name: 'nell' }))[0]).toContain('name');
    expect(check(persona({ name: 'Nell Of The Television' }))[0]).toContain('name');
  });
});

group('the sentence handed to an image model', () => {
  it('reads as English for every value of every axis', () => {
    /*
     * Not style policing. `describe` puts the wardrobe behind an article and
     * the hair in front of the word "hair", so a value chosen to read as a
     * noun — "tight coils", "an open overshirt" — comes out as "with tight
     * coils hair" or "wearing a open overshirt". A prompt that reads like a
     * machine wrote it is one an image model answers like a machine.
     */
    for (const hair of AXES.hair) {
      expect(describe(persona({ hair })), hair).toContain(`with ${hair} hair`);
    }
    for (const wardrobe of AXES.wardrobe) {
      const article = /^[aeiou]/i.test(wardrobe) ? 'an' : 'a';
      expect(describe(persona({ wardrobe })), wardrobe).toContain(`wearing ${article} ${wardrobe}`);
    }
    for (const age of AXES.age) {
      expect(describe(persona({ age })), age).toContain(`in their ${age}`);
    }
  });

  it('says "holding" only when there is something to hold', () => {
    expect(describe(persona({ carry: 'a mug' }))).toContain('holding a mug');
    expect(describe(persona({ carry: 'nothing' }))).not.toContain('holding');
  });

  it('asks for all nine panels and for one person in them', () => {
    const prompt = sheetPrompt(PERSONAS['host-nell']);
    expect(panels()).toHaveLength(VIEWS.length * EXPRESSIONS.length);
    for (const p of panels()) expect(prompt).toContain(`${p.view} view, ${p.expression}`);
    // The consistency sentence is the reason a sheet exists at all. A sheet
    // whose nine panels are nine people is nine wasted panels.
    expect(prompt).toMatch(/same fictional character in every panel/i);
    expect(prompt).toMatch(/consistent face, hair, build and clothing/i);
  });

  it('says the same thing twice, so a bought sheet is not bought again', () => {
    expect(sheetPrompt(PERSONAS['host-nell'])).toBe(sheetPrompt(PERSONAS['host-nell']));
  });
});

group('what buying one would be recorded as', () => {
  const job = (id: string) => sheetJob(id, PERSONAS[id], 'someprovider', 'somemodel');

  it('is a still, which is how the manifest knows to price it per image', () => {
    expect(job('host-nell').seconds).toBe(0);
    expect(job('host-nell').slot).toBe('persona/host-nell');
  });

  it('keys on the persona, so an unchanged one is never re-bought', () => {
    expect(clipKey(job('host-nell'))).toBe(clipKey(job('host-nell')));
    expect(clipKey(job('host-nell'))).not.toBe(clipKey(job('expert-arun')));
  });

  it('re-buys a persona whose appearance was edited, and only that one', () => {
    const before = clipKey(job('host-nell'));
    const after = clipKey(
      sheetJob('host-nell', persona({ hair: 'braided' }), 'someprovider', 'somemodel'),
    );
    expect(after).not.toBe(before);
    expect(clipKey(job('expert-arun'))).not.toBe(after);
  });
});
