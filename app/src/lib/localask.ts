import type { Destination } from './nav';
import { build as guidebook } from './guidebook';
import type { Screen } from './types';

/**
 * What the app can say about itself with no network at all.
 *
 * "Where do I set my grade scale" has an answer this app already holds: the
 * registry knows the screen exists, what it is called and what it is for, and
 * the generated guide describes it. Sending that to a model is a wait, a cost
 * and a dependency on a connection, for something already on the device.
 *
 * It is also the case most worth having offline. A student on a train with no
 * signal, or one who has never set up a key, is exactly the person asking
 * where a setting lives; a study app that cannot describe itself without an
 * internet connection has its dependency in the wrong place.
 *
 * ## Matches, not an answer
 *
 * The first version of this composed a paragraph — "**Grades** — what you have
 * so far…" — read as a definite answer, and was wrong often enough to matter.
 * "How do I export a guide as a PDF" shares the word *guide* with Add a
 * reading's keywords and confidently named that screen. A student has no
 * reason to doubt an app describing itself, which makes a confident wrong
 * answer here worse than no answer at all.
 *
 * So this returns *candidates*, ranked, and the screen shows them as what
 * they are: the screens whose own description matches, and the lines of the
 * generated guide that mention what was asked. Three plausible screens with
 * their real blurbs is useful even when the ranking is imperfect, because the
 * reader is doing the last step rather than trusting a claim.
 *
 * ## "A screen that does not exist" was the wrong safety property
 *
 * This file used to say: *everything here comes from the registry and the
 * generated guide, so it can never name a screen that does not exist.* True,
 * and beside the point. The registry is every screen the app has ever had —
 * before `allowed` has asked what this school has and before `forRole` has
 * asked who is holding the phone. A screen can exist in the app and not exist
 * *for the person typing*, and naming one of those is the same failure.
 *
 * `lib/find.ts` already knew. Search gates on both, and says why:
 *
 * > search was the leak that would have let somebody reach a meal-plan screen
 * > their university does not have, and a role is the same kind of hole — a
 * > professor typing "housing" should not be offered a dorm screen the
 * > directory has already stopped showing them.
 *
 * That is this question, typed into a different box. So the pool is a
 * required parameter here too, and this file no longer imports the registry.
 */

export interface Match {
  screen: Screen;
  label: string;
  blurb: string;
  group: string;
  score: number;
}

export interface Local {
  matches: Match[];
  /** Lines of the generated guide that mention what was asked. Quoted, not written. */
  fromGuide: string[];
}

/** Words too common to mean anything. Registry blurbs are full of them. */
const NOISE = new Set([
  'what', 'where', 'when', 'which', 'does', 'this', 'that', 'with', 'from',
  'your', 'have', 'here', 'there', 'they', 'them', 'then', 'than', 'into',
  'about', 'app', 'the', 'and', 'for', 'you', 'can', 'how', 'why', 'the',
  'screen', 'button', 'setting', 'settings', 'tab', 'page', 'find', 'get',
  'use', 'see', 'want', 'need', 'apps',
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !NOISE.has(w));
}

/**
 * Whether two words are the same word.
 *
 * Prefix matching from four characters, which is enough for the plurals and
 * verb endings that actually come up — grade/grades, timer/timers,
 * import/importing, export/exported. Not a stemmer: a stemmer would be a
 * dependency and a source of surprises, and the failure this fixes is
 * entirely "the question said *grade* and the label says *Grades*".
 */
function same(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.startsWith(short) && long.length - short.length <= 3;
}

function hitsIn(asked: string[], field: string): number {
  const have = words(field);
  return asked.filter((w) => have.some((h) => same(w, h))).length;
}

/**
 * How well a question matches one destination.
 *
 * The label counts triple and the keywords double, because the keyword list
 * exists for exactly this — somebody typing the word they would use rather
 * than the word on the tab. The blurb counts once: it is prose, and prose
 * shares words with everything.
 */
