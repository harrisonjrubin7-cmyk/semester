import { useMemo, useRef, useState } from 'react';
import { Produced } from '../components/Produced';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { Insights } from '../components/Insights';
import { insights } from '../insights';
import { factsFrom } from '../insights/facts';
import { PrintButton } from '../components/PrintButton';
import { ask, configured, provider } from '../lib/claude';
import { download } from '../lib/deliver';
import { showHours, week } from '../lib/ahead';
import {
  SYSTEM,
  behind,
  behindLine,
  brief,
  document as asDocument,
  slippedLine,
  weekLabel,
  weekStart,
  type Ahead,
} from '../lib/weekly';

/**
 * The week that happened, and the one coming.
 *
 * "How did this week go" is a question everyone asks on a Sunday and nobody
 * has the data to answer, so it gets answered from whatever happens to be
 * memorable — which is the thing that went wrong. The app has the data: what
 * was ticked, what went by, what was drilled, what was sat, and what next week
 * already holds.
 *
 * Every figure is counted in `lib/weekly.ts` and `lib/ahead.ts`. The model is
 * handed the finished counts and asked for three or four sentences, and told
 * not to score the week — a week with three classes, a shift at work and two
 * ticked boxes is a normal week, and a report that called it a bad one would
 * be both wrong and the last one anybody read.
 */
