import { useEffect, useRef, useState } from 'react';
import { useStore, useNow } from '../state/store';
import { useDeviceLibrary } from '../lib/device-library';
import { dateToIso, shiftIso } from '../lib/date';
import { download } from '../lib/deliver';
import {
  AUDIT,
  COPING,
  EMPTY_RHYTHM,
  FIELDS,
  HELP_SCRIPTS,
  PROGRESS,
  READINESS,
  TIME_BOXES,
  calendarProposal,
  carryForward,
  markdown,
  printable,
  monday,
  newPlan,
  readRhythm,
  rhythmKey,
  savePlan,
  simulate,
  starter,
  type Field,
  type RhythmLibrary,
  type RhythmPlan,
} from '../lib/operating-rhythm';
import { FilePick } from './ui';

export function OperatingRhythm() {
  const { account, state, dispatch } = useStore();
  const now = useNow();
  const scope = rhythmKey(account?.id || null, state.term);
  return (
    <RhythmWorkspace
      key={scope}
      scope={scope}
      today={dateToIso(now)}
      onOpen={(screen) => dispatch({ type: 'go', screen })}
    />
  );
}

type Route = 'study' | 'support' | 'work' | 'calendar' | 'search' | 'setAssistant';
export function RhythmWorkspace({
  scope,
  today,
  onOpen,
}: {
  scope: string;
  today: string;
  onOpen?: (screen: Route) => void;
}) {
  const [kind, setKind] = useState<'daily' | 'weekly'>('daily');
  const [date, setDate] = useState(today);
  const [view, setView] = useState('Today');
  const planDate = kind === 'weekly' ? monday(date) : date;
  const lib = useDeviceLibrary(`${scope}:${kind}`, readRhythm, EMPTY_RHYTHM);
  const plan = lib.value.plans.find((p) => p.date === planDate) || newPlan(planDate);
  const v = plan.values;
  const [notice, setNotice] = useState('');
  const [calendarPreview, setCalendarPreview] = useState<{
    fingerprint: string;
    body: string;
  } | null>(null);
  const identity = useRef('');
  useEffect(() => {
    identity.current = `${scope}:${kind}:${planDate}`;
    return () => {
      identity.current = '';
    };
  }, [scope, kind, planDate]);
  const setCalendar = (body: string | null) =>
    setCalendarPreview(body === null ? null : { body, fingerprint: JSON.stringify(plan) });
  const calendar = calendarPreview?.fingerprint === JSON.stringify(plan) ? calendarPreview.body : null;
  const [remove, setRemove] = useState(false);
  const [removeAll, setRemoveAll] = useState(false);
  const [restore, setRestore] = useState<RhythmLibrary | null>(null);
  const [recovery, setRecovery] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);
  const [buffer, setBuffer] = useState(5);
  const [available, setAvailable] = useState(120);
  const [tasks, setTasks] = useState([
    { title: '', context: 'Writing', minutes: 25 },
    { title: '', context: 'Admin', minutes: 10 },
    { title: '', context: 'Writing', minutes: 25 },
  ]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (!left) setRunning(false);
    }, 250);
    return () => clearInterval(timer);
  }, [running]);
  const save = (patch: Partial<RhythmPlan>) => {
    const ok = lib.update((old) => {
      const current = old.plans.find((p) => p.date === planDate) || newPlan(planDate);
      const edits = patch.values
        ? Object.fromEntries(FIELDS.filter((k) => patch.values![k] !== v[k]).map((k) => [k, patch.values![k]]))
        : {};
      return savePlan(old, { ...current, ...patch, values: { ...current.values, ...edits } });
    });
    setNotice(ok ? 'Saved on this device.' : 'Changes were not saved.');
    setCalendar(null);
  };
  const field = (key: Field, label: string, type = 'text') => (
    <label className="rhythm-field" key={key}>
      {label}
      {type === 'text' ? (
        <textarea
          className="input"
          rows={2}
          maxLength={4000}
          value={v[key]}
          onChange={(e) => save({ values: { ...v, [key]: e.target.value } })}
        />
      ) : (
        <input
          className="input"
          type={type}
          value={v[key]}
          onChange={(e) => save({ values: { ...v, [key]: e.target.value } })}
        />
      )}
    </label>
  );
  const fields = (items: [Field, string][]) => items.map(([key, label]) => field(key, label));
  const preferences = (patch: Partial<RhythmLibrary['preferences']>) =>
    lib.update((old) => ({
      ...old,
      preferences: { ...old.preferences, ...patch },
    }));
  const start = () => {
    save({ status: 'Started' });
    setRemaining(plan.minutes * 60);
    setRunning(false);
    dialog.current?.showModal();
  };
  const closeFocus = () => {
    setRunning(false);
    dialog.current?.close();
  };
  const simulation = simulate(
    tasks.filter((t) => t.title.trim()),
    buffer,
    available,
  );
  const tools = () => (
    <div className="rhythm-actions">
      {onOpen &&
        (
          [
            ['study', 'Study and retrieval practice'],
            ['support', 'Find human support'],
            ['work', 'Project workspace'],
            ['calendar', 'Calendar and commitments'],
            ['search', 'Explore campus'],
            ['setAssistant', 'Assistant preferences'],
          ] as const
        ).map(([screen, label]) => (
          <button className="btn" type="button" key={screen} onClick={() => onOpen(screen)}>
            {label}
          </button>
        ))}
    </div>
  );
  return (
    <section className="operating-rhythm" aria-label="Executive-function operating rhythm">
      <h2>Make the next step visible</h2>
      <p>
        Optional, private planning on this device. Choose a goal, start small, and adjust when life changes. This
        supports your plan; it does not score you. Nothing here is sent to staff or AI.
      </p>
      <label>
        <input
          type="checkbox"
          checked={lib.value.preferences.enabled}
          onChange={(e) => preferences({ enabled: e.target.checked })}
        />{' '}
        Enable planning prompts
      </label>
      {lib.error && <p role="alert">{lib.error}</p>}
      <p role="status">{notice}</p>
      {lib.value.plans.length >= 230 && (
        <p>
          There are {lib.value.plans.length} saved dates in this rhythm. The limit is 240; export older work before
          adding more dates.
        </p>
      )}
      {lib.blocked && (
        <button
          className="btn"
          type="button"
          onClick={() =>
            download({
              name: 'rhythm-recovery.json',
              body: lib.recovery(),
              mime: 'application/json',
            })
          }
        >
          Export recovery copy
        </button>
      )}
      <div className="rhythm-actions">
        <label>
          Rhythm{' '}
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setCalendar(null);
              setRestore(null);
              setRemove(false);
              setRemoveAll(false);
              setNotice('');
            }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        <label>
          {kind === 'weekly' ? 'Week containing' : 'Plan date'}{' '}
          <input
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value);
                setCalendar(null);
                setRemove(false);
                setRemoveAll(false);
                setNotice('');
              }
            }}
          />
        </label>
        <label>
          View{' '}
          <select value={view} onChange={(e) => setView(e.target.value)}>
            {['Simple', 'Today', 'Plan', 'Explore'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {view === 'Explore' ? (
        tools()
      ) : (
        <>
          <h3>{kind === 'weekly' ? `Week of ${planDate}: orient and choose` : 'Morning plan · 2–5 minutes'}</h3>
          {fields([
            ['outcome', kind === 'weekly' ? 'One meaningful weekly outcome' : 'Today’s meaningful outcome'],
            ['why', 'Why it matters to me'],
            ['done', 'Definition of done'],
          ])}
          {view !== 'Simple' &&
            fields([
              ['fixed', 'Fixed classes, deadlines, meetings, and commitments'],
              ['changed', 'What changed?'],
              ['uncertain', 'What still needs official confirmation?'],
            ])}
          <h3>{kind === 'weekly' ? 'Weekly commitments' : 'Daily Three'}</h3>
          {fields([
            ['must', 'Must do'],
            ['forward', 'Move forward'],
            ['maintain', 'Maintain'],
          ])}
          <h3>Start Here</h3>
          {field('step', 'First small physical action')}
          <label>
            Time box{' '}
            <select
              value={plan.minutes}
              onChange={(e) =>
                save({
                  minutes: Number(e.target.value) as RhythmPlan['minutes'],
                })
              }
            >
              {TIME_BOXES.map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </select>
          </label>
          <p>
            <strong>Suggested first step:</strong> {starter(plan)}
          </p>
          <p>
            Why: this uses your chosen time box and saved next step; a waiting or blocked plan starts with its blocker.
          </p>
          {field('minimum', 'Minimum viable progress')}
          {field('support', 'Human support route / official contact')}
          <button className="btn btn-primary" type="button" onClick={start}>
            Start {plan.minutes} minutes
          </button>
          <label>
            Progress state{' '}
            <select value={plan.status} onChange={(e) => save({ status: e.target.value as RhythmPlan['status'] })}>
              {PROGRESS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {field('progress', 'Last progress / where I left off')}
          {view !== 'Simple' && v.milestones && (
            <fieldset>
              <legend>Milestone progress</legend>
              {Array.from(
                new Set(
                  v.milestones
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                ),
              )
                .slice(0, 100)
                .map((step) => (
                  <label key={step}>
                    <input
                      type="checkbox"
                      checked={plan.completedSteps.includes(step)}
                      onChange={(e) =>
                        save({
                          completedSteps: e.target.checked
                            ? [...plan.completedSteps.filter((s) => s !== step), step].slice(-100)
                            : plan.completedSteps.filter((s) => s !== step),
                        })
                      }
                    />
                    {step}
                  </label>
                ))}
            </fieldset>
          )}
          {view !== 'Simple' && lib.value.preferences.enabled && (
            <>
              <details>
                <summary>If–then obstacle plan · choose one or two</summary>
                <label>
                  Obstacle template{' '}
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const c = COPING[Number(e.target.value)];
                      if (c)
                        save({
                          values: { ...v, trigger: c[1], response: c[2] },
                        });
                    }}
                  >
                    <option value="">Choose an obstacle</option>
                    {COPING.map((c, i) => (
                      <option key={c[0]} value={i}>
                        {c[0]}
                      </option>
                    ))}
                  </select>
                </label>
                {fields([
                  ['trigger', 'If this happens'],
                  ['response', 'Then I will'],
                  ['trigger2', 'Second trigger (optional)'],
                  ['response2', 'Second response (optional)'],
                ])}
              </details>
              <details>
                <summary>Context packet · keep only what I need</summary>
                <p>
                  Use official instructions and authorized sources. Notes stay private. This packet is not automatically
                  provided to AI. Ask your instructor about unclear course policy.
                </p>
                {fields([
                  ['instructions', 'Official prompt / instructions / link'],
                  ['rubric', 'Rubric'],
                  ['policy', 'Course AI and source policy'],
                  ['sources', 'Approved sources and freshness notes'],
                  ['notes', 'Private working notes'],
                  ['questions', 'Question parking lot'],
                  ['milestones', 'Milestones and dependencies'],
                  ['decisions', 'Decision log'],
                  ['assumptions', 'Assumptions to verify'],
                  ['handoff', 'Version and official submission checklist'],
                ])}
              </details>
              <details>
                <summary>
                  {kind === 'weekly'
                    ? 'Wednesday check-in · 2–3 minutes'
                    : 'Mid-day check-in · only if the plan changes'}
                </summary>
                {field('midday', 'What changed, and what still matters?')}
                {field('next', 'Next smallest action')}
                <div className="rhythm-actions">
                  {(
                    [
                      'Keep plan',
                      'Move work block',
                      'Reduce scope',
                      'Ask for help',
                      'Put in Waiting',
                      'Stop for today',
                    ] as const
                  ).map((action) => (
                    <button
                      className="btn"
                      type="button"
                      key={action}
                      onClick={() => {
                        save({
                          values: { ...v, adjustment: action },
                          status:
                            action === 'Put in Waiting'
                              ? 'Waiting'
                              : action === 'Reduce scope'
                                ? 'Re-scoped'
                                : plan.status,
                        });
                        if (action === 'Ask for help') setView('Plan');
                      }}
                    >
                      {action}
                    </button>
                  ))}
                </div>
                {field('adjustment', 'Chosen adjustment')}
                {field('waiting', 'Waiting on: owner and next action')}
                {field('followup', 'Follow-up / optional check-in date', 'date')}
              </details>
              <details>
                <summary>Self-advocacy · prepare a question</summary>
                <p>Edit the draft and bring it to your chosen person. No message is sent.</p>
                <div className="rhythm-actions">
                  {Object.entries(HELP_SCRIPTS).map(([label, script]) => (
                    <button
                      className="btn"
                      type="button"
                      key={label}
                      onClick={() => save({ values: { ...v, helpDraft: script } })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {field('helpDraft', 'Help request draft')}
                {tools()}
              </details>
              <details>
                <summary>
                  {kind === 'weekly' ? 'Friday close and reflection' : 'End-of-day close · 1–2 minutes'}
                </summary>
                {fields([
                  ['close', 'What moved forward?'],
                  ['waiting', 'What is waiting or blocked?'],
                  ['tomorrow', 'Tomorrow’s first small action'],
                  ['helped', 'What helped?'],
                  ['carry', 'What should carry into next week?'],
                  ['reduce', 'What can I reduce, defer, or archive?'],
                  ['adjustment', 'One thing to change next time'],
                ])}
                <button
                  className="btn"
                  type="button"
                  disabled={!v.carry}
                  onClick={() => {
                    const next = carryForward(plan);
                    if (lib.value.plans.some((p) => p.date === next.date)) {
                      setNotice(
                        'A plan already exists for that date. Open it to add your carry-forward without replacing it.',
                      );
                      return;
                    }
                    if (lib.update((old) => savePlan(old, next))) setNotice(`Carry-forward saved for ${next.date}.`);
                  }}
                >
                  Carry selected outcome into next week
                </button>
              </details>
              <details>
                <summary>UDL support audit · Not yet / Partial / Ready</summary>
                <p>
                  Rate the support around your plan. Choose one adjustment if a support is missing. There is no numeric
                  score.
                </p>
                {AUDIT.map((q, i) => (
                  <label className="rhythm-field" key={q}>
                    {q}
                    <select
                      value={plan.audit[i]}
                      onChange={(e) =>
                        save({
                          audit: plan.audit.map((a, j) => (i === j ? (e.target.value as typeof a) : a)),
                        })
                      }
                    >
                      {READINESS.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                ))}
                {field('adjustment', 'One next adjustment')}
              </details>
            </>
          )}
          {kind === 'weekly' && view !== 'Simple' && <WeekDailyPlans scope={scope} week={planDate} />}
          {view === 'Plan' && (
            <>
              <h3>Priority triage</h3>
              <p>
                Categories describe the next move, using only what you entered. Change any category to match your plan.
              </p>
              {fields([
                ['must', 'Do now · deadline or commitment critical'],
                ['forward', 'Schedule · protect time for the weekly outcome'],
                ['questions', 'Prepare / decide · a source, question, or assumption first'],
                ['waiting', 'Waiting · another person owns the next action'],
                ['reduce', 'Reduce / archive · your choice, without penalty'],
              ])}
              <h3>Plan repair and recovery</h3>
              <button className="btn" type="button" onClick={() => setRecovery(!recovery)}>
                {recovery ? 'Close recovery' : 'My plan changed'}
              </button>
              {recovery && (
                <div>
                  <p>
                    Rebuild only the next 7–14 days. Choose one primary outcome, protect fixed obligations, and keep a
                    human support route visible.
                  </p>
                  {fields([
                    ['changed', 'What happened?'],
                    ['must', 'Essential obligations'],
                    ['reduce', 'Can defer / reduce / drop'],
                    ['next', 'One recovery action'],
                    ['response', 'If–then fallback'],
                  ])}
                  {field('followup', 'Optional check-in date', 'date')}
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      save({ status: 'Re-scoped' });
                      setView('Simple');
                      setRecovery(false);
                    }}
                  >
                    Use a simpler plan
                  </button>
                </div>
              )}
              <h3>Time and context-switch simulator</h3>
              <p>
                Editable planning estimates, not a measure of cognitive ability or minutes guaranteed to be saved.
                Change these assumptions or turn the buffer off.
              </p>
              <label>
                Available minutes{' '}
                <input
                  type="number"
                  min="0"
                  max="10080"
                  value={available}
                  onChange={(e) => setAvailable(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
              <label>
                Switch buffer{' '}
                <select value={buffer} onChange={(e) => setBuffer(Number(e.target.value))}>
                  {[0, 2, 5, 10].map((n) => (
                    <option value={n} key={n}>
                      {n === 0 ? 'Off' : `${n} minutes`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn"
                type="button"
                disabled={tasks.length >= 30}
                onClick={() => setTasks([...tasks, { title: '', context: 'Writing', minutes: 10 }])}
              >
                Add commitment
              </button>
              {tasks.map((t, i) => (
                <fieldset key={i}>
                  <legend>Commitment {i + 1}</legend>
                  <label>
                    Title{' '}
                    <input
                      value={t.title}
                      maxLength={200}
                      onChange={(e) => setTasks(tasks.map((x, j) => (i === j ? { ...x, title: e.target.value } : x)))}
                    />
                  </label>
                  <label>
                    Context{' '}
                    <select
                      value={t.context}
                      onChange={(e) => setTasks(tasks.map((x, j) => (i === j ? { ...x, context: e.target.value } : x)))}
                    >
                      {['Writing', 'Reading', 'Problem solving', 'Admin', 'Meeting', 'Work', 'Personal'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Minutes{' '}
                    <input
                      type="number"
                      min="0"
                      max="10080"
                      value={t.minutes}
                      onChange={(e) =>
                        setTasks(
                          tasks.map((x, j) =>
                            i === j
                              ? {
                                  ...x,
                                  minutes: Math.max(0, Number(e.target.value) || 0),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <button className="btn" type="button" onClick={() => setTasks(tasks.filter((_, j) => i !== j))}>
                    Remove commitment {i + 1}
                  </button>
                </fieldset>
              ))}
              <table>
                <caption>Planning scenario comparison</caption>
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Context changes</th>
                    <th>Planned minutes</th>
                    <th>Time remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['Current order', simulation.original],
                      ['Grouped context', simulation.batched],
                    ] as const
                  ).map(([label, s]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{s.switches}</td>
                      <td>{s.total}</td>
                      <td>{s.remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Assumption sensitivity: a 0 / 2 / 5 / 10 minute buffer gives grouped totals of{' '}
                {[0, 2, 5, 10]
                  .map(
                    (n) =>
                      simulate(
                        tasks.filter((t) => t.title.trim()),
                        n,
                        available,
                      ).batched.total,
                  )
                  .join(' / ')}{' '}
                minutes. Official commitments and estimates still need your confirmation.
              </p>
              <p>
                Grouped order: {simulation.batched.items.map((t) => t.title).join(' → ') || 'Add commitments above.'}
              </p>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  save({
                    values: {
                      ...v,
                      assumptions: `Available: ${available} minutes; switch buffer: ${buffer} minutes.`,
                      milestones: simulation.batched.items
                        .map((t) => `${t.title}: ${t.minutes} minutes (${t.context})`)
                        .join('\n'),
                    },
                  })
                }
              >
                Save this scenario to my plan
              </button>
              <h3>Protect a work window</h3>
              {field('window', 'First realistic work window (local time)', 'datetime-local')}
              <button
                className="btn"
                type="button"
                onClick={() => {
                  try {
                    setCalendar(calendarProposal(plan));
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              >
                Preview calendar proposal
              </button>
              {calendar && (
                <div>
                  <p>
                    Proposal: {v.outcome || 'Study block'} · {v.window} · {plan.minutes} minutes. You will import this
                    file into your calendar yourself.
                  </p>
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      download({
                        name: `semester-block-${plan.date}.ics`,
                        body: calendar,
                        mime: 'text/calendar',
                      })
                    }
                  >
                    Confirm and download calendar file
                  </button>
                  <button className="btn" type="button" onClick={() => setCalendar(null)}>
                    Cancel
                  </button>
                </div>
              )}
              <h3>My working preferences</h3>
              {(['planningDay', 'workingTime', 'stuck'] as const).map((k) => (
                <label className="rhythm-field" key={k}>
                  {k === 'planningDay'
                    ? 'Preferred planning day'
                    : k === 'workingTime'
                      ? 'I work best'
                      : 'When stuck, offer'}
                  <input
                    value={lib.value.preferences[k]}
                    maxLength={100}
                    onChange={(e) => preferences({ [k]: e.target.value })}
                  />
                </label>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={lib.value.preferences.reflection}
                  onChange={(e) => preferences({ reflection: e.target.checked })}
                />{' '}
                Show my private strategy reflection
              </label>
              {lib.value.preferences.reflection && (
                <p>
                  Supports I recorded:{' '}
                  {Array.from(new Set(lib.value.plans.map((p) => p.values.helped).filter(Boolean)))
                    .slice(-5)
                    .join(' · ') || 'Record what helped in a close when you choose.'}
                </p>
              )}
            </>
          )}
        </>
      )}
      <div className="rhythm-actions">
        <button
          className="btn"
          type="button"
          onClick={() =>
            download({
              name: `semester-rhythm-${plan.date}.md`,
              body: markdown(plan),
              mime: 'text/markdown',
            })
          }
        >
          Export plan / Notion layout
        </button>
        <button
          className="btn"
          type="button"
          onClick={() =>
            download({
              name: `semester-rhythm-${plan.date}.html`,
              body: printable(plan),
              mime: 'text/html',
            })
          }
        >
          Download printable plan
        </button>
        <button
          className="btn"
          type="button"
          onClick={() =>
            download({
              name: `semester-rhythm-${kind}.json`,
              body: JSON.stringify(lib.value, null, 2),
              mime: 'application/json',
            })
          }
        >
          Export private backup
        </button>
        <FilePick
          multiple={false}
          accept=".json,application/json"
          onPick={async (files) => {
            const f = files[0];
            if (!f) return;
            const requestKey = identity.current;
            try {
              if (f.size > 3000000) throw new Error('Backup is too large.');
              const parsed = readRhythm(JSON.parse(await f.text()));
              if (requestKey === identity.current) setRestore(parsed);
            } catch (err) {
              if (requestKey === identity.current) setNotice((err as Error).message);
            }
          }}
        >
          Restore private backup
        </FilePick>
        <button className="btn" type="button" onClick={() => setRemove(true)}>
          Delete this plan
        </button>
        <button className="btn" type="button" onClick={() => setRemoveAll(true)}>
          Delete this rhythm’s plans and preferences
        </button>
      </div>
      <p>
        Exports contain your selected private notes and reflections. Keep them somewhere you trust. Daily and weekly
        backups are separate.
      </p>
      {restore && (
        <div>
          <p>
            Replace {kind} planning data for this account and term with {restore.plans.length} plans from this file?
            Export a backup first.
          </p>
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (lib.update(restore)) {
                setRestore(null);
                setNotice('Backup restored.');
              }
            }}
          >
            Confirm replacement
          </button>
          <button className="btn" type="button" onClick={() => setRestore(null)}>
            Cancel restore
          </button>
        </div>
      )}
      {removeAll && (
        <div>
          <p>
            Delete every {kind} plan and its working preferences for this account and term? Export a private backup
            first.
          </p>
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (lib.update(EMPTY_RHYTHM)) {
                setRemoveAll(false);
                setNotice('Rhythm data deleted.');
              }
            }}
          >
            Confirm delete rhythm
          </button>
          <button className="btn" type="button" onClick={() => setRemoveAll(false)}>
            Keep rhythm data
          </button>
        </div>
      )}
      {remove && (
        <div>
          <p>Delete the plan for {plan.date}, including its private notes?</p>
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (
                lib.update((old) => ({
                  ...old,
                  plans: old.plans.filter((p) => p.date !== planDate),
                }))
              ) {
                setRemove(false);
                setRemoveAll(false);
                setNotice('Plan deleted.');
              }
            }}
          >
            Confirm delete
          </button>
          <button className="btn" type="button" onClick={() => setRemove(false)}>
            Keep plan
          </button>
        </div>
      )}
      <dialog aria-label="Focus session" ref={dialog} className="rhythm-focus" onCancel={() => setRunning(false)}>
        <h2>One next action</h2>
        <p>{v.outcome}</p>
        <p>Done means: {v.done || 'Choose a bounded stopping point.'}</p>
        <p>{starter(plan)}</p>
        <p>
          Source:{' '}
          {v.instructions || v.sources || 'Add your instructions or one authorized source to the context packet.'}
        </p>
        <p>Human support: {v.support || 'Choose an instructor, TA, tutor, advisor, or campus office.'}</p>
        <p aria-label="Time remaining">
          {Math.floor((remaining || 0) / 60)}:{String((remaining || 0) % 60).padStart(2, '0')}
        </p>
        <button
          className="btn"
          type="button"
          disabled={!remaining}
          onClick={() => {
            if (running) {
              setRemaining(Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000)));
              setRunning(false);
            } else {
              endAt.current = Date.now() + (remaining || 0) * 1000;
              setRunning(true);
            }
          }}
        >
          {running ? 'Pause' : 'Resume timer'}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            closeFocus();
            setView('Plan');
            save({ status: 'Blocked' });
          }}
        >
          I am stuck
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            closeFocus();
            save({ status: 'Moving forward' });
          }}
        >
          Record progress and close
        </button>
        <button className="btn" type="button" onClick={closeFocus}>
          Stop for now
        </button>
      </dialog>
    </section>
  );
}

function WeekDailyPlans({ scope, week }: { scope: string; week: string }) {
  const lib = useDeviceLibrary(`${scope}:daily`, readRhythm, EMPTY_RHYTHM);
  return (
    <details>
      <summary>Daily Three for this week</summary>
      {lib.error && <p role="alert">{lib.error}</p>}
      {Array.from({ length: 7 }, (_, i) => shiftIso(week, i)).map((date) => {
        const plan = lib.value.plans.find((p) => p.date === date) || newPlan(date);
        return (
          <fieldset key={date}>
            <legend>{date}</legend>
            {(
              [
                ['must', 'Must do'],
                ['forward', 'Move forward'],
                ['maintain', 'Maintain'],
              ] as const
            ).map(([key, label]) => (
              <label className="rhythm-field" key={key}>
                {label}
                <input
                  maxLength={4000}
                  value={plan.values[key]}
                  onChange={(e) =>
                    lib.update((old) => {
                      const current = old.plans.find((p) => p.date === date) || newPlan(date);
                      return savePlan(old, {
                        ...current,
                        values: { ...current.values, [key]: e.target.value },
                      });
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
        );
      })}
    </details>
  );
}
