import type { CSSProperties } from 'react';
import { blockLabel, kindTint } from '../lib/kinds';
import { gridAttrs, pointIn, useDragToMove } from '../lib/drag';
import { placeBlock } from '../lib/hourplace';
import { useStore } from '../state/store';
import { ground as groundOf, resolveGround } from '../lib/look';
import { usePrefersDark } from '../lib/prefers';

/**
 * A day, by the hour.
 *
 * The rail this sits beside is a list: it tells you what is on, in order, and
 * nothing about shape. A grid tells you the shape — that the morning is
 * stacked and the afternoon is empty, that two things overlap, that there are
 * four hours between the last class and the shift. That is the question you
 * actually have when you look at a day, and a list cannot answer it.
 *
 * Drawn rather than laid out with flexbox because position is meaning here: an
 * hour is a fixed height, a block's top is its start time and its height is its
 * length, so an empty afternoon is visibly empty rather than collapsed away.
 */

export interface HourBlock {
  id: string;
  title: string;
  meta: string;
  /** Minutes past midnight. */
  at: number;
  /** How long it runs. Classes carry a real length; a point event gets 50. */
  minutes: number;
  /** An event kind id, or null for a class. */
  kind: string | null;
  /**
   * The course this belongs to, for a class.
   *
   * Carried so the grid can draw the block in that course's colour rather
   * than in one accent for every class on the screen — which is the state a
   * Tuesday with four of them was in. Null for anything of yours: a shift, a
   * dinner, a deadline you moved onto the grid. Those are coloured by kind,
   * which is what `kind` is for.
   */
  c?: string | null;
  canceled?: boolean;
  onClick?: () => void;
  /**
   * The record this block was drawn from, where there is one that can move.
   *
   * A class has none: it is the recurring schedule repeating, and there is no
   * single row to change. Neither has a standing commitment. `lib/select.ts`
   * sets this for the two that do — an appointment you added, and a deadline
   * whose wording names an hour — which is what makes "may this be dragged"
   * a fact about the data rather than a guess about the title.
   */
  from?: { kind: 'appointment' | 'item'; id: string };
}

const ROW = 54;
const GUTTER = 46;

/** Half past nine reads as "9:30"; on the hour it reads as "9". */
function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}` : `${hour}:${String(m).padStart(2, '0')}`;
}

function ampm(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? 'a' : 'p'}`;
}

