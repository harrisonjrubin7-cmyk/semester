import { useMemo } from 'react';
import { useStore } from '../state/store';
import { ClashList, DayBudget } from '../components/Clashes';
import { StartList } from '../components/StartToday';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { headline, pressure, showHours, studyAsked, week } from '../lib/ahead';
import { askedLine, forecast } from '../lib/pace';
import { basisLine } from '../lib/windows';
import { due, isReading, plan, planLine, size, typicalExtent } from '../lib/reading';
import { datedItems } from '../lib/select';
import { DOW, decorateItem } from '../lib/date';

/**
 * The next seven days, in hours, before they happen.
 *
 * Everything here was already in the app and was only ever shown a day at a
 * time. A day at a time is the wrong resolution for the question people
 * actually get wrong, which is not "what is on today" but "is this week
 * survivable, and if not, which evening was I going to lose".
 *
 * There is no readiness score and there will not be one. Hours promised and
 * deadlines due, side by side, with the arithmetic visible — a single number
 * combining them would need a weight for how long a paper takes, which the app
 * cannot know and which would be believed anyway.
 */
export function Ahead() {
  const { state, dispatch, now, catalog } = useStore();

  const w = useMemo(
    () =>
      week({
        catalog,
        from: now,
        done: state.done,
        commitments: state.commitments,
        appointments: state.appointments,
        windows: state.windows,
      }),
    [catalog, now, state.done, state.commitments, state.appointments, state.windows],
  );

  const asked = useMemo(() => studyAsked(catalog), [catalog]);

  // Readings due in the window, sized from your own pace and placed on days
  // with room. Everything here is counted in `lib/reading.ts`.
  const readings = useMemo(() => {
    const items = datedItems(catalog, now);
    const ahead = due(items, state.done, 7).map((i) => decorateItem(i, now));
    const typical = typicalExtent(items.filter(isReading));
    return plan({
      readings: ahead.map((i) => size(i, state.spent, typical)),
      days: w.days.map((d) => ({ date: d.date, promised: d.promised })),
      windows: state.windows,
      now,
    });
  }, [catalog, now, state.done, state.spent, state.windows, w.days]);

  // The half of the week the app could never count until it was told. Every
  // figure comes from work this student has timed; anything else is left out
  // and counted, never estimated. See `lib/pace.ts`.
  const mine = useMemo(
    () => askedLine(forecast(state.spent, w.due.map((i) => ({ c: i.c, kind: i.kind })))),
    [state.spent, w.due],
  );
  const code = (id: string) => catalog.byId[id]?.code ?? id;
  const most = Math.max(1, ...w.days.map((d) => d.promised));

  return (
    <div style={{ padding: 18 }}>
      {/* Before the totals: somebody who opened this screen came to see the
          shape of the fortnight, and a day that will not fit is the shape. */}
      <ClashList />
      <DayBudget />

      {/* Start dates, which are the half this app never had. Ordered by when
          something must begin rather than when it is due. */}
      <StartList />

      <Blueprint style={{ padding: '15px 16px', marginTop: 14 }}>
        <div className="kicker">The next seven days</div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(22px * var(--text-scale, 1))', lineHeight: 1.2, marginTop: 6, textWrap: 'pretty' }}
        >
          {headline(w)}
        </div>
        {pressure(w) ? (
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.7, marginTop: 8, lineHeight: 1.5 }}>
            {pressure(w)}
          </div>
        ) : null}
      </Blueprint>

      <SectionLabel>Day by day</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {w.days.map((d) => (
          <div
            key={d.date.toISOString()}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              padding: '9px 0',
              borderBottom: '1px solid var(--app-line-soft)',
            }}
          >
            <span
              style={{
                flex: 'none',
                width: 34,
                fontFamily: 'var(--font-heading)',
                fontSize: 'calc(13px * var(--text-scale, 1))',
                opacity: 0.7,
              }}
            >
              {d.name}
            </span>
            {/* The bar is the day against the week's heaviest, so the shape of
                the week reads before any of the numbers do. */}
            <span
              style={{
                flex: 1,
                minWidth: 0,
                height: 14,
                background: 'var(--app-track)',
                borderRadius: 2,
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <span
                style={{
                  width: `${(d.promised / most) * 100}%`,
                  background: 'var(--chrome)',
                  display: 'block',
                }}
              />
            </span>
            <span
              style={{
                flex: 'none',
                width: 62,
                textAlign: 'right',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                opacity: 0.6,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {d.promised === 0 ? '—' : showHours(d.promised)}
            </span>
            <span
              style={{
                flex: 'none',
                width: 18,
                textAlign: 'right',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                color: d.due.length > 0 ? 'var(--app-warn)' : 'transparent',
              }}
            >
              {d.due.length > 0 ? `●${d.due.length > 1 ? d.due.length : ''}` : '·'}
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
        Classes and commitments at the length they meet for; an appointment counted as an hour,
        because it has a start and no end. A dot marks a day with something due on it.
      </div>

      {/*
        Readings, placed. The rest of this screen counts hours; this is the one
        part that says which evening. See `lib/reading.ts` — a reading that
        fits nowhere is reported as not fitting rather than squeezed in, which
        is the sentence an app that always finds room can never say.
      */}
      {(readings.placed.length > 0 || readings.unplaced.length > 0 || readings.unsized.length > 0) && (
        <>
          <SectionLabel>Reading, and where it goes</SectionLabel>
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.75, lineHeight: 1.5, marginBottom: 8 }}>
            {planLine(readings)}
          </div>
          {readings.placed.map((p) => (
            <button
              key={p.item.id}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'openItem', id: p.item.id })}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'baseline',
                width: '100%',
                padding: '10px 0',
                borderBottom: '1px solid var(--app-line)',
                textAlign: 'left',
              }}
            >
              <span style={{ flex: 'none', width: 40, fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6 }}>
                {DOW[p.on.getDay()]}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>
                {p.item.title}
                <span style={{ opacity: 0.5 }}> · {code(p.item.c)}</span>
              </span>
              <span style={{ flex: 'none', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55 }}>
                {p.minutes >= 60 ? `${Math.round((p.minutes / 60) * 10) / 10}h` : `${p.minutes}m`}
              </span>
            </button>
          ))}
          {readings.unplaced.map((s) => (
            <div
              key={s.item.id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'baseline',
                padding: '10px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span style={{ flex: 'none', width: 40, fontSize: 'calc(12px * var(--text-scale, 1))', color: 'var(--app-warn)' }}>
                —
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35, opacity: 0.75 }}>
                {s.item.title}
                <span style={{ opacity: 0.6 }}> · due {s.item.dueShort}, and no day has room</span>
              </span>
            </div>
          ))}
          {readings.unsized.length > 0 && (
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
              {readings.unsized.length} could not be sized — the app has not seen you time a
              reading in that course yet, and it will not invent one.
            </div>
          )}
        </>
      )}

      {w.due.length > 0 && (
        <>
          <SectionLabel>Due in the window</SectionLabel>
          {w.due.map((i) => (
            <button
              key={i.id}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'openItem', id: i.id })}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'baseline',
                width: '100%',
                padding: '11px 0',
                borderBottom: '1px solid var(--app-line)',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  flex: 'none',
                  width: 66,
                  fontSize: 'calc(11.5px * var(--text-scale, 1))',
                  opacity: 0.55,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {i.dueShort}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>
                {i.title}
                <span style={{ opacity: 0.5 }}> · {code(i.c)}</span>
              </span>
            </button>
          ))}
        </>
      )}

      <SectionLabel>What is left over</SectionLabel>
      <Blueprint style={{ padding: '13px 14px' }}>
        <div style={{ fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.4 }}>
          {w.shape.fromWindows
            ? `${showHours(w.spare)} left, of the ${showHours(w.shape.offered)} you work in.`
            : `${showHours(w.spare)} of waking time, after everything already promised.`}
        </div>
        {asked.stated > 0 ? (
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, marginTop: 7, lineHeight: 1.5 }}>
            Your syllabi ask for about {showHours(asked.hours)} of study a week
            {asked.stated < asked.total
              ? ` — and that is only the ${asked.stated} of ${asked.total} courses that say so`
              : ''}
            .
          </div>
        ) : null}
        {mine ? (
          <div
            style={{
              fontSize: 'calc(13px * var(--text-scale, 1))',
              marginTop: 9,
              paddingTop: 9,
              borderTop: '1px solid var(--app-line)',
              lineHeight: 1.5,
            }}
          >
            {mine}
          </div>
        ) : null}
        <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 8, lineHeight: 1.45 }}>
          {basisLine(w.shape)} The coursework estimate is built only from work you have timed
          yourself — the app still invents nothing, and anything it has never seen the like of is
          counted as unknown rather than guessed at.
        </div>
        {!w.shape.fromWindows && (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              dispatch({ type: 'setMeTab', tab: 'settings' });
              dispatch({ type: 'go', screen: 'me' });
            }}
            style={{ height: 38, marginTop: 10, fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
          >
            Set the hours you actually work
          </button>
        )}
      </Blueprint>

      <PrintButton label="Print the week" style={{ marginTop: 14 }} />
      <div style={{ height: 26 }} />
    </div>
  );
}
