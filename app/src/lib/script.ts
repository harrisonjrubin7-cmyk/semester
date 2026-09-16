/**
 * The podcast a course has not recorded yet, written out of its own guide.
 *
 * Four courses ship with editions in `audio/scripts/`, rendered to MP3 by
 * `audio/synth.py` with exact chapter marks. A course somebody generates from
 * their own syllabus gets none of that, and it is not a near miss — it is
 * nothing: `lib/generate.ts` says in as many words that "figures, examples and
 * audio belong to a course built by hand", so Listen opens on "Not recorded
 * yet" and a blurb, for every course but those four, forever.
 *
 * `pipeline/make-script.mjs` has been able to draft one since it was written.
 * It runs in this repository, over a course's TypeScript source, for somebody
 * with a checkout — which is the same shape of gap the Draw screen had before
 * a drawing could be kept: the capability existed on the wrong side of the app
 * boundary.
 *
 * ## The script and the transcript are one document
 *
 * `lib/transcript.ts` makes the point about the four recorded courses — "the
 * recording and the transcript are the same document; only one of them had
 * been shown to anybody" — and it is the reason this file is small. Building
 * the script *is* building the transcript. There is one pass here and two
 * readings of its result, the arrangement `lib/live.ts` settled on for figures
 * after two functions deciding the same thing disagreed: an {@link Episode},
 * which is the running order with a chapter per unit, and a {@link Transcript},
 * which is the same chapters with the words in them. They cannot drift because
 * there is nothing to drift.
 *
 * ## It claims no timings, because it has none
 *
 * A recorded edition's chapters carry the second each one starts at, and those
 * are exact — the synthesiser knows where it put every line. A script has no
 * such thing. Estimating "04:12" from a word count and printing it in the
 * typeface the real chapter marks use would be the failure `lib/where.ts` is
 * about: two kinds of claim, one indistinguishable from the other. So the
 * chapter column carries the chapter's *number*, `s` is zero, and the screen's
 * existing `episode.ready` gate already stops anything trying to seek.
 *
 * The one duration it does state is a **reading** time, said as one — "18 min
 * read" — because that is a fact about text and this is text.
 *
 * ## Nothing here writes anything the guide does not say
 *
 * Every line is a card's question or a card's answer, spoken. There is no
 * summarising, no bridging sentence with a claim in it, and no model call —
 * which also means no key, no wait, and no cost. The opening and the closing
 * are the only written lines, and they say only what is countable: the code,
 * how many units, and that the self-test is at the end.
 *
 * That is deliberately less than `pipeline/make-script.mjs` aims at. It emits
 * `TODO — rewrite this opening by hand` for a person to replace before the
 * episode is rendered. A TODO is the right output for a drafting tool with an
 * author downstream and the wrong thing to put in front of a student, so this
 * writes the plain version instead of a placeholder for a better one.
 */

import type { Chapter, Episode, Guide, StudyCard } from './types';
import type { Said, Transcript, TranscriptChapter } from './transcript';

/**
 * The id a derived script takes, and the suffix that identifies one.
 *
 * `-podcast` is what `hasTranscript` looks for on a recorded edition, so a
 * derived one needs a suffix of its own: the two are answered from different
 * places and confusing them would serve a generated course's script as though
 * it were a recording's transcript.
 */
export const SCRIPT_SUFFIX = '-script';

export function scriptEpisodeId(courseId: string): string {
  return `${courseId}${SCRIPT_SUFFIX}`;
}

export function isScriptEpisode(episodeId: string): boolean {
  return episodeId.endsWith(SCRIPT_SUFFIX);
}

/**
 * Prose turned into something a voice can say.
 *
 * A synthesiser reads `%` and `≈` badly or not at all, and a listener cannot
 * see a formula — so the shipped scripts spell them out, and this does the
 * same mechanical part so a derived script is speakable the day it is
 * rendered rather than needing a second pass first.
 *
 * ## Superscripts are a run, not a character each
 *
 * `6.022 × 10²³` is the number this had to get right, and the first version
 * got it wrong in the way that is hardest to notice: it replaced `²` with
 * " squared" wherever it stood, so the line read "6.022 times 10 squared³"
 * — the exponent silently cut in half and the rest left as a glyph a voice
 * cannot say. It was found by looking at the rendered screen, which is the
 * only place it was visible; the tests all passed.
 *
 * So a run of two or more superscripts is read as one exponent, and a lone
 * one keeps the friendly English form. The rule it replaced, `\br²`, could
 * never fire at all — the bare `²` substitution above it had already consumed
 * every `²` in the string — which is worth saying because it looked like
 * coverage for exactly the case that was broken.
 *
 * It is applied to the on-screen transcript too, and that is a real trade
 * rather than an oversight: "20 percent" is slightly worse to read than
 * "20%". It is done anyway because the alternative is two texts for one
 * document — the words you read and the words that get spoken, drifting from
 * the first edit onwards — which is exactly what this file exists not to do.
 * The four shipped transcripts read this way for the same reason.
 *
 * ## There are two copies of this list, and a test holds them together
 *
 * The other is `speakable` in `pipeline/make-script.mjs`. It cannot import
 * this one: the pipeline is deliberately dependency-free Node with no build
 * step, and it reads the app's TypeScript as *text* rather than importing it.
 * So `script.test.ts` reads the substitutions back out of that file and fails
 * when the two lists disagree — the arrangement `functions.test.ts` uses to
 * hold the spreadsheet's catalogue to its engine.
 */
