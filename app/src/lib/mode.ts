import { DESTINATIONS } from './nav';

/**
 * Which of three questions somebody just asked.
 *
 * `ask` used to be scoped to one course and to answer only about it, which
 * meant that "explain price elasticity" arrived at a screen that first wanted
 * to know which course, and "where do I set my grade scale" got answered out
 * of a study guide that has nothing to say about it. Both are ordinary things
 * to type into a box in a study app.
 *
 * So there are three modes and the student picks none of them:
 *
 * - **App** — a question about this app. Answered from the registry and the
 *   generated guide, with no network call at all.
 * - **Grounded** — a question about this student's own data. Answered from
 *   state, with what it used cited.
 * - **General** — everything else. Explanations, concepts, code, writing,
 *   advice. Answered directly and well, with the app's context available but
 *   not imposed.
 *
 * The default is General, and that matters: the failure to avoid is a study
 * app that answers "how do photosynthesis and respiration differ" with "I can
 * only help with your courses". Grounded and App have to be *recognised*;
 * everything else is simply answered.
 */

export type Mode = 'app' | 'grounded' | 'general';

export interface Read {
  mode: Mode;
  /** Shown next to the answer: "Using: your courses". Never a mystery. */
  says: string;
  /** What in the question decided it, for the same reason a quote is shown. */
  because: string;
  /** Screens the question seems to be about, when it is about the app. */
  screens: string[];
}

/**
 * Things that are only ever about this app.
 *
 * Deliberately about the app's own furniture — screens, settings, gestures —
 * rather than about study. "Where is my grade scale" is an app question;
 * "what is my grade" is a question about the student's data.
 */
const APP_SHAPE = [
  /*
   * A verb list rather than a bare "how do I".
   *
   * The first version matched `(where|how) (do|can|would) i`, which is the
   * opening of almost every question anybody asks — so "how do I revise for a
   * closed-book exam" and "how do I write a cover letter" both came back as
   * questions about the app, because "exam" and "letter" are registry words.
   * These are the verbs that only mean operating something.
   */
  /\b(where|how)\s+(do|can|would)\s+i\s+(set|change|turn|find|add|import|export|delete|undo|enable|disable|switch|move|rename|open|reach|get\s+to)\b/i,
  /\bwhat\s+does\s+(the|this)\s+.{0,30}\b(screen|button|setting|tab|toggle|switch)\b/i,
  /\b(this app|the app|semester)\b.{0,40}\b(do|does|work|support|have)\b/i,
  /\bwhere\s+(is|are)\s+(the|my)\s+.{0,24}\b(screen|setting|button|tab|page)\b/i,
  /\b(keyboard )?shortcut/i,
];

/** Words that mean the answer has to come from this student's own records. */
const MINE = [
  /\bmy\b/i,
  /\bi\s+(have|need|owe|missed|am)\b/i,
  /\bwhat('| i)s due\b/i,
  /\bam i\b/i,
  /\bhow many\b.{0,30}\b(left|absences|days|do i)\b/i,
  /\b(due|deadline)s?\b.{0,20}\b(today|tomorrow|this week|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bhow\s+am\s+i\s+doing\b/i,
  /\bwhere\s+do\s+i\s+stand\b/i,
];

/** Every word the registry uses to describe a screen, lower-cased. */
const REGISTRY_WORDS = (() => {
  const words = new Map<string, string[]>();
  for (const d of DESTINATIONS) {
    for (const w of `${d.label} ${d.keywords}`.toLowerCase().split(/\s+/)) {
      if (w.length < 4) continue;
      const screens = words.get(w) ?? [];
      if (!screens.includes(d.screen)) screens.push(d.screen);
      words.set(w, screens);
    }
  }
  return words;
})();

/**
 * Which screens a question seems to be about.
 *
 * Only words the registry itself uses, so this can never name a screen that
 * does not exist — the same rule the guide is held to. A word shared by more
 * than four screens is furniture rather than a signal and is skipped.
 */
function screensFor(question: string): string[] {
  const hits = new Map<string, number>();
  for (const raw of question.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length < 4) continue;
    const screens = REGISTRY_WORDS.get(raw);
    if (!screens || screens.length > 4) continue;
    for (const s of screens) hits.set(s, (hits.get(s) ?? 0) + 1);
  }
  return [...hits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => s);
}

export function readMode(question: string): Read {
  const q = question.trim();
  if (!q) return { mode: 'general', says: 'General', because: '', screens: [] };

  const mine = MINE.find((re) => re.test(q));
  const appish = APP_SHAPE.find((re) => re.test(q));
  const screens = screensFor(q);

  /*
   * App is checked first, and that ordering is the interesting part.
   *
   * "Where do I set my grade scale" contains "my" and is not a question about
   * the student's grades — it is a question about a setting. Checking data
   * first would send it to the wrong mode. It works because the app shape is
   * now narrow enough that a genuine data question ("how many absences do I
   * have left") does not match it at all.
   *
   * Both halves are still required: a shape that means operating something,
   * and something in the registry it could be about.
   */
  if (appish && screens.length > 0) {
    return {
      mode: 'app',
      says: 'Using: this app',
      because: (appish.exec(q)?.[0] ?? '').trim(),
      screens,
    };
  }

  if (mine) {
    return {
      mode: 'grounded',
      says: 'Using: your courses',
      because: (mine.exec(q)?.[0] ?? '').trim(),
      screens,
    };
  }

  /*
   * Everything else, which is most things and is meant to be.
   *
   * A study app that will not explain a concept because the concept is not in
   * a syllabus it has read is a worse tool than a blank text box.
   */
  return { mode: 'general', says: 'General', because: '', screens };
}
