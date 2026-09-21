/**
 * The YouTube-length explainer: several units of a course as one video.
 *
 * The last format in §3 of `docs/VIDEO_PODCAST_ROADMAP.md` and the only one
 * that was never in the rollout order at all — "8–15 min, hook in the first
 * 15s, chapter marks", with the marks coming from the cue list "the way
 * `synth.py` does it, not from `chapters.py`".
 *
 * ## Nothing is synthesised
 *
 * A lesson is 52 seconds to four minutes and the whole set of a course is 15
 * to 26, so an explainer is a *run of units played in order*, not a new
 * recording. The audio is the MP3s every student already streams, sequenced;
 * the cue list is those units' own cue lists, offset; the chapter marks are
 * the unit boundaries, which are known exactly because the durations are.
 * Same arrangement as the shorts, which the roadmap describes as cut "from the
 * cue list rather than from `guide.ts`".
 *
 * ## 8–15 minutes is a real constraint and it bites
 *
 * Measured across the four courses, starting from unit 0 and counting the
 * beat between units:
 *
 *     econ   10 of 11 units   13:48   1 unit left over
 *     bus     9 of 13 units   13:37   4 left over
 *     psci    7 of 14 units   13:06   7 left over
 *     core    5 of  6 units   12:35   1 left over
 *
 * Not one of the four fits whole. ECON comes closest and still does not —
 * its eleven units are 15:00 of narration exactly, and the ten beats between
 * them put it eight seconds over. So an explainer is always a *truncation*,
 * `runWithin` does that arithmetic, and the run says how many units it left
 * behind rather than quietly producing a 26-minute video the format does not
 * describe.
 */

/** Seconds of quiet between two units, so they do not run together. */
export const UNIT_GAP = 0.8;

/** What the roadmap calls YouTube-length. */
export const BAND = { min: 8 * 60, max: 15 * 60 };

/**
 * The hook's outer bound, and its floor.
 *
 * The roadmap asks for a hook in the first 15 seconds. It ends on a cue rather
 * than on the number: the last cue at or before 15s, so the cut from the hook
 * to the first slide lands where a sentence starts instead of halfway through
 * one. For ECON that puts it at 8.92s — the title and the first question are
 * the hook, and the cut happens exactly as the answer begins.
 */
export const HOOK_MAX = 15;
export const HOOK_MIN = 5;

/** The units of a course, in order, as `lessons.json` stores them. */
export function unitsOf(lessons) {
  return Object.keys(lessons)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => lessons[String(k)]);
}

/**
 * The longest contiguous run from `from` that fits under the band's ceiling.
 *
 * Longest rather than closest, because a viewer who came for a course wants
 * the course, and the ceiling is the only hard edge — the roadmap's lower
 * bound is about whether a video is worth making, which is a different
 * question from whether it is too long.
 */
export function runWithin(units, from = 0, band = BAND) {
  const out = [];
  let seconds = 0;
  for (let i = from; i < units.length; i += 1) {
    const next = seconds + (out.length ? UNIT_GAP : 0) + units[i].seconds;
    if (next > band.max) break;
    out.push(units[i]);
    seconds = next;
  }
  return { units: out, seconds: ms(seconds), left: units.length - from - out.length };
}

/**
 * Where each unit starts, and every cue re-addressed to the whole timeline.
 *
 * The cue times in `lessons.json` are relative to their own MP3. Offsetting
 * them here is what lets one `cueIndexAt` call drive a video assembled from
 * eleven files — the same function the app's player, the lesson video and the
 * documentary all ask.
 */
export function timeline(units) {
  const placed = [];
  const cues = [];
  let at = 0;
  for (const unit of units) {
    if (placed.length) at += UNIT_GAP;
    /*
     * Rounded to the millisecond, and the unit's own offset with it.
     *
     * `UNIT_GAP` is 0.8, which binary floating point cannot hold exactly, so
     * ten units of it accumulate about 2e-14 of drift. Rounding the cues and
     * not the offset was enough to put a unit's first cue *before* the unit
     * it belongs to — 176.6 against 176.60000000000002 — which is a tenth of
     * a picosecond and still a cue that fails to be inside its own chapter.
     * A frame is 33ms; three decimals is more resolution than anything here
     * can use.
     */
    at = ms(at);
    placed.push({ ...unit, at, seconds: unit.seconds });
    for (const cue of unit.cues ?? []) {
      cues.push({ ...cue, at: ms(at + cue.at), unit: unit.unit });
    }
    at += unit.seconds;
  }
  return { units: placed, cues, seconds: ms(at) };
}