export function HourGrid({
  blocks,
  now,
  style,
  onMove,
  onAddAt,
  canMove,
}: {
  blocks: HourBlock[];
  /** Minutes past midnight, or null when this is not today. */
  now: number | null;
  style?: CSSProperties;
  /**
   * A block, dragged to a new time on this day.
   *
   * The grid owns the gesture rather than the screen above it, because the
   * hour a point lands on depends on `lo` and `ROW` — the window this grid
   * works out for itself from the day it was handed. A caller computing that
   * would be a second copy of the arithmetic, and the copy would be the one
   * that was wrong after somebody changed a constant here.
   */
  onMove?: (block: HourBlock, minutes: number) => void;
  /** Two taps on an empty part of the day, at the hour they landed on. */
  onAddAt?: (minutes: number) => void;
  /** Whether a given block may be dragged at all. Classes may not. */
  canMove?: (block: HourBlock) => boolean;
}) {
  // The window is the day's own, not a fixed 7-to-11: a day with an 8am lab and
  // nothing after four should not draw seven empty evening rows. An hour of
  // padding either side keeps the first and last block off the edge.
  const starts = blocks.map((b) => b.at);
  const ends = blocks.map((b) => b.at + b.minutes);
  const lo = Math.max(0, Math.floor(Math.min(8 * 60, ...starts) / 60) - 1);
  const hi = Math.min(24, Math.ceil(Math.max(18 * 60, ...ends) / 60) + 1);
  const hours = Array.from({ length: hi - lo }, (_, i) => lo + i);
  const top = (minutes: number) => ((minutes - lo * 60) / 60) * ROW;

  // Anything sharing time with an earlier block is narrowed and pushed right,
  // so an overlap looks like an overlap instead of one thing hiding another.
  //
  // Lanes are counted per cluster rather than across the day. A single
  // collision at eleven should not halve the width of an evening that has
  // nothing else in it, which is what one global lane count does.
  const sorted = [...blocks].sort((a, b) => a.at - b.at);
  const laneOf: number[] = [];
  const widthOf: number[] = [];

  let cluster: number[] = [];
  let clusterEnd = -1;
  const settle = () => {
    if (cluster.length === 0) return;
    const lanes: number[] = [];
    for (const i of cluster) {
      const b = sorted[i];
      const free = lanes.findIndex((end) => end <= b.at);
      const lane = free === -1 ? lanes.length : free;
      lanes[lane] = b.at + b.minutes;
      laneOf[i] = lane;
    }
    for (const i of cluster) widthOf[i] = Math.max(1, lanes.length);
    cluster = [];
    clusterEnd = -1;
  };

  sorted.forEach((b, i) => {
    if (cluster.length > 0 && b.at >= clusterEnd) settle();
    cluster.push(i);
    clusterEnd = Math.max(clusterEnd, b.at + b.minutes);
  });
  settle();

  const spec = { rowPx: ROW, gutterPx: GUTTER, startHour: lo, columns: 1 };
  const { state, tint: courseTint } = useStore();
  // The ground as resolved, not as stored: on "match my device" the kind
  // colours have to be mixed for the screen somebody is actually looking at.
  const light = groundOf(resolveGround(state.ground, usePrefersDark())).light;
  const drag = useDragToMove<HourBlock>({
    grid: spec,
    disabled: !onMove,
    onDrop: ({ payload, point }) => {
      if (point) onMove?.(payload, point.minutes);
    },
  });

  return (
    <div
      {...gridAttrs("hours", spec)}
      onDoubleClick={(e) => {
        if (!onAddAt) return;
        // Only on the empty grid. Two taps on a block is two taps on a block.
        if ((e.target as HTMLElement).closest('[data-block]')) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onAddAt(pointIn(spec, rect, e.clientX, e.clientY).minutes);
      }}
      style={{ position: 'relative', height: hours.length * ROW, ...style }}
    >
      {hours.map((h, i) => (
        <div
          key={h}
          style={{
            position: 'absolute',
            top: i * ROW,
            left: 0,
            right: 0,
            height: ROW,
            borderTop: '1px solid var(--app-line-soft)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: -7,
              left: 0,
              width: GUTTER - 10,
              textAlign: 'right',
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(10px * var(--text-scale, 1))',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: 0.4,
            }}
          >
            {ampm(h)}
          </span>
        </div>
      ))}

      {now !== null && now >= lo * 60 && now <= hi * 60 && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: top(now),
            left: GUTTER - 4,
            right: 0,
            height: 1,
            background: 'var(--app-accent)',
            opacity: 0.8,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: -5,
              top: -3,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--app-accent)',
            }}
          />
        </div>
      )}

      {sorted.map((b, i) => {
        // A class is its course's colour; anything of yours is its kind's.
        const own = b.kind === null;
        const tint = own ? courseTint(b.c).fill : kindTint(b.kind, light);
        const lane = laneOf[i];
        const width = `calc((100% - ${GUTTER}px) / ${widthOf[i]})`;
        const Tag = b.onClick ? 'button' : 'div';
        const movable = Boolean(onMove) && (canMove ? canMove(b) : true);
        const holding = drag.held?.id === b.id;
        // Clamped to the grid: an 11:59pm deadline is a minute short of the
        // bottom of the day, and drawn straight it hangs below the last row
        // over whatever the screen put under it. See `lib/hourplace.ts`.
        const box = placeBlock({
          at: b.at,
          minutes: b.minutes,
          startHour: lo,
          endHour: hi,
          rowPx: ROW,
          minHeight: 22,
        });
        return (
          <Tag
            key={b.id}
            data-block=""
            {...(b.onClick
              ? {
                  type: 'button' as const,
                  onClick: () => {
                    // The click that ends a drag is not a tap on the block.
                    if (drag.tookDrop()) return;
                    b.onClick?.();
                  },
                  className: 'bare',
                }
              : {})}
            {...(movable ? drag.handlers(b) : {})}
            // The kind is a 2px tinted border and nothing else; cancelled is
            // an opacity and a line-through. Neither survives being read out.
            aria-label={blockLabel(b.title, b.kind, clock(b.at), b.meta, b.canceled)}
            style={{
              position: 'absolute',
              top: box.top,
              left: `calc(${GUTTER}px + ${lane} * ${width})`,
              width,
              height: box.height,
              overflow: 'hidden',
              textAlign: 'left',
              padding: '4px 8px',
              borderLeft: `2px solid ${tint}`,
              borderRadius: 'var(--r-sm)',
              background: 'var(--app-panel)',
              /*
               * A class is washed in its course's colour; anything of yours
               * carries its kind on the edge and nothing more.
               *
               * Both were a panel with a tinted edge, which was fine while
               * every class shared one edge colour and stopped being fine the
               * moment they did not: a shift tinted for Work and a class
               * tinted for a course that happens to sit near that hue read as
               * the same kind of thing. Filled versus outlined is a
               * difference that survives the two colours being close, and it
               * says the true thing about them — one is the syllabus's, the
               * other is yours.
               *
               * Layered rather than replacing the panel, so the wash lands on
               * the surface the block actually sits on. `tint.test.ts` holds
               * the title's contrast over it.
               */
              backgroundImage: own ? `linear-gradient(${courseTint(b.c).wash}, ${courseTint(b.c).wash})` : undefined,
              boxShadow: '0 1px 0 var(--app-line-top) inset',
              opacity: holding ? 0.4 : b.canceled ? 0.45 : 1,
              // Only while held, so the page still scrolls under a finger.
              ...(holding ? { touchAction: 'none' as const } : {}),
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                lineHeight: 1.2,
                textDecoration: b.canceled ? 'line-through' : 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {b.title}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 'calc(10.5px * var(--text-scale, 1))',
                opacity: 0.6,
                marginTop: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {clock(b.at)} · {b.meta}
            </span>
          </Tag>
        );
      })}
    </div>
  );
}
