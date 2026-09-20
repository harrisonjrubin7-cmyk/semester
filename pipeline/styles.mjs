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
 * can argue with. Nothing here is a person, a show, or a voice.
 */

/** @typedef {{label: string, blurb: string, rules: string[]}} Style */

/** @type {Record<string, Style>} */
export const STYLES = {
  'curious-duo': {
    label: 'Long-form curious duo',
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
};

/** The preset ids, for a usage line or an `--all-styles` run. */
export const STYLE_IDS = Object.keys(STYLES);

/**
 * Three, not six.
 *
 * The rollout says to prove the rewrite pass before building all six presets,
 * and these three are the ones closest to what `make-script.mjs` already
 * produces — so a bad result is the *pass* failing rather than the preset
 * asking for something the source material cannot support. The remaining
 * three (high-energy reaction, reflective narrative, direct-to-camera) lean on
 * prosody Piper does not really do, and the roadmap budgets a paid expressive
 * voice for exactly those. Adding them before that decision is made would be
 * writing presets for a renderer that cannot perform them.
 */
export const NOT_YET = ['hype-reaction', 'reflective-narrative', 'grwm-short'];
