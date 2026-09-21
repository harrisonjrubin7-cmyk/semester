/**
 * Hosting styles, as structural parameters.
 *
 * Six podcast formats were named as tone references when this was planned.
 * None of them is named here, and that is deliberate rather than squeamish:
 * what makes a format work is its *structure* — how often the host takes a
 * turn, whether a tangent returns, whether the expert is challenged or
 * received — and structure is what transfers to a new host talking about
 * supply curves. A catchphrase does not. `docs/VIDEO_PODCAST_ROADMAP.md` §7
 * makes the same commitment, and it is also the version that survives a
 * platform-policy or legal review without a rewrite.
 *
 * Each preset is a set of instructions a rewrite pass can follow and a reader
 * can argue with. Nothing here is a person, a show, or a voice — and that is
 * now checked rather than asserted: `styles.test.ts` runs every blurb and
 * every rule through `likeness.mjs`, the same rule `personas.mjs` puts on an
 * appearance note and `broll.mjs` on a shot subject.
 *
 * ## `voice`, and the three that were held back
 *
 * Three of these shipped and three did not, on the argument that they "lean on
 * prosody Piper does not really do" and that adding them would be "writing
 * presets for a renderer that cannot perform them". That is one true statement
 * doing duty for three presets, and it only holds for one of them:
 *
 * - **reflective** wants a level, unhurried read, which is what Piper is
 *   *best* at. Holding it back was the weakest case of the three.
 * - **solo-aside** wants a conversational register, not a wider range.
 * - **hype-reaction** genuinely needs the range. A hype script read flat is
 *   worse than a neutral one read flat, because the words promise an energy
 *   the voice does not deliver.
 *
 * So the objection is a property of a preset rather than a reason to withhold
 * it, and it is written down as one. `voice` is `level` or `expressive`;
 * `restyle-script.mjs` says which before it spends anything, and the
 * expressive one is the only thing in this file waiting on a paid voice.
 */

/** @typedef {{label: string, blurb: string, rules: string[]}} Style */

/** @type {Record<string, Style>} */
export const STYLES = {
  'curious-duo': {
    label: 'Long-form curious duo',
    voice: 'level',
    blurb:
      'The host asks broad, deliberately naive questions; the expert answers at ' +
      'length and is rarely interrupted.',
    rules: [
      'The host asks the question a student would actually ask, in plain words, and then stops talking.',
      'The expert answers in full before the host speaks again. Do not interleave agreement noises.',
      'Every third or fourth exchange, the host asks a follow-up that comes from the answer just given rather than from the script order — "wait, does that mean…" — and the expert answers it before the next card.',
      'Sentences run long. Subordinate clauses are fine. This is the one style where a forty-word sentence is right.',
      'The host never explains anything. If the host knows the answer, the format is broken.',
    ],
  },

  storyteller: {
    label: 'Storyteller',
    voice: 'level',
    blurb:
      'Homespun analogy and small concrete anecdotes carry dry material. ' +
      'Informal register.',
    rules: [
      'Open each answer with a concrete image or a small everyday situation, then name the concept it illustrates.',
      'Prefer a specific noun to a general one: "a food truck" rather than "a firm", "the queue outside" rather than "excess demand".',
      'Short sentences. Often very short. Then one longer one that lands the point.',
      'The analogy must be *about* the mechanism, not decoration attached to it. If the analogy could be swapped for any other without changing the explanation, it is decoration.',
      'The host reacts as a person, not as an interviewer: "oh, so it is the queue that does the work."',
    ],
  },

  'pushback-debate': {
    label: 'Pushback duo',
    voice: 'level',
    blurb:
      'The host plays devil’s advocate and makes the expert defend each claim. ' +
      'Productive friction.',
    rules: [
      'The host receives no claim without testing it once: "that only works if…", "says who?", "what would break that?"',
      'The expert answers the objection directly before moving on, and concedes where the objection is fair.',
      'The pushback must be a real objection a student would have, not a strawman the expert demolishes in a sentence.',
      'Turns are short and alternate quickly. Neither speaker holds the floor for long.',
      'End each card with the claim restated in the form it survived in — this is the active-recall payoff of the format.',
    ],
  },

  'hype-reaction': {
    label: 'Reaction duo',
    voice: 'expressive',
    blurb:
      'Big reactions to the facts that deserve one. Short turns, the surprising ' +
      'half first.',
    rules: [
      'Put the surprising half of a fact first and the explanation second: "Thirty percent. One exam. That is nearly a third of the grade on one morning."',
      'Turns are a sentence or two and they alternate. Neither speaker holds the floor for a paragraph.',
      'The host reacts before they understand, then asks. The expert answers in one breath and does not preamble.',
      'React to the material, never to the other speaker: "wait, thirty percent?" is the format, "great question" is not.',
      'No exclamation the fact has not earned. The energy comes from what is genuinely surprising, so an ordinary fact is said plainly and left alone — a script that is loud about everything is loud about nothing.',
    ],
  },

  reflective: {
    label: 'Reflective narrative',
    voice: 'level',
    blurb:
      'First person, unhurried. Why somebody would want to know this, before ' +
      'what it is.',
    rules: [
      'Open each chapter with the reason somebody would want to know it, in the first person, before any definition arrives.',
      'One speaker carries the thought and the other comes in to agree, extend, or go quiet — never to test it. This is the one style with no friction in it.',
      'Sentences are level and complete. No rhetorical questions, no cliffhanger at a chapter break.',
      'Say what is hard about the material where it is hard. "This is the part I had to do twice" does more work than "this is straightforward", and it is the only place in these presets where the speaker is allowed to be uncertain.',
      'End a chapter on the idea rather than on a transition. The next chapter can start itself.',
    ],
  },

  'solo-aside': {
    label: 'Solo, direct address',
    voice: 'level',
    blurb: 'One voice, talking to the listener, thinking out loud in asides.',
    rules: [
      'One speaker for the whole script. The second voice does not appear at all.',
      'Address the listener directly and in the second person: "you will get this wrong once" rather than "students often get this wrong".',
      'The aside is the format: break off a definition to say what it is actually for, then return to it inside the same turn.',
      'Short sentences, and fragments where a person would use one. A list is spoken as a list.',
      'No recap at the end of a chapter. Direct address does not summarise, it stops.',
    ],
  },
};

/** The preset ids, for a usage line or an `--all-styles` run. */
export const STYLE_IDS = Object.keys(STYLES);

/** The voice each preset needs, as `voice` names them. */
export const VOICES = ['level', 'expressive'];

/**
 * The presets a level voice can perform today.
 *
 * `audio/synth.py` speaks with Piper, which reads evenly and well and does not
 * do range. Five of the six are written for that; `hype-reaction` is not, and
 * rendering it with Piper would produce a script whose words are excited and
 * whose delivery is not — which reads as a mistake rather than as a style.
 *
 * This replaces a `NOT_YET` list that named three presets and gave one reason
 * covering all of them. A preset held back by a list is held back invisibly;
 * one that declares what it needs can be written, reviewed and argued with
 * now, and turned on by a voice decision rather than by an edit here.
 */
export function performableWith(voice) {
  return STYLE_IDS.filter((id) => STYLES[id].voice === 'level' || STYLES[id].voice === voice);
}
