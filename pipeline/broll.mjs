import { pointsAtSomebody } from './likeness.mjs';

/**
 * The shot list for a documentary cut, and what it is allowed to ask for.
 *
 * Step 4 of `docs/VIDEO_PODCAST_ROADMAP.md` puts "establishing shots" in the
 * middle of the documentary frame, generated per chapter. The accounting for
 * that has existed since `clipspend.ts`; what had not existed is the thing
 * being bought.
 *
 * ## The prompt was the chapter's name, and a chapter name is not a shot
 *
 * `render-documentary.mjs` built its jobs as `prompt: c.name`, so the fourteen
 * clips it priced for ECON would have been generated from "Cold open",
 * "Optimisation and opportunity cost", "The formula sheet". None of those can
 * be filmed. It would have produced fourteen unusable clips at whatever the
 * provider charges and the estimate would have looked exactly the same as a
 * good one.
 *
 * So a shot list is drafted with the subject **empty**, and nothing can be
 * priced or bought until somebody writes them. That is the arrangement
 * `make-script.mjs` already uses for a podcast: the tool produces the
 * structure and the draft, a person writes the words, and the checks run over
 * what they wrote. A chapter title is a label for a section of argument; a
 * shot is something a camera could point at, and turning one into the other is
 * the part no amount of string formatting does.
 */

/**
 * How a shot is treated, as structure rather than as a sentence.
 *
 * `styles.mjs` and `personas.mjs` make the same move, and here it earns its
 * place twice: the treatment is the half of a prompt that does not change
 * between courses, so writing it once means the fourteen subjects somebody
 * types are the only thing they have to think about.
 */
export const SHOT_KINDS = {
  establishing: {
    label: 'Establishing',
    camera: 'wide, static, eye level',
    blurb: 'Where we are, held long enough to read.',
  },
  detail: {
    label: 'Detail',
    camera: 'close, shallow depth of field, slow push in',
    blurb: 'One thing, close, while the voice names it.',
  },
  abstract: {
    label: 'Abstract',
    camera: 'macro, slow drift, soft focus',
    blurb: 'Texture and movement for a passage with nothing literal in it.',
  },
};

export const SHOT_KIND_IDS = Object.keys(SHOT_KINDS);

/**
 * How long a shot runs, in seconds.
 *
 * Six because the chapter card takes `LOWER_THIRD_IN` — 0.6s — to arrive and
 * then holds, and a shot that ends before the card has settled is a flash
 * rather than a cutaway. Six also sits inside the 5–10s the roadmap budgets
 * per clip, and the bounds below keep an edited shot list there: under three
 * seconds nothing reads, over ten the frame has stopped being typographic and
 * become a film with subtitles.
 */
export const SHOT_SECONDS = 6;
export const SHOT_MIN = 3;
export const SHOT_MAX = 10;

/**
 * A shot list with nothing in it yet, one shot per chapter.
 *
 * `at` comes from the chapter mark `audio/synth.py` measured, so a shot lands
 * on the second the chapter does — the same number the lower third animates
 * on, which is what makes the cut read as one event rather than two.
 */
export function draftShots(episode, seconds = SHOT_SECONDS) {
  return episode.chapters.map((chapter, i) => ({
    slot: `${episode.course}/chapter-${i}`,
    at: chapter.s,
    seconds,
    kind: 'establishing',
    chapter: chapter.name,
    /*
     * Empty, and the run refuses until it is not. See the header: the thing
     * this file exists to prevent is fourteen clips generated from fourteen
     * section headings.
     */
    subject: '',
  }));
}

/**
 * The prompt a provider would be given.
 *
 * Subject from the person, treatment from the kind, and a tail that is not
 * negotiable — see `check` for why text and charts are refused rather than
 * merely discouraged.
 */
export function shotPrompt(shot) {
  const kind = SHOT_KINDS[shot.kind] ?? SHOT_KINDS.establishing;
  return [
    `${kind.label} shot: ${shot.subject}.`,
    `${kind.camera}. Natural light. ${shot.seconds} seconds, no cuts.`,
    'No text, no writing, no signage, no logos, no charts.',
    'No identifiable real person.',
  ].join(' ');
}

