/**
 * Where the playhead is in a lesson, and therefore which way it can still go.
 *
 * A narrated unit is a list of cues, and — when something was added to the
 * unit after the narration was recorded — a short tail of slides played at the
 * end. Two arrows step through both. Whether either arrow has anywhere to go
 * is the only thing in that transport with a decision in it, and it was
 * written twice inside the two `onClick` handlers, where nothing could read
 * it: the arrows were enabled at both ends, and pressing the one with nowhere
 * to go seeked to the beat you were already sitting on.
 *
 * That is this app's one exception to its own idiom. `Reorder` disables its
 * arrow at the top and bottom of a list — that is what `.bare:disabled` in
 * `styles/app.css` exists for — and an enabled control that does nothing is a
 * small lie about what is available. Out here the rule is one expression, and
 * the screen asks it instead of restating it.
 */
export interface BeatPosition {
  /** Which cue the playhead is on. */
  index: number;
  /** How many cues the narration has. Zero is a real case: see `atLastBeat`. */
  cues: number;
  /** Slides added after the narration was recorded, played at the end. */
  added: number;
  /** How many of those have been stepped into. Zero while the narration runs. */
  extra: number;
  /** Whether the narration has reached its end. */
  finished: boolean;
}

/** Whether the tail of added slides is what is on screen, rather than a cue. */
export function showingExtra(at: BeatPosition): boolean {
  return at.finished && at.added > 0 && at.extra > 0;
}

/**
 * Nowhere further back.
 *
 * Inside the tail there always is: stepping back off the first added slide
 * returns to the last cue, which is a move. So only the first cue of the
 * narration itself is the start.
 *
 * A unit that arrived with no cues at all counts as the start too, which is
 * the second thing this fixes — `Previous` indexed `cues` directly, so an
 * empty one had it throwing rather than merely lying.
 */
export function atFirstBeat(at: BeatPosition): boolean {
  return !showingExtra(at) && at.index <= 0;
}

/**
 * Nowhere further on.
 *
 * The last cue is not the end while there are added slides left to step into,
 * which is why this asks about the tail before it asks about the cues.
 */
export function atLastBeat(at: BeatPosition): boolean {
  const moreAdded = at.finished && at.added > 0 && at.extra < at.added;
  return !moreAdded && at.index >= at.cues - 1;
}

/**
 * How far ahead of the voice a slide turns, in seconds.
 *
 * A cue records the second its narration *starts*, so turning the slide
 * exactly on it puts the type up a frame after the first syllable. The lead
 * is small enough not to spoil an answer and large enough that the slide is
 * already there when the sentence begins.
 */
export const CUE_LEAD = 0.15;

/**
 * Which cue is on screen at `seconds` into the narration.
 *
 * Shared rather than restated. The player computed this inline and the video
 * renderer needed the identical rule — including the lead above, which is the
 * kind of constant that gets copied as `0.15` and then fixed in one of the two
 * places. `pipeline/README.md` claims a deck, a handout and a lesson cannot
 * disagree with the app; a lesson and a video of that lesson are the same
 * claim, so they ask one function.
 *
 * Cues are in ascending `at` order, as `pipeline/lessons.py` writes them.
 * Before the first cue's time — and for a unit that arrived with none — the
 * answer is 0, which is what the player drew there anyway.
 */
export function cueIndexAt(cues: readonly { at: number }[], seconds: number): number {
  let i = 0;
  for (let n = 0; n < cues.length; n += 1) if (cues[n].at <= seconds + CUE_LEAD) i = n;
  return i;
}

/**
 * How far a cue is into its entrance at `seconds`, from 0 to 1.
 *
 * The companion to `cueIndexAt`, and it exists because getting one right
 * without the other produces a bug neither one looks like. `cueIndexAt` turns
 * the slide `CUE_LEAD` *before* the cue's own second — that is the whole point
 * of the lead — so an animation measured from `cue.at` is being asked about a
 * negative time for those 150ms. Clamped, that is an opacity of zero.
 *
 * The lesson video did exactly that, and every unit rendered from it blinks
 * black for 150ms at every cue: the outgoing slide has already gone because
 * the index moved on, and the incoming one is not visible yet. Ten cues a unit,
 * a hundred and twenty in a thirteen-minute explainer. It survived because a
 * frame sampled at random is almost never inside a 150ms window, and because
 * the two halves of the rule lived in different files.
 *
 * So the entrance starts where the cue was *selected*, not where its narration
 * begins. Before that it is 0, after `over` seconds it is 1, and a caller that
 * wants a rise or a fade drives both from this one number.
 */
export function cueEntrance(
  cues: readonly { at: number }[],
  index: number,
  seconds: number,
  over: number,
): number {
  if (over <= 0) return 1;
  const shown = (cues[index]?.at ?? 0) - CUE_LEAD;
  return Math.max(0, Math.min(1, (seconds - shown) / over));
}
