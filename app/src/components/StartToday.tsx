/**
 * What has to *begin* today.
 *
 * Every other row in this app is an end date. Almost no student
 * procrastination is a forgotten deadline — it is a missing start date, and
 * the paper due on the 30th is perfectly well known about on the 12th.
 *
 * Each row carries a first action, because "Opera Philadelphia case, 30% of
 * the grade" is paralysing and "read the case once and write down what it is
 * actually asking" is not. Those openers are generic by kind and the screen
 * says so — the app has not read the assignment.
 *
 * Nothing at all on a day where nothing has to start, which is most days.
 */

import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { datedItems } from '../lib/select';
import { beginNow, plan, planLine } from '../lib/start';
import { calibrate } from '../lib/worth';

export function StartToday() {
  const { state, dispatch, now, catalog } = useStore();
  const bias = calibrate(
    state.spent
      .filter((s) => typeof s.guess === 'number')
      .map((s) => ({ guess: s.guess ?? 0, minutes: s.minutes })),
  );
  const p = plan({
    items: datedItems(catalog, now),
    done: state.done,
    spent: state.spent,
    windows: state.windows,
    now,
    bias,
  });
  const list = beginNow(p);
  if (list.length === 0) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <SectionLabel style={{ margin: '0 0 8px' }}>Begin today</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'openItem', id: s.id })}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '11px 13px',
              borderRadius: 'var(--r-md)',
              border: `1px solid ${s.late ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
              background: s.late ? 'var(--app-warn-wash)' : 'transparent',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 'calc(13.5px * var(--text-scale, 1))',
                lineHeight: 1.35,
                textWrap: 'pretty',
              }}
            >
              {s.title}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                opacity: 0.62,
                marginTop: 3,
                textWrap: 'pretty',
              }}
            >
              {[catalog.byId[s.courseId]?.code, `due in ${s.daysAway}d`, s.says]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                marginTop: 6,
                lineHeight: 1.45,
                textWrap: 'pretty',
              }}
            >
              {s.first}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Every start date ahead, for a screen somebody opened to look at the shape of
 * a fortnight.
 *
 * The Today section only fires on the exact day something has to begin, which
 * is right for Today and makes the whole idea nearly invisible: driving it on
 * real data showed a ten-hour paper whose start date was two days off, and
 * nothing anywhere said so. This is where that gets seen.
 *
 * Ordered by start date rather than by deadline, which is the entire point.
 */
export function StartList() {
  const { state, dispatch, now, catalog } = useStore();
  const bias = calibrate(
    state.spent
      .filter((s) => typeof s.guess === 'number')
      .map((s) => ({ guess: s.guess ?? 0, minutes: s.minutes })),
  );
  const p = plan({
    items: datedItems(catalog, now),
    done: state.done,
    spent: state.spent,
    windows: state.windows,
    now,
    bias,
    horizon: 21,
  });
  if (p.starts.length === 0) return null;

  return (
    <>
      <SectionLabel style={{ margin: 'calc(24px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>
        When to begin
      </SectionLabel>
      <div
        style={{
          fontSize: 'calc(12px * var(--text-scale, 1))',
          opacity: 0.68,
          marginBottom: 9,
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        {planLine(p, state.windows)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {p.starts.map((s) => (
          <button
            key={s.id}
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'openItem', id: s.id })}
            style={{
              display: 'flex',
              gap: 11,
              alignItems: 'baseline',
              width: '100%',
              textAlign: 'left',
              padding: '10px 13px',
              borderRadius: 'var(--r-md)',
              border: `1px solid ${s.late ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
              background: s.late ? 'var(--app-warn-wash)' : 'transparent',
              opacity: s.startOn ? 1 : 0.6,
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 'calc(13px * var(--text-scale, 1))',
                  lineHeight: 1.35,
                  textWrap: 'pretty',
                }}
              >
                {s.title}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'calc(11.5px * var(--text-scale, 1))',
                  opacity: 0.62,
                  marginTop: 3,
                  textWrap: 'pretty',
                }}
              >
                {[catalog.byId[s.courseId]?.code, `due in ${s.daysAway}d`, s.says]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            {s.minutes ? (
              <span
                style={{
                  fontSize: 'calc(11.5px * var(--text-scale, 1))',
                  opacity: 0.55,
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Math.round((s.minutes / 60) * 10) / 10}h
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <p
        style={{
          fontSize: 'calc(11px * var(--text-scale, 1))',
          opacity: 0.5,
          marginTop: 10,
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        Worked backwards through the hours your windows actually offer, taking half of any day
        for any one piece of work — you have other courses. Work the app has never timed gets no
        start date rather than a guessed one.
      </p>
    </>
  );
}
