import type { CSSProperties } from 'react';
import { blockLabel, kindTint } from '../lib/kinds';
import { useStore } from '../state/store';
import { ground as groundOf, resolveGround } from '../lib/look';
import { usePrefersDark } from '../lib/prefers';
import { bandRows, type BandRun } from '../lib/band';
import type { Banner } from '../lib/select';

/**
 * The all-day band: the row above the first hour.
 *
 * Google Calendar and Outlook both pin one here, and for a reason an hour
 * grid makes obvious the moment you try to do without it. A grid is a claim
 * about *when* — this block is these hours and not those — and an entry
 * covering the whole day has no such claim to make. Drawn inside the grid it
 * would have to start somewhere, and starting at midnight says it finishes at
 * one in the morning. So it goes above the grid, where the only thing being
 * asserted is the day.
 *
 * Before this the app had no such row, and it showed in a way that reads as a
 * bug once you see it: the app could *read* an all-day event off a connected
 * Google or Outlook calendar — `lib/ics.ts` has understood `VALUE=DATE` all
 * along — and then had nowhere to draw it, so it fell into the list under the
 * grid beside the campus listings whose time is "TBD". Those two are not the
 * same thing. One is a date nobody has fixed yet; the other is fixed, and is
 * the whole day.
 *
 * ## One component for the day view and the week view
 *
 * The day banner is this with one column. Splitting them would mean two
 * answers to how entries stack, and the two would drift the first time one
 * was edited — which is the failure `bandRows` in `lib/band.ts` exists to
 * make impossible: the packing is one function and this draws whatever it
 * returns, for one column or seven.
 */
export function AllDayBand({
  columns,
  gutter,
  style,
  onOpen,
}: {
  /** One entry per column of the grid this sits above, left to right. */
  columns: Banner[][];
  /**
   * The width of the grid's hour gutter, so the bars start where the columns
   * do. Passed rather than read from CSS because the two grids do not agree
   * on it — the day grid's is wider — and a band half a column out of line
   * with the grid under it is worse than no band.
   */
  gutter: number;
  style?: CSSProperties;
  /** What a bar does when pressed. Absent makes the band read-only. */
  onOpen?: (run: BandRun) => void;
}) {
  const { state } = useStore();
  const light = groundOf(resolveGround(state.ground, usePrefersDark())).light;
  const rows = bandRows(columns);
  if (rows.length === 0) return null;

  const wide = columns.length > 1;
  return (
    <div className="adband" style={style}>
      <div className="adband-gutter" style={{ width: gutter }} aria-hidden="true">
        All day
      </div>
      <div
        className="adband-rows"
        style={{ ['--adband-cols' as string]: String(columns.length) }}
        /*
         * A list of rows rather than a table. The band is one fact per bar —
         * "this is on, these days" — and a screen reader reading it as a grid
         * would announce a column position that means nothing without the
         * hour grid underneath, which it is not part of.
         */
        role="list"
        aria-label="All day"
      >
        {rows.map((row, i) => (
          <div key={i} className="adband-row" role="listitem">
            {row.map((run) => {
              const Tag = onOpen ? 'button' : 'div';
              return (
                <Tag
                  key={run.key}
                  type={onOpen ? 'button' : undefined}
                  className={`adband-bar${run.opens ? ' opens' : ''}${run.closes ? ' closes' : ''}`}
                  style={{
                    gridColumn: `${run.from + 1} / ${run.to + 2}`,
                    background: kindTint(run.kind, light),
                  }}
                  onClick={onOpen ? () => onOpen(run) : undefined}
                  /*
                   * The span said in words, not only in the width of a bar.
                   * A bar clipped by the edge of the week is the case that
                   * needs it: on screen it ends at Sunday, and what it
                   * actually does is carry on into next week.
                   */
                  title={blockLabel(
                    run.title,
                    run.kind,
                    'All day',
                    run.closes ? run.meta : [run.meta, 'Continues past this week'].filter(Boolean).join('. '),
                  )}
                >
                  <span className="adband-name">{run.title}</span>
                  {wide || !run.meta ? null : <span className="adband-meta">{run.meta}</span>}
                </Tag>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