function scoreOf(asked: string[], d: Destination): number {
  const label = hitsIn(asked, d.label);
  const keys = hitsIn(asked, d.keywords);
  const blurb = hitsIn(asked, d.blurb);
  // Each question word counts once, at its best weight, so a word appearing
  // in all three fields is not three matches.
  const score = label * 3 + Math.max(0, keys - label) * 2 + Math.max(0, blurb - Math.max(keys, label));
  return asked.length === 0 ? 0 : score / asked.length;
}

/**
 * The sections of the guide that describe how the app is operated.
 *
 * Not "What this is", which is an introduction — answering "where is my grade
 * scale" with the app's mission statement would be worse than saying nothing.
 */
const OPERATING = ['screens', 'settings', 'keys', 'wrong', 'first'];

/**
 * Lines of the guide that mention what was asked, quoted as they stand.
 *
 * Two hits rather than one, because one word in common is a coincidence — the
 * same rule the ranking needs and for the same reason. Nothing here is
 * rewritten: these are the guide's own sentences, which is what makes them
 * safe to show without a model having checked them.
 *
 * ## And the quoting needs the same gate as the ranking
 *
 * The guidebook is a *manual*: `lib/guidebook.ts` documents all fifty-eight
 * screens on purpose, its own self-check asserts one entry per registry row,
 * and the app-mode system prompt is right to carry the lot — "can this app do
 * X" is a question about the app. Quoting a line of it at somebody is not the
 * same act. Gating the ranking and not this left the leak exactly where it
 * was, one field along in the same return value: *"where is the meal plan"*
 * kept answering **"Open it when you are thinking about meal, meals, plan."**,
 * and *"housing move out date"* kept answering **"Your room, and the move-out
 * date counted from your last exam rather than left as a rule."**
 *
 * The **Every screen** section is one block per registry row, headed
 * `### <label>`, so a block belonging to a screen this person does not have
 * is dropped whole. Every other operating section — settings, shortcuts, what
 * to do when something is wrong, getting started — is not per-screen and is
 * left alone: measured, no settings row is gated by school or role, so there
 * is nothing there to filter.
 */
function guideLines(asked: string[], pool: Destination[]): string[] {
  const book = guidebook();
  const mine = new Set(pool.map((d) => d.label));
  const found: { line: string; hits: number }[] = [];
  for (const sec of book.sections) {
    if (!OPERATING.includes(sec.id)) continue;
    // Blocks, not lines, for the per-screen section: a heading names the
    // screen its following lines are about, and a line on its own does not.
    const blocks = sec.id === 'screens' ? sec.body.split('\n\n') : [sec.body];
    for (const block of blocks) {
      if (sec.id === 'screens') {
        const head = /^### (.+)$/m.exec(block)?.[1]?.trim();
        if (head && !mine.has(head)) continue;
      }
      for (const line of block.split('\n')) {
        const text = line.trim();
        if (text.length < 30) continue;
        const hits = hitsIn(asked, text);
        if (hits >= 2) found.push({ line: text, hits });
      }
    }
  }
  return found
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map((f) => f.line);
}

/**
 * What this app can say about a question about itself, offline.
 *
 * Returns null when nothing matched well enough to be worth showing — which
 * is a real outcome and not a failure. The screen asks the model then,
 * exactly as it did before.
 */
export function answerLocally(question: string, pool: Destination[]): Local | null {
  const asked = words(question);
  if (asked.length === 0) return null;

  const matches = pool.map((d) => ({
    screen: d.screen,
    label: d.label,
    blurb: d.blurb,
    group: d.group as string,
    score: scoreOf(asked, d),
  }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  /*
   * Drop anything far below the best match.
   *
   * Three rows of equal weight read as three equally good answers. "Where is
   * the meal plan" matched Meal plan at 3.0 and Today at 1.0, because Today's
   * blurb happens to contain the word *plan* — showing those side by side
   * makes the strong match look like a guess. Two-fifths is the line: near
   * ties stay, because a genuine tie is worth showing as one.
   */
  const best = matches[0]?.score ?? 0;
  const kept = matches.filter((m) => m.score >= best * 0.4);

  const fromGuide = guideLines(asked, pool);
  // Nothing to show is nothing to show. A panel saying "no matches" where the
  // model would have answered is strictly worse than the model answering.
  if (kept.length === 0 && fromGuide.length === 0) return null;
  return { matches: kept, fromGuide };
}
