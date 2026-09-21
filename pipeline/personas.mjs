import { pointsAtSomebody } from './likeness.mjs';

/**
 * The recurring characters of the animated series, as structural parameters.
 *
 * Step 4 of `docs/VIDEO_PODCAST_ROADMAP.md` asks for "a recurring host
 * character, or two, appearing across every unit of a course — the visual
 * equivalent of the two-voice podcast", built by generating one character
 * reference sheet per persona and feeding it to an image-to-video model as the
 * reference every later clip has to match.
 *
 * That sheet is the expensive artefact and the one nobody can un-make: every
 * clip of a course is generated against it, so a face chosen carelessly is a
 * face on four courses. This file is what gets chosen, and it is deliberately
 * not a paragraph of free text.
 *
 * ## Why a persona is a set of values rather than a description
 *
 * §7 of the roadmap commits to "no real person's name, voice or likeness in
 * any persona preset or character sheet", and `styles.mjs` already made the
 * same commitment for the hosting styles by describing them structurally. A
 * commitment a file merely *states* is one a `--style "like <somebody>"` walks
 * straight through. So appearance here is a choice from enumerated axes and
 * there is no free-text appearance field to put a name in: a likeness is not
 * refused, it is unrepresentable.
 *
 * `note` survives as free text because lighting and mood have to be sayable,
 * and `check` guards it — see the limits written down there.
 */

/**
 * The axes. A persona picks one value from each.
 *
 * Kept small on purpose. Every axis is a thing an image model will actually
 * act on and a person can actually decide; an axis nobody chooses between is
 * one more field to keep consistent across four courses for nothing.
 *
 * There is no gender axis, and that is a decision rather than an omission. The
 * model will draw somebody either way; fixing it here would be one more thing
 * this file asserts about a person who does not exist, and the artefact that
 * actually holds the character together across every later clip is the sheet
 * itself, not the sentence that asked for it. The sheet is generated once —
 * `clipspend` exists to make sure of that — so nothing downstream re-rolls it.
 */
export const AXES = {
  build: ['slight', 'average', 'broad', 'tall and lean', 'short and round'],
  age: ['late teens', 'twenties', 'thirties', 'forties', 'fifties', 'sixties'],
  /*
   * Every value reads as "with <value> hair", because `describe` puts it
   * there. A value that only works as a noun — "tight coils", "a shaved
   * head" — produces "with tight coils hair", and a prompt that reads like
   * a machine wrote it is a prompt an image model answers like one.
   */
  hair: [
    'closely cropped',
    'short and straight',
    'shoulder-length wavy',
    'tightly coiled',
    'braided',
    'long and loose',
    'buzzed short',
    'grey and swept back',
  ],
  wardrobe: ['open overshirt', 'knit jumper', 'field jacket', 'plain t-shirt', 'collared shirt'],
  carry: ['nothing', 'a notebook', 'a mug', 'a tablet', 'a pen behind one ear'],
  demeanour: ['warm', 'dry', 'brisk', 'patient', 'delighted by the material'],
};

/**
 * The two roles, which are the podcast's two roles.
 *
 * `audio/scripts/*.json` gives every line a speaker of `host` or `expert`, and
 * the documentary's captions already print those. A persona that did not map
 * onto one of them would be a character with no lines.
 */
export const ROLES = ['host', 'expert'];

/**
 * The presets.
 *
 * Two, being one pair — the series has the shape the podcast has. They are
 * drawn as counterparts rather than as two separate people: different builds,
 * different ages, different wardrobes, so that a single frame with both in it
 * reads as two characters and not as one character twice.
 *
 * The names are ordinary given names and nothing else. A given name is not a
 * likeness — every name belongs to real people and none of them is being
 * depicted — but nothing in a persona may *point* at somebody, which is what
 * `check` is for.
 *
 * @type {Record<string, import('./personas.d.mts').Persona>}
 */
export const PERSONAS = {
  'host-nell': {
    name: 'Nell',
    role: 'host',
    label: 'The one asking',
    build: 'slight',
    age: 'twenties',
    hair: 'tightly coiled',
    wardrobe: 'open overshirt',
    carry: 'a notebook',
    demeanour: 'warm',
    accent: 'copper',
    /*
     * The host asks the question a student would actually ask — `styles.mjs`
     * says so of every preset, and the face has to agree with it. A host drawn
     * as authoritative undercuts the format in the first frame.
     */
    note: 'leaning slightly in, mid-question, eyebrows up',
  },

  'expert-arun': {
    name: 'Arun',
    role: 'expert',
    label: 'The one answering',
    build: 'broad',
    age: 'forties',
    hair: 'grey and swept back',
    wardrobe: 'knit jumper',
    carry: 'a mug',
    demeanour: 'patient',
    accent: 'jade',
    note: 'settled, hands open, mid-explanation',
  },
};

/** The preset ids, for a usage line. */
export const PERSONA_IDS = Object.keys(PERSONAS);

