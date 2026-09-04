import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { ask, configured, provider } from '../lib/claude';
import {
  EVENING_SYSTEM,
  MORNING_SYSTEM,
  committedToday,
  evening,
  eveningBrief,
  eveningLine,
  morning,
  morningBrief,
  morningLine,
  type DayInput,
} from '../lib/brief';
import { showHours } from '../lib/activities';

/**
 * The day, at both ends of it.
 *
 * The app already knew everything either report needs. What it never did was
 * put it in one place at the two moments it is worth reading — before the day
 * starts, and after it ends. Between those, Today is the right screen; at
 * those, a list of nine sections is not.
 *
 * Every number here is counted from the store by `lib/brief.ts`. Claude is
 * given the finished counts and asked for two or three sentences of judgement
 * — what to do first, what is quietly slipping — and told never to restate a
 * figure differently or invent one. The reports work with no Claude at all:
 * the counts and the lists are the substance and the paragraph is the garnish.
 */
export function Brief({ bare = false }: { bare?: boolean } = {}) {
  const { state, dispatch, now, catalog } = useStore();

  // Morning before four in the afternoon, evening after — the reports are
  // both always reachable, this only decides which opens.
  const [when, setWhen] = useState<'morning' | 'evening'>(
    now.getHours() < 16 ? 'morning' : 'evening',
  );
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  const trouble = useTrouble();
  const abort = useRef<AbortController | null>(null);

  const input: DayInput = useMemo(
    () => ({
      catalog,
      now,
      done: state.done,
      tasks: state.tasks,
      appointments: state.appointments,
      commitments: state.commitments,
      reviews: state.reviews,
    }),
    [catalog, now, state.done, state.tasks, state.appointments, state.commitments, state.reviews],
  );

  const am = useMemo(() => morning(input), [input]);
  const pm = useMemo(() => evening(input), [input]);
  const code = (id: string) => catalog.byId[id]?.code ?? id;
  const committed = committedToday(state.commitments, now);

  const read = async () => {
    if (busy) return;
    setBusy(true);
    trouble.clear();
    setSaid('');
    abort.current = new AbortController();
    let sofar = '';
    try {
      await ask({
        signal: abort.current.signal,
        maxTokens: 500,
        system: when === 'morning' ? MORNING_SYSTEM : EVENING_SYSTEM,
        messages: [
          {
            role: 'user',
            content:
              when === 'morning' ? morningBrief(am, code) : eveningBrief(pm, code),
          },
        ],
        onText: (chunk) => {
          sofar += chunk;
          setSaid(sofar);
        },
      });
    } catch (e) {
      trouble.failed(e, () => void read());
    } finally {
      setBusy(false);
    }
  };

  const row = (label: string, value: string, onClick?: () => void) => (
    <button
      key={label}
      type="button"
      className="bare tappable"
      disabled={!onClick}
      onClick={onClick}
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
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.3 }}>{label}</span>
      <span style={{ flex: 'none', fontSize: 11.5, opacity: 0.55 }}>{value}</span>
    </button>
  );

  return (
    <div style={{ padding: bare ? 0 : 18 }}>
      <Segmented
        options={[
          { id: 'morning', label: 'Start of day' },
          { id: 'evening', label: 'End of day' },
        ]}
        value={when}
        onChange={(next) => {
          setWhen(next);
          setSaid('');
          trouble.clear();
        }}
        style={{ marginBottom: 16 }}
      />

      <Blueprint style={{ padding: '15px 16px' }}>
        <div className="kicker">
          {now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
        <div
          className="chrome-text"
          style={{ fontSize: 24, lineHeight: 1.15, marginTop: 6, textWrap: 'pretty' }}
        >
          {when === 'morning' ? morningLine(am) : eveningLine(pm)}
        </div>
      </Blueprint>

      {when === 'morning' ? (
        <>
          <SectionLabel>Due today</SectionLabel>
          {am.dueToday.length === 0 ? (
            <div style={{ fontSize: 13.5, opacity: 0.55, padding: '10px 0' }}>
              Nothing from a syllabus.
            </div>
          ) : (
            am.dueToday.map((i) =>
              row(`${code(i.c)} · ${i.title}`, i.dueTime, () =>
                dispatch({ type: 'openItem', id: i.id }),
              ),
            )
          )}

          <SectionLabel>On today</SectionLabel>
          {am.classes.length === 0 && am.commitments.length === 0 ? (
            <div style={{ fontSize: 13.5, opacity: 0.55, padding: '10px 0' }}>
              No classes and nothing committed.
            </div>
          ) : (
            <>
              {am.classes.map((c) => row(c.title, c.time))}
              {am.commitments.map((c) => row(c.title, c.time))}
            </>
          )}
          {committed > 0 && (
            <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 8 }}>
              {showHours(committed)} of that is a commitment rather than a class.
            </div>
          )}

          {am.tasks.length > 0 && (
            <>
              <SectionLabel>Yours</SectionLabel>
              {am.tasks.map((t) => row(t.title, t.date === null ? '' : t.date.slice(5)))}
            </>
          )}

          <SectionLabel>Behind that</SectionLabel>
          {am.overdue > 0
            ? row(
                `${am.overdue} went by unticked`,
                'see them',
                () => {
                  dispatch({ type: 'setDueTab', tab: 'overdue' });
                  dispatch({ type: 'setCoursesTab', tab: 'due' });
                  dispatch({ type: 'go', screen: 'courses' });
                },
              )
            : row('Nothing overdue', '')}
          {am.next
            ? row(`Next: ${code(am.next.c)} · ${am.next.title}`, am.next.dueShort, () =>
                dispatch({ type: 'openItem', id: am.next!.id }),
              )
            : null}
        </>
      ) : (
        <>
          <SectionLabel>What you did</SectionLabel>
          {pm.ticked.length === 0 && pm.tasksDone === 0 ? (
            <div style={{ fontSize: 13.5, opacity: 0.55, padding: '10px 0', lineHeight: 1.5 }}>
              Nothing ticked off. A day with classes, a job and no boxes ticked is a normal day.
            </div>
          ) : (
            <>
              {pm.ticked.map((i) => row(`${code(i.c)} · ${i.title}`, 'done'))}
              {pm.tasksDone > 0 &&
                row(`${pm.tasksDone} of your own tasks`, 'done')}
            </>
          )}

          {pm.missed.length > 0 && (
            <>
              <SectionLabel>Still open from today</SectionLabel>
              {pm.missed.map((i) =>
                row(`${code(i.c)} · ${i.title}`, i.dueTime, () =>
                  dispatch({ type: 'openItem', id: i.id }),
                ),
              )}
            </>
          )}

          <SectionLabel>Tomorrow</SectionLabel>
          {pm.tomorrow.length === 0 && pm.tomorrowClasses.length === 0 ? (
            <div style={{ fontSize: 13.5, opacity: 0.55, padding: '10px 0' }}>
              Nothing due and no classes.
            </div>
          ) : (
            <>
              {pm.tomorrow.map((i) => row(`${code(i.c)} · ${i.title}`, i.dueTime))}
              {pm.tomorrowClasses.map((c) => row(c.title, c.time))}
            </>
          )}

          <SectionLabel>Standing</SectionLabel>
          {row(`${pm.tasksLeft} of your own tasks still open`, '')}
          {pm.cardsSeen > 0 &&
            row(`${pm.cardsSeen} cards drilled`, `right ${pm.accuracy}% of the time`)}
          {row(`${pm.overdue} overdue across the semester`, '')}
        </>
      )}

      {/*
        The report answers "what is today". The week ahead answers the question
        people actually get wrong, which is whether the next seven days are
        survivable — so it sits under both halves rather than only the morning
        one, because the evening is when somebody looks past tomorrow.
      */}
      <SectionLabel>Further out</SectionLabel>
      <Blueprint
        onClick={() => dispatch({ type: 'go', screen: 'weekly' })}
        style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}
      >
        <span style={{ width: 6, height: 30, background: 'var(--chrome)', flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, lineHeight: 1.3 }}>
            This week’s report
          </span>
          <span style={{ display: 'block', fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>
            What happened, what slipped, and what next week holds.
          </span>
        </span>
      </Blueprint>
      <div style={{ height: 8 }} />
      <Blueprint
        onClick={() => dispatch({ type: 'go', screen: 'ahead' })}
        style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}
      >
        <span style={{ width: 6, height: 30, background: 'var(--chrome)', flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, lineHeight: 1.3 }}>
            The week ahead, in hours
          </span>
          <span style={{ display: 'block', fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>
            What is promised, what is due, and where the room is.
          </span>
        </span>
      </Blueprint>

      {configured() && (
        <>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void read()}
            disabled={busy}
            style={{ height: 46, marginTop: 18, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {busy ? 'Reading it…' : 'What should I make of this?'}
          </button>
          {said ? (
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                marginTop: 12,
                padding: 14,
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--app-line)',
                background: 'var(--app-panel)',
              }}
            >
              {said}
            </div>
          ) : null}
          <Trouble said={trouble.said} onRetry={trouble.again} busy={Boolean(busy)} />
          <div style={{ fontSize: 11, opacity: 0.45, marginTop: 10, lineHeight: 1.45 }}>
            Every number above is counted from your own data. {provider()} only reads the counts — it is
            told never to restate one differently or invent one.
          </div>
        </>
      )}

      <PrintButton label="Print this report" style={{ marginTop: 12 }} />
      <div style={{ height: 26 }} />
    </div>
  );
}
