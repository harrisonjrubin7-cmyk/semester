import type { HTMLAttributes, ReactNode } from 'react';
import { useStore } from '../state/store';
import { TickBox } from './ui';
import { lateBy, type Standing } from '../lib/standing';
import { isUnderway, openLine } from '../lib/underway';
import { useRowStyle } from './shell/useShell';
import { useAskAbout } from '../ai/AskAbout';
import { CourseTag } from './CourseTag';
import { DIMMED_ROW, secondLine } from '../lib/dim';
import { clipCounts, useFiles } from '../lib/clips';
import { Paperclip } from './Icons';
import type { DatedItem } from '../lib/types';

/**
 * One deadline, readable without opening it.
 *
 * The tick box is the whole point. Marking something done used to mean
 * opening the deadline, finding the button, and coming back — and then the row
 * you returned to looked exactly as it had before, so the only way to check
 * your own work was to open it again. Now the state is on the row, the row can
 * be changed from where you are reading it, and the tap target for ticking is
 * held apart from the tap target for opening so neither steals the other.
 *
 * It lives here rather than in a screen because the calendar and the course
 * page were each drawing their own version of this row, and each one had
 * quietly forgotten to show whether the thing was done.
 *
 * ## Three ways of drawing it
 *
 * `state.feed` is Cards, Compact rows, or Timeline — three genuinely different
 * readings of the same day rather than three skins. Cards separate things and
 * are easiest to tap; rows fit roughly twice as much on a screen, which matters
 * on a heavy Tuesday; the timeline puts everything on one vertical line in due
 * order, which is the only one of the three that shows the *gaps*.
 *
 * The choice is applied here, once, rather than in each screen — the calendar
 * and the course page use this row too, and a setting that only worked on Today
 * would be a setting people report as broken.
 */