export function speakable(text: string): string {
  return text
    .replace(/(\d)\s*%/g, '$1 percent')
    .replace(/\|ε\||\|E\|/g, 'the absolute value of elasticity')
    .replace(/≈/g, ' about ')
    .replace(/≠/g, ' is not equal to ')
    .replace(/≥/g, ' at least ')
    .replace(/≤/g, ' at most ')
    .replace(/>/g, ' greater than ')
    .replace(/</g, ' less than ')
    .replace(/→/g, ' then ')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/±/g, ' plus or minus ')
    .replace(/√/g, ' the square root of ')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]{2,}/g, (run) => ` to the ${[...run].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join('')}`)
    .replace(/²/g, ' squared')
    .replace(/³/g, ' cubed')
    .replace(/[⁰¹⁴⁵⁶⁷⁸⁹]/g, (c) => ` to the ${'⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)}`)
    .replace(/\$([\d,.]+)/g, '$1 dollars')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** A unit's name without the numbering the guides carry — "3 · Elasticity". */
function chapterName(name: string): string {
  return name.replace(/^\d+(\/\d+)?\s*·\s*/, '').trim() || name.trim();
}

const host = (t: string): Said => ({ who: 'host', text: speakable(t) });
const expert = (t: string): Said => ({ who: 'expert', text: speakable(t) });

/** A card, as the two lines it becomes: the question asked, the answer given. */
function asked(card: StudyCard, i: number): Said[] {
  /*
   * The framing varies every third card, copied from the drafting tool for
   * the reason it does it: forty questions in a row with no connective tissue
   * reads as a list being recited rather than as two people talking, and a
   * listener stops following it somewhere around the twelfth.
   */
  const lead = i === 0 ? '' : i % 3 === 0 ? 'Next one. ' : i % 3 === 1 ? 'And this. ' : '';
  return [host(`${lead}${card.q}`), expert(card.a)];
}

/** Words per minute for silent reading, as `lib/transcript.ts` uses. */
const READING_WPM = 200;

function chaptersOf(guide: Guide): TranscriptChapter[] {
  const units = guide.units.filter((u) => u.cards.length > 0);
  if (units.length === 0) return [];

  const chapters: TranscriptChapter[] = [
    {
      name: 'Cold open',
      said: [
        host(
          `${guide.code}${guide.name ? `, ${guide.name}` : ''}. ` +
            `${units.length} ${units.length === 1 ? 'unit' : 'units'}, and we are going through all of them.`,
        ),
        ...(guide.blurb ? [expert(guide.blurb)] : []),
        ...(guide.selfTest?.length
          ? [host('We finish with a self-test, so keep something to write on.')]
          : []),
      ],
    },
  ];

  for (const unit of units) {
    const name = chapterName(unit.name);
    chapters.push({
      name,
      said: [host(`Next. ${name}.`), ...unit.cards.flatMap(asked)],
    });
  }

  if (guide.selfTest?.length) {
    const test = guide.selfTest;
    chapters.push({
      name: 'Self-test',
      said: [
        host(
          `Self-test. ${test.length} ${test.length === 1 ? 'question' : 'questions'}. ` +
            'Answer out loud, then listen for the answer.',
        ),
        ...test.flatMap((card, i) => [host(`${i + 1}. ${card.q}`), expert(card.a)]),
      ],
    });
  }

  return chapters;
}

/** Every word in the script, for the reading estimate. */
function words(chapters: TranscriptChapter[]): number {
  return chapters.reduce(
    (n, c) => n + c.said.reduce((m, s) => m + s.text.split(/\s+/).filter(Boolean).length, 0),
    0,
  );
}

export interface Script {
  episode: Episode;
  transcript: Transcript;
}

/**
 * A course's script, or null where there is nothing to make one from.
 *
 * Null for a guide with no cards in any unit, which is the one honest answer:
 * every line of a script here is a card, so a course without them would
 * produce an opening, a closing, and the claim that something had been
 * written.
 */
export function scriptFor(courseId: string, guide: Guide): Script | null {
  const chapters = chaptersOf(guide);
  if (chapters.length === 0) return null;

  const id = scriptEpisodeId(courseId);
  const minutes = Math.max(1, Math.round(words(chapters) / READING_WPM));

  const marks: Chapter[] = chapters.map((c, i) => ({
    // The chapter's number, not a timestamp. See this file's header: a figure
    // estimated from a word count, printed where the recorded editions print
    // an exact seek position, is two claims wearing one typeface.
    t: String(i + 1),
    s: 0,
    name: c.name,
  }));

  return {
    episode: {
      id,
      label: 'Script',
      // Not recorded, so there is nothing to play. `screens/Guide.tsx` already
      // draws this state — it was written for a shipped edition that had not
      // been rendered yet, and a derived script is the same situation arrived
      // at from the other direction.
      file: '',
      len: `${minutes} min read`,
      seconds: 0,
      ready: false,
      blurb:
        'Written from this course’s own guide — every line is one of its cards, asked and ' +
        'answered. Not recorded yet, so this is the script rather than the audio.',
      chapters: marks,
    },
    transcript: { episode: id, voices: ['host', 'expert'], chapters },
  };
}
