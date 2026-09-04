/**
 * Recruiting deadlines on Today, next to the coursework they collide with.
 *
 * This is the whole reason applications live in the app rather than in a
 * spreadsheet. A first-round application closing on the same Friday as a paper
 * is one Friday, and a student looking at two different tools sees two
 * comfortable-looking weeks instead of one impossible day.
 *
 * Fourteen days, matching the clash detector's horizon, so what appears here
 * and what the collision warning counts are the same fortnight.
 */

import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { ahead, missed, title, type Standing } from '../lib/apply';

const HORIZON = 14;

function Row({ s, onOpen, late }: { s: Standing; onOpen: () => void; late?: boolean }) {
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={onOpen}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '10px 13px',
        borderRadius: 'var(--r-md)',
        border: `1px solid ${late ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
        background: late ? 'var(--app-warn-wash)' : 'transparent',
      }}
    >
      <span className="kicker" style={{ display: 'block' }}>
        {late
          ? `${-s.daysAway} ${-s.daysAway === 1 ? 'day' : 'days'} ago`
          : s.daysAway === 0
            ? 'Today'
            : s.daysAway === 1
              ? 'Tomorrow'
              : `In ${s.daysAway} days`}
      </span>
      <span
        style={{
          display: 'block',
          fontSize: 'calc(13.5px * var(--text-scale, 1))',
          marginTop: 3,
          lineHeight: 1.4,
          textWrap: 'pretty',
        }}
      >
        {s.says}
      </span>
    </button>
  );
}

/** The Today section. Nothing at all when there is nothing dated. */
export function ApplyingSoon() {
  const { state, dispatch, now } = useStore();
  const soon = ahead(state.applications, now, HORIZON);
  // Only what is your own to do is chased when it has gone by. A closing date
  // that has passed is not a task, it is a fact, and a warning about it every
  // morning until it is archived is how a feed stops being read.
  const late = missed(state.applications, now).filter((s) => s.what === 'next');
  if (soon.length === 0 && late.length === 0) return null;

  const open = () => dispatch({ type: 'go', screen: 'applying' });

  return (
    <div style={{ marginTop: 14 }}>
      <SectionLabel style={{ margin: '0 0 8px' }}>Applications</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {late.map((s) => (
          <Row key={s.id} s={s} onOpen={open} late />
        ))}
        {soon.map((s) => (
          <Row key={s.id} s={s} onOpen={open} />
        ))}
      </div>
    </div>
  );
}

/** What one day carries, for the calendar's day view. */
export function ApplyingOn({ day }: { day: Date }) {
  const { state, dispatch, now } = useStore();
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const onDay = ahead(state.applications, now, 365)
    .concat(missed(state.applications, now))
    .filter((s) => s.date === iso);
  if (onDay.length === 0) return null;

  return (
    <>
      <SectionLabel style={{ margin: '20px 0 8px' }}>Applications</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {onDay.map((s) => (
          <button
            key={s.id}
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'go', screen: 'applying' })}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 13px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--app-line)',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 'calc(13.5px * var(--text-scale, 1))',
                lineHeight: 1.4,
                textWrap: 'pretty',
              }}
            >
              {s.says}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                opacity: 0.6,
                marginTop: 2,
              }}
            >
              {s.what === 'due' ? 'Application deadline' : title(s.application)}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