export function DeadlineRow({
  item,
  tone,
  meta,
  trail,
  drag,
}: {
  item: DatedItem;
  tone: Standing;
  /** Overrides the default "date · kind · weight" line. */
  meta?: ReactNode;
  /** Overrides the right-hand marker; pass null to drop it. */
  trail?: ReactNode | null;
  /**
   * Pointer handlers that make this row draggable, on a screen where it is.
   *
   * ## Why this replaces the long press rather than joining it
   *
   * Holding a row already means something: `useAskAbout` waits 450ms and opens
   * the assistant about this deadline. A drag has to start from a hold too —
   * see `lib/drag.ts` — and two press-and-hold gestures on one element cannot
   * both fire. Whichever is shorter simply wins, and a row where that depended
   * on how long somebody happened to press is worse than either.
   *
   * So it is decided here, once, and it is decided by where the row is. On the
   * calendar the row is a thing at a time and the gesture for it is *move*; on
   * Today and the course page it is a thing to think about and the gesture is
   * *ask*. Passing `drag` says which screen this is. Asking about a deadline
   * is never lost — it is on every other list this row appears in, and the
   * assistant button reaches it from anywhere.
   */
  drag?: HTMLAttributes<HTMLElement>;
}) {
  // `now` rather than `Date.now()`: the store's clock ticks once a minute, so
  // "open 4 days" stays right without making the render impure.
  const { state, dispatch, catalog, now, tint } = useStore();
  // Only the row and timeline styles take it. A card already has its own edge
  // and inset, and a card inside a grouped panel would be a card in a card.
  const row = useRowStyle(0);
  const done = !!state.done[item.id];
  const late = tone === 'overdue';
  const style = state.feed;
  // Shown in every list, not only on the Working tab: the whole value of the
  // mark is knowing which of eleven things you have already opened, and that
  // is a question asked while looking at Ahead.
  const going = isUnderway(item.id, state.started, state.done);
  /*
   * How many things are filed against this one.
   *
   * The marker is the whole reason the filing is worth doing: work put against
   * a deadline and then invisible everywhere but on that deadline's own screen
   * is work nobody trusts the app to be holding. `lib/clips.ts` makes asking
   * this once per row affordable, and includes the files — which are in
   * IndexedDB and so arrive a frame after the first paint.
   */
  const files = useFiles();
  const clipped = clipCounts({ ...state, files })[item.id] ?? 0;
  const tight = style === 'rows';
  const pad = tight ? '8px 0' : '13px 0';

  const marker =
    trail === undefined ? (late ? lateBy(item) : item.daysAway === 0 ? 'today' : `${item.daysAway}d`) : trail;

  /*
   * Hold a deadline to ask about that one.
   *
   * The row is drawn by three screens and holds the only thing the assistant
   * needs to be scoped to a single obligation: its id, its course, what it is
   * worth and when it is due. Wired here rather than in each screen, for the
   * same reason the row itself lives here — the calendar and the course page
   * each had their own version of this and each had quietly forgotten a part.
   */
  const hold = useAskAbout(`deadline:${item.id}`, () => ({
    context: {
      summary: `One deadline: ${item.title} for ${catalog.byId[item.c]?.code ?? ''}, due ${item.dueShort}.`,
      focus: {
        id: item.id,
        course: catalog.byId[item.c]?.code,
        title: item.title,
        due: item.dueShort,
        inDays: item.daysAway,
        weight: item.weight,
        done,
        started: going,
      },
      visible: [],
      actions: ['tick_deadline', 'add_task', 'start_timer'],
      suggestions: [
        `How long will ${item.title} take?`,
        'What does this one need from me?',
        'Break this into steps I can do tonight.',
      ],
    },
    seed: `About ${item.title}: `,
  }));

  return (
    <div
      {...(drag ?? hold)}
      style={{
        display: 'flex',
        gap: 'var(--sp-5)',
        alignItems: 'center',
        // Cards get their own edge and a gap; rows and the timeline share one
        // hairline, which is what lets twice as many fit.
        ...(style === 'cards'
          ? {
              background: 'var(--app-panel)',
              border: '1px solid var(--app-line)',
              // The one edge that says whose card this is. A card is the
              // roomiest of the three feeds and the one where a stack of six
              // otherwise reads as six identical rectangles.
              borderLeft: `3px solid ${tint(item.c).edge}`,
              borderRadius: 'var(--r-md)',
              padding: '0 12px',
              marginBottom: 'var(--sp-4)',
            }
          : row),
        ...(style === 'timeline'
          ? {
              // The line itself, drawn as a left border on every row so it is
              // continuous down the list without a wrapper element that each
              // caller would have to remember to add.
              // In the course's colour rather than a hairline: the timeline
              // is one continuous line down a mixed day, and the segment a row
              // sits on is the cheapest possible way to say whose it is.
              borderLeft: `2px solid ${tint(item.c).edge}`,
              marginLeft: 7,
              paddingLeft: 'var(--sp-6)',
            }
          : {}),
      }}
    >
      <button
        type="button"
        className="bare tappable"
        onClick={() => dispatch({ type: 'toggleDone', id: item.id })}
        aria-label={done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
        style={{ flex: 'none', padding: tight ? '8px 2px 8px 0' : '13px 2px 13px 0', width: 30 }}
      >
        <TickBox on={done} />
      </button>
      <button
        type="button"
        className="bare tappable on-paper"
        onClick={() => dispatch({ type: 'openItem', id: item.id })}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          gap: 'var(--sp-5)',
          alignItems: 'center',
          padding: pad,
          textAlign: 'left',
          opacity: done ? DIMMED_ROW : 1,
        }}
      >
        <CourseTag id={item.c} style={{ flex: 'none' }} />
        {going && (
          // A pip rather than a word: the row is already carrying a course
          // code, a title, a date, a kind and a weight, and a sixth label
          // would cost more than the fact is worth.
          <span
            aria-hidden
            style={{
              flex: 'none',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: tint(item.c).fill,
            }}
          />
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: 'var(--type-md)',
              lineHeight: 'var(--leading-tight)',
              textDecoration: done ? 'line-through' : 'none',
            }}
          >
            {item.title}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 'var(--type-xs)',
              ...secondLine(done),
              marginTop: tight ? 0 : 2,
              // On one line in compact rows. Dropped entirely would be a
              // deadline with no date on it, which is not "compact".
              whiteSpace: tight ? 'nowrap' : undefined,
              overflow: tight ? 'hidden' : undefined,
              textOverflow: tight ? 'ellipsis' : undefined,
            }}
          >
            {meta ?? (
              <>
                {item.dueShort} · {item.kind}
                {item.weight ? ` · ${item.weight}` : ''}
                {going ? ` · ${openLine(item.id, state.started, now.getTime()).toLowerCase()}` : ''}
              </>
            )}
          </span>
        </span>
        {clipped > 0 && (
          /*
             A clip and a number, before the countdown rather than after it.
             The countdown is the rightmost thing on every row in the app and
             moving it would move it on four screens; this reads as part of the
             row's own detail, which is what it is.

             `aria-label` on the wrapper and `aria-hidden` on the glyph, so a
             screen reader hears "two things filed against this" once rather
             than an unnamed image and a bare 2.
          */
          <span
            aria-label={`${clipped} ${clipped === 1 ? 'thing' : 'things'} filed against this`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--sp-1)',
              flex: 'none',
              fontSize: 'var(--type-xs)',
              fontVariantNumeric: 'tabular-nums',
              ...secondLine(done),
            }}
          >
            <Paperclip size={13} />
            {clipped}
          </span>
        )}
        {marker != null && (
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-xs)',
              flex: 'none',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: late ? 'var(--app-warn)' : 'inherit',
              opacity: late ? 0.95 : 0.45,
            }}
          >
            {marker}
          </span>
        )}
      </button>
    </div>
  );
}
