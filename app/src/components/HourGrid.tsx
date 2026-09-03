import type { CSSProperties } from 'react';
import { CLASS_TINT, kindOf } from '../lib/kinds';

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
  canceled?: boolean;
  onClick?: () => void;
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
}: {
  blocks: HourBlock[];
  /** Minutes past midnight, or null when this is not today. */
  now: number | null;
  style?: CSSProperties;
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

  return (
    <div style={{ position: 'relative', height: hours.length * ROW, ...style }}>
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
              fontSize: 10,
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
        const tint = b.kind === null ? CLASS_TINT : kindOf(b.kind).tint;
        const lane = laneOf[i];
        const width = `calc((100% - ${GUTTER}px) / ${widthOf[i]})`;
        const Tag = b.onClick ? 'button' : 'div';
        return (
          <Tag
            key={b.id}
            {...(b.onClick ? { type: 'button' as const, onClick: b.onClick, className: 'bare' } : {})}
            style={{
              position: 'absolute',
              top: top(b.at) + 1,
              left: `calc(${GUTTER}px + ${lane} * ${width})`,
              width,
              height: Math.max(22, (b.minutes / 60) * ROW - 3),
              overflow: 'hidden',
              textAlign: 'left',
              padding: '4px 8px',
              borderLeft: `2px solid ${tint}`,
              borderRadius: 'var(--r-sm)',
              background: 'var(--app-panel)',
              boxShadow: '0 1px 0 var(--app-line-top) inset',
              opacity: b.canceled ? 0.45 : 1,
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
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
                fontSize: 10.5,
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
