import { useMemo, useRef, useState } from 'react';
import { Produced } from '../../components/Produced';
import { useStore } from '../../state/store';
import { Trouble } from '../../components/Trouble';
import { useTrouble } from '../../lib/trouble';
import { Blueprint } from '../../components/Blueprint';
import { Group, ItemRow } from '../../components/shell/Rows';
import { Insights } from '../../components/Insights';
import { ActionButton, Segmented } from '../../components/ui';
import { ask, configured, provider } from '../../lib/claude';
import {
  EVENING_SYSTEM,
  MORNING_SYSTEM,
  nameNote,
  committedToday,
  evening,
  eveningBrief,
  eveningLine,
  morning,
  morningBrief,
  morningLine,
  type DayInput,
} from '../../lib/brief';
import { showHours } from '../../lib/activities';

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
 *
 * The finest of the three grains in `screens/Reports.tsx`. Where this used to
 * end with two cards linking to the week and the term, it now hands the grain
 * switch back up — the week is not somewhere else any more.
 */
export function DayReport({ onGrain }: { onGrain: (grain: 'week') => void }) {
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
        system: `${when === 'morning' ? MORNING_SYSTEM : EVENING_SYSTEM}\n· ${nameNote(state.myName)}`,
        messages: [
          {
            role: 'user',
            content: when === 'morning' ? morningBrief(am, code) : eveningBrief(pm, code),
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

  const quiet = { fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.55, padding: '10px 0' };

  return (
    <>
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
        style={{ marginBottom: 'var(--sp-7)' }}
      />

      <Blueprint style={{ padding: '15px 16px' }}>
        <div className="kicker">
          {now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(24px * var(--text-scale, 1))', lineHeight: 1.15, marginTop: 'var(--sp-3)', textWrap: 'pretty' }}
        >
          {when === 'morning' ? morningLine(am) : eveningLine(pm)}
        </div>
      </Blueprint>

      {when === 'morning' ? (
        <>
          <Group header="Due today" framed={false}>
            {am.dueToday.length === 0 ? (
              <div style={quiet}>Nothing from a syllabus.</div>
            ) : (
              am.dueToday.map((i) => (
                <ItemRow
                  key={i.id}
                  title={`${code(i.c)} · ${i.title}`}
                  trailing={i.dueTime}
                  onClick={() => dispatch({ type: 'openItem', id: i.id })}
                />
              ))
            )}
          </Group>

          <Group
            header="On today"
            framed={false}
            footer={
              committed > 0
                ? `${showHours(committed)} of that is a commitment rather than a class.`
                : undefined
            }
          >
            {am.classes.length === 0 && am.commitments.length === 0 ? (
              <div style={quiet}>No classes and nothing committed.</div>
            ) : (
              <>
                {am.classes.map((c) => (
                  <ItemRow key={`c:${c.title}:${c.time}`} title={c.title} trailing={c.time} />
                ))}
                {am.commitments.map((c) => (
                  <ItemRow key={`m:${c.title}:${c.time}`} title={c.title} trailing={c.time} />
                ))}
              </>
            )}
          </Group>

          {am.tasks.length > 0 && (
            <Group header="Yours" framed={false}>
              {am.tasks.map((t) => (
                <ItemRow
                  key={t.id}
                  title={t.title}
                  trailing={t.date === null ? '' : t.date.slice(5)}
                />
              ))}
            </Group>
          )}

          <Insights most={1} />

          <Group header="Behind that" framed={false}>
            {am.overdue > 0 ? (
              <ItemRow
                title={`${am.overdue} went by unticked`}
                trailing="see them"
                onClick={() => {
                  dispatch({ type: 'setDueTab', tab: 'overdue' });
                  dispatch({ type: 'setCoursesTab', tab: 'due' });
                  dispatch({ type: 'go', screen: 'courses' });
                }}
              />
            ) : (
              <ItemRow title="Nothing overdue" />
            )}
            {am.next ? (
              <ItemRow
                title={`Next: ${code(am.next.c)} · ${am.next.title}`}
                trailing={am.next.dueShort}
                onClick={() => dispatch({ type: 'openItem', id: am.next!.id })}
              />
            ) : null}
          </Group>
        </>
      ) : (
        <>
          <Group header="What you did" framed={false}>
            {pm.ticked.length === 0 && pm.tasksDone === 0 ? (
              <div style={{ ...quiet, lineHeight: 'var(--leading-relaxed)' }}>
                Nothing ticked off. A day with classes, a job and no boxes ticked is a normal day.
              </div>
            ) : (
              <>
                {pm.ticked.map((i) => (
                  <ItemRow key={i.id} title={`${code(i.c)} · ${i.title}`} trailing="done" />
                ))}
                {pm.tasksDone > 0 && (
                  <ItemRow title={`${pm.tasksDone} of your own tasks`} trailing="done" />
                )}
              </>
            )}
          </Group>

          {pm.missed.length > 0 && (
            <Group header="Still open from today" framed={false}>
              {pm.missed.map((i) => (
                <ItemRow
                  key={i.id}
                  title={`${code(i.c)} · ${i.title}`}
                  trailing={i.dueTime}
                  onClick={() => dispatch({ type: 'openItem', id: i.id })}
                />
              ))}
            </Group>
          )}

          <Group header="Tomorrow" framed={false}>
            {pm.tomorrow.length === 0 && pm.tomorrowClasses.length === 0 ? (
              <div style={quiet}>Nothing due and no classes.</div>
            ) : (
              <>
                {pm.tomorrow.map((i) => (
                  <ItemRow key={i.id} title={`${code(i.c)} · ${i.title}`} trailing={i.dueTime} />
                ))}
                {pm.tomorrowClasses.map((c) => (
                  <ItemRow key={`t:${c.title}:${c.time}`} title={c.title} trailing={c.time} />
                ))}
              </>
            )}
          </Group>

          <Group header="Standing" framed={false}>
            <ItemRow title={`${pm.tasksLeft} of your own tasks still open`} />
            {pm.cardsSeen > 0 && (
              <ItemRow
                title={`${pm.cardsSeen} cards drilled`}
                trailing={`right ${pm.accuracy}% of the time`}
              />
            )}
            <ItemRow title={`${pm.overdue} overdue across the semester`} />
          </Group>
        </>
      )}

      {/*
        The day answers "what is today". The week answers the question people
        actually get wrong, which is whether the next seven days are
        survivable — so the way to it sits under both halves rather than only
        the morning one, because the evening is when somebody looks past
        tomorrow.

        It used to be two cards that navigated to two other screens. One of
        those screens is this one now, at a coarser grain, so this switches
        grain instead of leaving.
      */}
      <Group header="Further out" framed={false}>
        <ItemRow
          title="This week"
          meta="What happened, what slipped, and what next week holds."
          onClick={() => onGrain('week')}
        />
        <ItemRow
          title="The week ahead, in hours"
          meta="What is promised, what is due, and where the room is."
          onClick={() => dispatch({ type: 'go', screen: 'ahead' })}
        />
      </Group>

      {configured() && (
        <>
          <ActionButton
            onClick={() => void read()}
            disabled={busy}
            tone="primary"
            style={{ marginTop: 18 }}
          >
            {busy ? 'Reading it…' : 'What should I make of this?'}
          </ActionButton>
          {said ? (
            <Produced style={{ marginTop: 'var(--sp-6)', background: 'var(--app-panel)' }}>
              {said}
            </Produced>
          ) : null}
          <Trouble said={trouble.said} onRetry={trouble.again} busy={Boolean(busy)} />
          <div style={{ fontSize: 'var(--type-xs)', opacity: 0.45, marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
            Every number above is counted from your own data. {provider()} only reads the counts — it
            is told never to restate one differently or invent one.
          </div>
        </>
      )}
    </>
  );
}