/**
 * The panels one reference sheet has to carry.
 *
 * Not decoration: an image-to-video model holds a character together from what
 * it was shown, and a sheet with one front view gives it nothing to go on the
 * moment the character turns their head. Three views fix the face in space and
 * three expressions fix the range the clips will actually need — a question, an
 * answer, and the beat between them.
 *
 * Nine cells, one image. One image rather than nine because the model has to
 * see them as the same person, which is the whole purpose of a sheet.
 */
export const VIEWS = ['front', 'three-quarter', 'profile'];
export const EXPRESSIONS = ['neutral', 'explaining', 'pleased'];

/** Every cell of the sheet, in reading order. */
export function panels() {
  const out = [];
  for (const expression of EXPRESSIONS) {
    for (const view of VIEWS) out.push({ view, expression });
  }
  return out;
}

/**
 * The sentence that describes the character, and only the character.
 *
 * Assembled from the axes in a fixed order so that two runs of the same
 * persona produce the same string — which is what makes `clipKey` able to tell
 * that a sheet has already been bought.
 */
export function describe(persona) {
  return (
    `a ${persona.build} figure in their ${persona.age}, ` +
    `with ${persona.hair} hair, wearing ${an(persona.wardrobe)}` +
    (persona.carry === 'nothing' ? '' : `, holding ${persona.carry}`) +
    `, ${persona.demeanour} in manner`
  );
}

/** "an open overshirt", "a knit jumper". */
function an(noun) {
  return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

/**
 * The prompt a character-sheet image would be generated from.
 *
 * Everything an image model needs and nothing it should improvise: the
 * character, the nine cells, a flat ground so it draws a character rather than
 * a scene, and the instruction that every cell is the same person. The
 * roadmap's whole reason for a sheet is consistency, so the sentence asking
 * for it is not optional.
 */
export function sheetPrompt(persona) {
  const cells = panels()
    .map((p) => `${p.view} view, ${p.expression}`)
    .join('; ');
  return [
    `Character reference sheet, 3 by 3 grid, nine panels: ${cells}.`,
    `The same fictional character in every panel: ${describe(persona)}.`,
    persona.note ? `${persona.note}.` : '',
    'Flat neutral background, even lighting, no scene, no text, no logos.',
    'Consistent face, hair, build and clothing across all nine panels.',
  ]
    .filter(Boolean)
    .join(' ');
}


/**
 * What is wrong with a persona, or an empty list.
 *
 * Two kinds of check, and the second is the one worth explaining.
 *
 * Every axis value must be one the axis offers. That is not type-checking for
 * its own sake: an axis is how this file keeps a likeness unrepresentable, and
 * an axis that silently accepts anything is a free-text field wearing a
 * enumeration's name.
 *
 * `note` is free text, so it gets the two rules that can be enforced on free
 * text. It may not use a construction that *points* at somebody — "like",
 * "in the style of", "-esque" — and it may not contain a capital letter
 * anywhere but the first character. The second rule is the blunt one and it is
 * the one that works: a name is capitalised and "leaning slightly in,
 * mid-question" has no reason to be.
 *
 * ## What this does not catch
 *
 * A description with no capitals and no referential construction: "the
 * presenter from that children's science programme with the bus". Nothing in a
 * regular expression is going to catch that, and saying so is better than
 * implying the check is complete. What limits the damage is the shape of the
 * file rather than this function — `note` can only modulate a character the
 * axes have already fixed, and it is one line in a prompt that is otherwise
 * assembled from enumerated values. The sheet is also the one artefact a
 * person looks at before any clip is generated from it, which is why
 * `video/src/Persona.tsx` exists.
 */
export function check(persona) {
  const problems = [];

  if (!ROLES.includes(persona.role)) {
    problems.push(`role "${persona.role}" is not one of ${ROLES.join(', ')}`);
  }
  if (!persona.name || !/^[A-Z][a-z]+$/.test(persona.name)) {
    problems.push(`name "${persona.name ?? ''}" should be one ordinary capitalised given name`);
  }

  for (const [axis, allowed] of Object.entries(AXES)) {
    const chosen = persona[axis];
    if (!allowed.includes(chosen)) {
      problems.push(`${axis} "${chosen ?? ''}" is not one of: ${allowed.join(', ')}`);
    }
  }

  const note = persona.note ?? '';
  const points = pointsAtSomebody(note);
  if (points) {
    problems.push(`note points at somebody ("${points}") — describe, do not compare`);
  }
  const capital = note.slice(1).match(/[A-Z]/);
  if (capital) {
    problems.push(`note has a capital "${capital[0]}" in it — an appearance note needs no proper nouns`);
  }

  return problems;
}

/**
 * The job a sheet would be, in the shape `video/src/clipspend.ts` records.
 *
 * `seconds: 0` because a sheet is a still, and that is also how the manifest
 * tells a still from a clip when it prices a run.
 */
export function sheetJob(id, persona, provider, model) {
  return {
    slot: `persona/${id}`,
    prompt: sheetPrompt(persona),
    seconds: 0,
    provider,
    model,
  };
}