/*
 * Things a generative video model renders as garbage, and that this app draws
 * properly two hundred pixels away.
 *
 * A generated whiteboard is pseudo-writing; a generated chart is numbers that
 * are not the numbers. Either would sit in the same frame as the real chapter
 * card and the real captions, which are typeset from the script — so the
 * failure is not "a slightly wrong graph", it is one frame containing the
 * course's actual words and a fake version of them.
 */
const RENDERS_AS_GIBBERISH =
  /\b(?:text|writing|written|words?|letters?|sign|signage|label(?:led|s)?|caption|headline|newspaper|book cover|whiteboard|blackboard|chalkboard|slide|chart|graph|diagram|equation|formula|spreadsheet|screen(?:shot)?|poster|billboard)\b/i;

/** How long a subject may be before it has stopped being a shot. */
export const SUBJECT_MAX = 120;

/**
 * What is wrong with a shot, or an empty list.
 *
 * The checks in order of how often each will actually fire.
 */
export function check(shot) {
  const problems = [];
  const subject = String(shot.subject ?? '').trim();

  if (!subject) {
    problems.push(`no subject yet — write what the camera is pointed at for "${shot.chapter}"`);
    return problems; // nothing below can say anything useful about an empty string
  }

  /*
   * The lazy path, closed.
   *
   * The draft carries the chapter name so whoever fills the file in knows
   * which passage they are writing for. It is right there, it is the wrong
   * thing, and pasting it across is the single most likely way this file ends
   * up producing what it was written to prevent.
   */
  if (subject.toLowerCase() === String(shot.chapter ?? '').trim().toLowerCase()) {
    problems.push(
      `subject is the chapter's own title — "${shot.chapter}" names a passage of argument, not something a camera can point at`,
    );
  }

  if (subject.length > SUBJECT_MAX) {
    problems.push(`subject is ${subject.length} characters; a shot is one thing, under ${SUBJECT_MAX}`);
  }

  const points = pointsAtSomebody(subject);
  if (points) {
    problems.push(`subject points at somebody ("${points}") — describe, do not compare`);
  }

  const gibberish = subject.match(RENDERS_AS_GIBBERISH);
  if (gibberish) {
    problems.push(
      `subject asks for "${gibberish[0]}", which a video model renders as convincing nonsense — ` +
        'and this frame already carries the real chapter card and the real captions',
    );
  }

  if (!SHOT_KIND_IDS.includes(shot.kind)) {
    problems.push(`kind "${shot.kind}" is not one of: ${SHOT_KIND_IDS.join(', ')}`);
  }
  if (!Number.isFinite(shot.seconds) || shot.seconds < SHOT_MIN || shot.seconds > SHOT_MAX) {
    problems.push(`seconds ${shot.seconds} is outside ${SHOT_MIN}–${SHOT_MAX}`);
  }
  if (!Number.isFinite(shot.at) || shot.at < 0) {
    problems.push(`at ${shot.at} is not a second of the episode`);
  }

  return problems;
}

/** Every problem across a shot list, addressed by slot. */
export function checkAll(shots) {
  return shots.flatMap((shot) => check(shot).map((why) => ({ slot: shot.slot, why })));
}

/** The jobs a shot list would be, in the shape `video/src/clipspend.ts` records. */
export function shotJobs(shots, provider, model) {
  return shots.map((shot) => ({
    slot: shot.slot,
    prompt: shotPrompt(shot),
    seconds: shot.seconds,
    provider,
    model,
  }));
}

/**
 * Whether a run is inside the ceiling it was given.
 *
 * The third guardrail, and the one the roadmap's §7 does not ask for. A
 * manifest stops the *second* run paying for the first run's clips; a
 * `--dry-run` shows what a run would cost to somebody who reads it. Neither
 * stops a run that is correctly priced, correctly deduplicated, and four
 * hundred dollars because a shot list was edited to a hundred shots. The
 * ceiling is the number that has to be raised on purpose.
 */
export function withinCeiling(cents, ceilingCents) {
  if (!Number.isFinite(ceilingCents)) return { ok: false, why: 'no ceiling given' };
  if (cents > ceilingCents) {
    return { ok: false, why: `${cents}c is over the ${ceilingCents}c ceiling`, over: cents - ceilingCents };
  }
  return { ok: true, over: 0 };
}