/** A second, to the millisecond. */
function ms(seconds) {
  return Number(seconds.toFixed(3));
}

/** "12:32", the way every other file here writes a length. */
export function mmss(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * Where the hook ends: the last cue at or before `HOOK_MAX`.
 *
 * Never before `HOOK_MIN`, because a hook that is over in three seconds is a
 * title card. A unit whose first cues are all late falls back to the floor.
 */
export function hookEnd(cues, max = HOOK_MAX, min = HOOK_MIN) {
  let last = min;
  for (const cue of cues) {
    if (cue.at > max) break;
    if (cue.at >= min) last = cue.at;
  }
  return last;
}

/**
 * The questions the hook promises.
 *
 * Drawn from the units *after* the first, and that is the whole rule: the
 * opening narration is already asking and answering something, and a hook
 * that listed the question being answered underneath it would be reading the
 * viewer their own subtitles. Promising what comes later is what a hook is
 * for.
 *
 * One per unit, evenly spread when there are more units than slots, so the
 * list covers the whole run rather than its first minute.
 */
export function hookQuestions(units, most = 4) {
  const later = units.slice(1);
  const asked = later
    .map((unit) => (unit.cues ?? []).find((c) => c.kind === 'q')?.text)
    .filter(Boolean);
  if (asked.length <= most) return asked;
  const step = (asked.length - 1) / (most - 1);
  return Array.from({ length: most }, (_, i) => asked[Math.round(i * step)]);
}

/**
 * The chapter list, as seconds and as the text a description box wants.
 *
 * YouTube reads chapters out of a video's description and requires the first
 * to be `0:00`, which a unit run gives for nothing. Measured while assembling
 * rather than recovered afterwards — the roadmap is specific about that, and
 * `pipeline/chapters.py` exists because recovering them is the harder job.
 */
export function chaptersOf(placed) {
  return placed.map((unit) => ({ at: unit.at, t: mmss(unit.at), title: unit.title }));
}

export function chapterText(chapters) {
  return chapters.map((c) => `${c.t} ${c.title}`).join('\n');
}

/** Everything a render needs, or a reason there is nothing to render. */
export function planExplainer(lessons, options = {}) {
  const { from = 0, to, band = BAND, hookSlots = 4 } = options;
  const all = unitsOf(lessons);
  if (all.length === 0) return { why: 'no units in this course' };
  if (from < 0 || from >= all.length) return { why: `no unit ${from} in this course` };

  const chosen =
    to === undefined
      ? runWithin(all, from, band)
      : (() => {
          const units = all.slice(from, to + 1);
          const seconds = ms(
            units.reduce((n, u) => n + u.seconds, 0) + UNIT_GAP * Math.max(0, units.length - 1),
          );
          return { units, seconds, left: all.length - from - units.length };
        })();

  if (chosen.units.length === 0) {
    return { why: `unit ${from} alone is ${mmss(all[from].seconds)}, over the ${mmss(band.max)} ceiling` };
  }

  const laid = timeline(chosen.units);
  return {
    from,
    to: from + chosen.units.length - 1,
    left: chosen.left,
    seconds: laid.seconds,
    len: mmss(laid.seconds),
    units: laid.units,
    cues: laid.cues,
    chapters: chaptersOf(laid.units),
    hook: { until: hookEnd(laid.cues), questions: hookQuestions(chosen.units, hookSlots) },
    band,
    /*
     * Under the floor is not a refusal. The ceiling is what the format cannot
     * exceed; the floor is advice about whether a video is worth making, and a
     * course with four short units is allowed to have a six-minute explainer.
     */
    short: laid.seconds < band.min,
  };
}

/**
 * What the video is called, under the course code the frame already draws.
 *
 * The course's own name, and — only when units were left out — how far this
 * one goes. The first cut of this returned "CORE 2500 — units 1–2" and the
 * composition drew the code above it, so the code was on screen twice:
 * exactly the duplication `Documentary.tsx` already has a `withoutCode` for.
 * Not repeating it is cheaper than stripping it afterwards.
 *
 * The range is left off a video that is the whole course, because "units
 * 1–11" on a complete course is noise; saying nothing on one that stops
 * two-thirds of the way through is a promise it does not keep.
 */
export function explainerTitle(name, plan) {
  const range = plan.left ? ` · units ${plan.from + 1}–${plan.to + 1}` : '';
  return `${name}${range}`;
}