export function Weekly() {
  const { state, dispatch, now, catalog } = useStore();

  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  const trouble = useTrouble();
  const [kept, setKept] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const back = useMemo(
    () =>
      behind({
        catalog,
        now,
        done: state.done,
        tickedAt: state.tickedAt,
        tasks: state.tasks,
        sittings: state.sittings,
        reviews: state.reviews,
      }),
    [catalog, now, state.done, state.tickedAt, state.tasks, state.sittings, state.reviews],
  );

  // Next week rather than the next seven days: this report is read at the end
  // of one week about the start of another, so it should not be half this one.
  const nextWeek = useMemo(() => {
    const start = weekStart(now);
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  }, [now]);

  const forward = useMemo(
    () =>
      week({
        catalog,
        from: nextWeek,
        done: state.done,
        commitments: state.commitments,
        appointments: state.appointments,
        windows: state.windows,
      }),
    [catalog, nextWeek, state.done, state.commitments, state.appointments, state.windows],
  );

  const ahead: Ahead = {
    promised: forward.promised,
    due: forward.due,
    heaviest: forward.heaviest ? `${forward.heaviest.name}, ${showHours(forward.heaviest.promised)}` : '',
    freest: forward.freest ? forward.freest.name : '',
  };

  const code = (id: string) => catalog.byId[id]?.code ?? id;

  // The same findings the screen shows, so a saved report is the report.
  const found = useMemo(
    () => insights(factsFrom(state, catalog, now)).slice(0, 3),
    [state, catalog, now],
  );

  const title = `Week of ${back.label}`;

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
        maxTokens: 700,
        system: SYSTEM,
        messages: [{ role: 'user', content: brief(back, ahead, code) }],
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

  const row = (label: string, right: string, onClick?: () => void) => (
    <button
      key={label}
      type="button"
      className="bare tappable"
      disabled={!onClick}
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 'var(--sp-6)',
        alignItems: 'baseline',
        width: '100%',
        padding: '10px 0',
        borderBottom: '1px solid var(--app-line)',
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>{label}</span>
      <span style={{ flex: 'none', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55 }}>{right}</span>
    </button>
  );

  return (
    <Page bottom={26}>
      <Blueprint style={{ padding: '15px 16px' }}>
        <div className="kicker">{back.label}</div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(24px * var(--text-scale, 1))', lineHeight: 1.15, marginTop: 'var(--sp-3)', textWrap: 'pretty' }}
        >
          {behindLine(back)}
        </div>
        {slippedLine(back) ? (
          <div style={{ fontSize: 'var(--type-base)', opacity: 0.7, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
            {slippedLine(back)}
          </div>
        ) : null}
      </Blueprint>

      <Insights />

      {back.done.length > 0 && (
        <>
          <SectionLabel>Finished</SectionLabel>
          {back.done.map((i) =>
            row(`${code(i.c)} · ${i.title}`, 'done', () =>
              dispatch({ type: 'openItem', id: i.id }),
            ),
          )}
        </>
      )}

      {back.slipped.length > 0 && (
        <>
          <SectionLabel>Still open from this week</SectionLabel>
          {back.slipped.map((i) =>
            row(`${code(i.c)} · ${i.title}`, i.dueShort, () =>
              dispatch({ type: 'openItem', id: i.id }),
            ),
          )}
        </>
      )}

      <SectionLabel>Also this week</SectionLabel>
      {row(`${back.tasksDone} of your own tasks done`, back.tasksOpen > 0 ? `${back.tasksOpen} open` : '')}
      {row(`${back.cardsDrilled} cards drilled`, '')}
      {back.papers.length > 0
        ? back.papers.map((p) =>
            row(`${code(p.courseId)} practice paper`, `${p.pct}%`),
          )
        : row('No practice papers sat', '')}

      <SectionLabel>The week coming</SectionLabel>
      <Blueprint style={{ padding: '13px 14px' }}>
        <div style={{ fontSize: 'var(--type-lg)', lineHeight: 1.4 }}>
          {showHours(forward.promised)} already promised
          {forward.due.length > 0
            ? `, ${forward.due.length} ${forward.due.length === 1 ? 'deadline' : 'deadlines'}`
            : ' and nothing due'}
          .
        </div>
        {forward.heaviest ? (
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>
            {forward.heaviest.name} carries most of it, at {showHours(forward.heaviest.promised)}
            {forward.freest && forward.freest !== forward.heaviest
              ? `; ${forward.freest.name} has the most room`
              : ''}
            .
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'ahead' })}
          style={{ height: 40, marginTop: 'var(--sp-5)' }}
        >
          Hour by hour
        </button>
      </Blueprint>

      {forward.due.length > 0 && (
        <>
          <SectionLabel>Due next week</SectionLabel>
          {forward.due.map((i) =>
            row(`${code(i.c)} · ${i.title}`, i.dueShort, () =>
              dispatch({ type: 'openItem', id: i.id }),
            ),
          )}
        </>
      )}

      {configured() && (
        <>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void read()}
            disabled={busy}
            style={{ height: 46, marginTop: 18, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {busy ? 'Reading it…' : 'What should I make of this week?'}
          </button>
          {said ? (
            <Produced style={{ marginTop: 'var(--sp-6)', background: 'var(--app-panel)' }}>
              {said}
            </Produced>
          ) : null}
          <Trouble said={trouble.said} onRetry={trouble.again} busy={Boolean(busy)} />
          <div style={{ fontSize: 'var(--type-xs)', opacity: 0.45, marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
            Every number above is counted from your own data. {provider()} reads the counts and is
            told not to score the week — a week with three classes, a shift and two ticked boxes is
            a normal week.
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 14 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            download({
              name: `week-${weekLabel(weekStart(now)).replace(/[^\w]+/g, '-').toLowerCase()}.md`,
              body: asDocument(back, ahead, code, said, found),
              mime: 'text/markdown',
            })
          }
          style={{ flex: 1, height: 42 }}
        >
          Save it
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            dispatch({
              type: 'keepNote',
              title,
              body: asDocument(back, ahead, code, said, found),
              courseId: null,
            });
            setKept(true);
          }}
          style={{ flex: 1, height: 42 }}
        >
          {kept ? 'Kept' : 'Keep as note'}
        </button>
      </div>
      <PrintButton label="Print the week" style={{ marginTop: 'var(--sp-4)' }} />
      <div style={{ fontSize: 'var(--type-xs)', opacity: 0.45, marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
        A deadline counts to the week you ticked it.
        {back.staleTicks > 0
          ? ` ${back.staleTicks} of these ${back.staleTicks === 1 ? 'was' : 'were'} ticked before the app started recording the moment, so ${back.staleTicks === 1 ? 'it counts' : 'they count'} to the week ${back.staleTicks === 1 ? 'it was' : 'they were'} due instead.`
          : ''}
      </div>
    </Page>
  );
}
