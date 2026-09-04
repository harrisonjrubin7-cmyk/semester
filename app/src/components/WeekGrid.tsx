import type { CSSProperties } from 'react';
import { CLASS_TINT, kindOf } from '../lib/kinds';
import { DOW_INITIALS } from '../lib/date';
import type { HourBlock } from './HourGrid';
import { lanesOf } from '../lib/weekpage';

/**
 * A week, by the hour — the timetable shape.
 *
 * The day grid answers "what does today look like". This answers the question
 * behind most calendar-opening: *when am I actually free this week*. Seven
 * columns of the same hours make a gap on Thursday afternoon visible in a way
 * that seven separate day views never can, because comparison is the point and
 * comparison needs them side by side.
 *
 * At phone width a column is about forty pixels, so a block shows a short label
 * and nothing else. That is the honest trade: the week view is for shape, and
 * the day view is one tap away for detail. Two things at the same hour split
 * that column between them, which at this width leaves each of them cramped —
 * and cramped is what the day view is one tap away for. It is what the grid
 * did before that was wrong: it drew them one on top of the other, so the one
 * underneath was not merely small but absent.
 */

export interface WeekDay {
  date: Date;
  blocks: HourBlock[];
  isToday: boolean;
  onOpen?: () => void;
}

const ROW = 46;
const GUTTER = 30;

export function WeekGrid({
  days,
  now,
  style,
}: {
  days: WeekDay[];
  /** Minutes past midnight, drawn only across today's column. */
  now: number | null;
  style?: CSSProperties;
}) {
  const all = days.flatMap((d) => d.blocks);
  const starts = all.map((b) => b.at);
  const ends = all.map((b) => b.at + b.minutes);
  const lo = Math.max(0, Math.floor(Math.min(8 * 60, ...starts) / 60) - 1);
  const hi = Math.min(24, Math.ceil(Math.max(17 * 60, ...ends) / 60) + 1);
  const hours = Array.from({ length: hi - lo }, (_, i) => lo + i);
  const top = (m: number) => ((m - lo * 60) / 60) * ROW;
  const col = `calc((100% - ${GUTTER}px) / ${days.length})`;

  return (
    <div className="weekgrid" style={style}>
      {/* Day letters, with the date under, aligned to the columns below. */}
      <div style={{ display: 'flex', paddingLeft: GUTTER, marginBottom: 4 }}>
        {days.map((d) => (
          <button
            key={d.date.toISOString()}
            type="button"
            className="bare"
            onClick={d.onOpen}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: 'center',
              fontFamily: 'var(--font-heading)',
              color: d.isToday ? 'var(--app-accent)' : 'var(--app-fg)',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 'calc(9.5px * var(--text-scale, 1))',
                letterSpacing: '0.12em',
                opacity: d.isToday ? 0.9 : 0.4,
              }}
            >
              {DOW_INITIALS[d.date.getDay()]}
            </span>
            <span style={{ display: 'block', fontSize: 'calc(13px * var(--text-scale, 1))', opacity: d.isToday ? 1 : 0.75 }}>
              {d.date.getDate()}
            </span>
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', height: hours.length * ROW }}>
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
                top: -6,
                left: 0,
                width: GUTTER - 6,
                textAlign: 'right',
                fontFamily: 'var(--font-heading)',
                fontSize: 'calc(9px * var(--text-scale, 1))',
                letterSpacing: '0.06em',
                opacity: 0.4,
              }}
            >
              {h % 12 === 0 ? 12 : h % 12}
              {h < 12 ? 'a' : 'p'}
            </span>
          </div>
        ))}

        {/* Column separators, so a block belongs to a visible day. */}
        {days.map((d, i) =>
          i === 0 ? null : (
            <div
              key={`sep-${d.date.toISOString()}`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `calc(${GUTTER}px + ${i} * ${col})`,
                width: 1,
                background: 'var(--app-line-soft)',
              }}
            />
          ),
        )}

        {days.map((d, di) => {
          // Two things at eleven used to be drawn one on top of the other and
          // neither could be read. See `lib/weekpage.ts`.
          const lanes = lanesOf(d.blocks);
          return d.blocks.map((b) => {
            const tint = b.kind === null ? CLASS_TINT : kindOf(b.kind).tint;
            const { lane, of } = lanes[b.id] ?? { lane: 0, of: 1 };
            const slot = `((${col} - 3px) / ${of})`;
            return (
              <div
                key={`${di}-${b.id}`}
                className="wg-block"
                title={`${b.title} · ${b.meta}`}
                style={{
                  position: 'absolute',
                  top: top(b.at) + 1,
                  left: `calc(${GUTTER}px + ${di} * ${col} + 1px + ${lane} * ${slot})`,
                  width: `calc(${slot})`,
                  height: Math.max(15, (b.minutes / 60) * ROW - 3),
                  overflow: 'hidden',
                  padding: '2px 3px',
                  borderLeft: `2px solid ${tint}`,
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--app-panel)',
                  opacity: b.canceled ? 0.4 : 1,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontSize: 'calc(9px * var(--text-scale, 1))',
                    lineHeight: 1.15,
                    letterSpacing: '0.01em',
                    textDecoration: b.canceled ? 'line-through' : 'none',
                    overflow: 'hidden',
                  }}
                >
                  {b.title}
                </span>
              </div>
            );
          });
        })}

        {now !== null &&
          days.some((d) => d.isToday) &&
          now >= lo * 60 &&
          now <= hi * 60 && (
            <div
              aria-hidden
              className="wg-now"
              style={{
                position: 'absolute',
                top: top(now),
                left: `calc(${GUTTER}px + ${days.findIndex((d) => d.isToday)} * ${col})`,
                width: col,
                height: 1,
                background: 'var(--app-accent)',
              }}
            />
          )}
      </div>
    </div>
  );
}
