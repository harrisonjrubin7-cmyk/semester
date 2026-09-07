import type { Catalog } from '../data/catalog';
import type { State } from '../state/shape';
import type { Screen } from '../lib/types';

/**
 * What a screen tells the assistant about what you are looking at.
 *
 * This is the mechanism the whole feature rests on. Without it, an assistant
 * available everywhere is only a chat box that floats — it would know the
 * name of the screen and nothing about the four courses, the filter you set,
 * or the row you have open. "What do I need on the BUS final" has to work
 * without naming the course, and that only works if Grades hands over the
 * grades it is currently showing.
 *
 * ## Pure functions of state, and nothing else
 *
 * A provider takes the store and returns a description. It may not fetch, may
 * not dispatch, may not read the DOM and may not depend on the clock beyond
 * the `now` it is handed. Two reasons, both practical: these run on every
 * question, and they run inside a payload builder that has to be readable in
 * one sitting to be checkable at all.
 *
 * ## `visible` means visible
 *
 * If the student filtered a list to one course, the assistant sees one
 * course. Handing over everything and letting the model work out what is on
 * screen would make "how many are there" answer a question nobody asked. The
 * filter is part of what they are looking at.
 */

export interface ScreenContext {
  /** One line: "Grades for 4 courses, Fall 2026". Always shown to the student. */
  summary: string;
  /**
   * The one record in view, when there is one — the open course, the selected
   * day, the card on screen. Absent when the screen is a list.
   */
  focus?: unknown;
  /**
   * What is actually rendered, after filters, search and the selected window.
   * Summarised: a row per thing, not the thing itself.
   */
  visible: unknown[];
  /** Tool ids that make sense here. A hint, never a restriction — see below. */
  actions: string[];
  /** Two or three questions worth asking on this screen. Shown in the sheet. */
  suggestions: string[];
}

/** Everything a provider is allowed to read. Deliberately not the dispatch. */
export interface Look {
  state: State;
  catalog: Catalog;
  now: Date;
}

export type Provide = (look: Look) => ScreenContext | null;

/**
 * How much of a screen's context may travel, in characters.
 *
 * About two thousand tokens is the brief; this is that in the unit the code
 * can actually measure. A provider that would exceed it is trimmed at the
 * `visible` list — the summary and the focus are the parts that carry the
 * meaning, and a hundred rows of a list teach an answer less than the
 * sentence saying there are a hundred.
 */
export const ROOM = 8000;

/**
 * A screen's context, rendered for sending, and cut to fit.
 *
 * Returns the text and what had to be dropped, because the student is shown
 * both — a context that silently lost half a list is one that produces a
 * confidently wrong count.
 */
export function render(screen: Screen, label: string, ctx: ScreenContext): {
  text: string;
  dropped: number;
} {
  const head = [`On screen: ${label} (${screen}).`, ctx.summary];
  if (ctx.focus !== undefined) {
    head.push(`In view: ${JSON.stringify(ctx.focus)}`);
  }

  const lines: string[] = [];
  let room = ROOM - head.join('\n').length;
  let dropped = 0;
  for (const row of ctx.visible) {
    const line = `- ${typeof row === 'string' ? row : JSON.stringify(row)}`;
    if (line.length > room) {
      dropped += 1;
      continue;
    }
    room -= line.length + 1;
    lines.push(line);
  }

  if (lines.length > 0) head.push(`Showing ${ctx.visible.length}:`, ...lines);
  if (dropped > 0) {
    // Said in the payload as well as on screen. An answer that counts the
    // rows it was given has to know they were not all of them.
    head.push(`(${dropped} more not listed here — do not count from this list.)`);
  }
  return { text: head.join('\n'), dropped };
}
