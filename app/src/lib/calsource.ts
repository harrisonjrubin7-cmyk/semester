/**
 * What the calendar's second axis actually selects.
 *
 * The screen has two axes and says so at the top of `screens/Calendar.tsx`:
 * the **view** is the grain, the **source** is what is on it, and keeping them
 * independent is what makes "just my classes, for the whole semester" and
 * "every single thing happening today" both one tap away.
 *
 * The source axis worked in two of the four views.
 *
 *  - **Day** read it, and its four buckets are the ones written down here.
 *  - **Month** read it too, from its own copy of the same three conditions.
 *  - **Week** did not read it at all. Choosing "Due" left every class on the
 *    grid; choosing "Campus" left the grid unchanged and showed no campus
 *    event, because none was drawn on any grid at the time. The chips moved
 *    and nothing did. Campus events are blocks now — see `campusHours` in
 *    `lib/select.ts` — so this question has to answer for them too.
 *  - **Semester** read it for deadlines and campus and had no branch for
 *    classes, so the exact combination the file's own comment advertises —
 *    classes, whole semester — produced "Nothing from this source across the
 *    whole semester", about a term with four courses meeting all week.
 *
 * Two views agreeing by having each written the conditions out is how the
 * third and fourth came to disagree. So the rule is one thing, here, and each
 * view asks it.
 *
 * ## The three buckets, and why a thing is in the one it is in
 *
 * Taken from what Day already did, because that view was right and the point
 * is to stop the four disagreeing rather than to re-litigate them:
 *
 *  - **classes** — the timetable: what a syllabus says meets, plus the
 *    appointments and standing commitments you added. Yours are here rather
 *    than under deadlines because they are hours in a day, not work to hand in.
 *  - **deadlines** — what is due: the syllabus's dated obligations and your own
 *    tasks.
 *  - **campus** — what is on: the campus calendar and anything a connected
 *    calendar feed says.
 */

import { CAMPUS_KIND } from './kinds';

export type CalSource = 'all' | 'classes' | 'deadlines' | 'campus';

export interface Shows {
  /** Classes from the syllabi, your appointments, your standing commitments. */
  classes: boolean;
  /** Syllabus deadlines and your own tasks. */
  deadlines: boolean;
  /** Campus events and connected calendar feeds. */
  campus: boolean;
}

export function shows(source: CalSource): Shows {
  return {
    classes: source === 'all' || source === 'classes',
    deadlines: source === 'all' || source === 'deadlines',
    campus: source === 'all' || source === 'campus',
  };
}

/**
 * What the current source is called, in a sentence.
 *
 * For the empty states, which used to say "this source" — a phrase that
 * describes the control rather than the thing, and leaves somebody who has
 * forgotten which chip is lit no better off.
 */
export function sourceName(source: CalSource): string {
  return source === 'all'
    ? 'anything'
    : source === 'classes'
      ? 'classes or anything you have added to a day'
      : source === 'deadlines'
        ? 'deadlines or your own tasks'
        : 'campus events';
}

/**
 * Whether a block an hour grid drew belongs under this source.
 *
 * The grids build their blocks from the catalogue, from what you have added
 * and — since campus events are drawn rather than only listed — from the
 * university's calendar and yours. They arrive mixed, and two fields say which
 * is which: `kind` is `campus` for something that is on around you, and `from`
 * says which record a block can be moved by, which is also the only thing that
 * separates a deadline from an appointment. A block with neither came from a
 * syllabus's meeting pattern or from a standing commitment — the timetable
 * either way, which is the classes bucket.
 *
 * Here rather than in the view because the week grid and the day rail have to
 * agree, and the way they came to disagree in the first place was each having
 * its own copy of the question.
 */
export function keepBlock(
  block: { kind?: string | null; from?: { kind: 'appointment' | 'item' } } | undefined,
  on: Shows,
): boolean {
  if (block?.kind === CAMPUS_KIND) return on.campus;
  if (!block?.from) return on.classes;
  return block.from.kind === 'item' ? on.deadlines : on.classes;
}

/*
 * ## The third axis, which only the campus source has
 *
 * Under Campus there is a second row of chips — All, Athletics, Clubs,
 * University, Saved. It lived inside the campus *list*, which is one of the
 * four views, so it appeared under Campus + Month and nowhere else: choosing
 * Campus in Day, Week or Semester offered no way to say "just the games", and
 * a filter set on the month quietly stopped applying the moment the view
 * changed. The chips are the screen's now, beside the source chips they belong
 * with, and every view asks the same question of them.
 */

export const EVENT_KINDS = ['All', 'Athletics', 'Clubs', 'University', 'Saved'] as const;

export type EvFilter = (typeof EVENT_KINDS)[number];

/**
 * The kind filter as it applies under the current source.
 *
 * The chips are only drawn under Campus, so under any other source the answer
 * is All — a filter nobody can see is a filter nobody can undo, and "Saved"
 * left over from a visit to Campus must not go on hiding half of Everything.
 */
export function eventFilter(source: CalSource, filter: EvFilter): EvFilter {
  return source === 'campus' ? filter : 'All';
}

/** Whether a campus event belongs under this filter. */
export function keepEvent(
  event: { id: string; kind: string },
  filter: EvFilter,
  saved: Record<string, boolean>,
): boolean {
  if (filter === 'All') return true;
  if (filter === 'Saved') return saved[event.id] === true;
  return event.kind === filter;
}

/**
 * Whether an entry from a connected calendar belongs under this filter.
 *
 * A feed says what is on and when; it does not say whether that is a game, a
 * club or the university, so nothing here can honestly be called Athletics —
 * and Saved is a list of campus listings you have kept, which a feed entry
 * never joins. So a feed entry shows under All and under nothing else, rather
 * than being filed under a kind the .ics never claimed.
 */
export function keepFeedEvent(filter: EvFilter): boolean {
  return filter === 'All';
}
