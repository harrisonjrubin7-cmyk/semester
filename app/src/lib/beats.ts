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
