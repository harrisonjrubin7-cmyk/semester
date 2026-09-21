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

import { useNow, useStore } from '../state/store';
import { DIMMED_ROW, secondLine } from '../lib/dim';
import { SectionLabel } from './ui';
import { datedItems } from '../lib/select';
import { beginNow, biasOf, planFrom, planLine } from '../lib/start';
import { adjustedLine } from '../lib/worth';
import { Folding } from './Fold';

export function StartToday() {
  const { state, dispatch, catalog, tint } = useStore();
  const now = useNow();
  const p = planFrom({
    items: datedItems(catalog, now),
    done: state.done,
    spent: state.spent,
    windows: state.windows,
    now,
  });
  const bias = biasOf(state.spent);
  const list = beginNow(p);
  if (list.length === 0) return null;

  return (
    <div style={{ marginTop: 'calc(14px * var(--density, 1))' }}>
      <Folding name="StartToday">
      <SectionLabel style={{ marginTop: '0', marginInline: '0', marginBottom: 'calc(8px * var(--density, 1))' }}>Begin today</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            className="bare tappable on-paper"
            onClick={() => dispatch({ type: 'openItem', id: s.id })}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))',
              borderRadius: 'var(--r-md)',
              border: `1px solid ${s.late ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
              background: s.late ? 'var(--app-warn-wash)' : 'transparent',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 'var(--type-base-plus)',
                lineHeight: 'var(--leading-tight-plus)',
                textWrap: 'pretty',
              }}
            >
              {s.title}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 'var(--type-xs-plus)',
                ...secondLine(),
                marginTop: 'calc(3px * var(--density, 1))',
                textWrap: 'pretty',
              }}
            >
              <span style={{ color: tint(s.courseId).ink, opacity: 1 }}>
                {catalog.byId[s.courseId]?.code}
              </span>
              {[`due in ${s.daysAway}d`, s.says].filter(Boolean).map((part) => ` · ${part}`)}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 'var(--type-sm-plus)',
                marginTop: 'var(--sp-3)',
                lineHeight: 'var(--leading-normal)',
                textWrap: 'pretty',
              }}
            >
              {s.first}
            </span>
          </button>
        ))}
      </div>
      {/*
        The correction is applied to every start date above; without this,
        nothing anywhere said so. A number silently moved is a number nobody
        can check. See `lib/worth.ts`.
      */}
      {adjustedLine(bias) ? (
        <div
          style={{
            fontSize: 'var(--type-xs)',
            color: 'var(--app-dim)',
            marginTop: 'var(--sp-4)',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          {adjustedLine(bias)}
        </div>
      ) : null}
      </Folding>
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
  const { state, dispatch, catalog, tint } = useStore();
  const now = useNow();
  const p = planFrom({
    items: datedItems(catalog, now),
    done: state.done,
    spent: state.spent,
    windows: state.windows,
    now,
    horizon: 21,
  });
  const bias = biasOf(state.spent);
  if (p.starts.length === 0) return null;

  return (
    <Folding name="StartList">
      <SectionLabel style={{ marginTop: 'calc(24px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(6px * var(--density, 1))' }}>
        When to begin
      </SectionLabel>
      <div
        style={{
          fontSize: 'var(--type-sm)',
          color: 'var(--app-dim)',
          marginBottom: 'calc(9px * var(--density, 1))',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {planLine(p, state.windows)}
      </div>
      {adjustedLine(bias) ? (
        <div
          style={{
            fontSize: 'var(--type-xs)',
            color: 'var(--app-dim)',
            marginBottom: 'calc(9px * var(--density, 1))',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          {adjustedLine(bias)}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(7px * var(--density, 1))' }}>
        {p.starts.map((s) => (
          <button
            key={s.id}
            type="button"
            className="bare tappable on-paper"
            onClick={() => dispatch({ type: 'openItem', id: s.id })}
            style={{
              display: 'flex',
              gap: 'calc(11px * var(--density, 1))',
              alignItems: 'baseline',
              width: '100%',
              textAlign: 'left',
              paddingBlock: 'calc(10px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))',
              borderRadius: 'var(--r-md)',
              border: `1px solid ${s.late ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
              background: s.late ? 'var(--app-warn-wash)' : 'transparent',
              opacity: s.startOn ? 1 : DIMMED_ROW,
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--type-base)',
                  lineHeight: 'var(--leading-tight-plus)',
                  textWrap: 'pretty',
                }}
              >
                {s.title}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--type-xs-plus)',
                  ...secondLine(!s.startOn),
                  marginTop: 'calc(3px * var(--density, 1))',
                  textWrap: 'pretty',
                }}
              >
                {/* The code in its course's colour. It is the first thing on
                    the line and the only word on it that says whose this is. */}
                <span style={{ color: tint(s.courseId).ink, opacity: 1 }}>
                  {catalog.byId[s.courseId]?.code}
                </span>
                {[`due in ${s.daysAway}d`, s.says].filter(Boolean).map((part) => ` · ${part}`)}
              </span>
            </span>
            {s.minutes ? (
              <span
                style={{
                  fontSize: 'var(--type-xs-plus)',
                  ...secondLine(!s.startOn),
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
          fontSize: 'var(--type-xs)',
          color: 'var(--app-dim)',
          marginTop: 'var(--sp-5)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        Worked backwards through the hours your windows actually offer, taking half of any day
        for any one piece of work — you have other courses. Work the app has never timed gets no
        start date rather than a guessed one.
      </p>
    </Folding>
  );
}
