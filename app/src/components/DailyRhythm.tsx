import { useId, useState } from 'react';
import { dateToIso } from '../lib/date';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import { AUDIT, EMPTY_RHYTHM, FIELDS, HELP_SCRIPTS, PROGRESS, RESPONSES, RHYTHM_KEY, TIMEBOXES, exportDay, helpDraft, newDay, readRhythm, saveDay, type DailyPlan, type Field } from '../lib/daily-rhythm';
import { useNow } from '../state/store';
import { ConfirmDialog } from './ConfirmDialog';
import { ActionPreview } from './unity/ActionPreview';

export function DailyRhythm({ accountId, now: suppliedNow }: { accountId: string | null; now?: Date }) {
  const currentTime = useNow();
  const now = suppliedNow ?? currentTime;
  return <DailyRhythmBody key={accountId || 'device'} accountId={accountId} today={dateToIso(now)} />;
}

function DailyRhythmBody({ accountId, today }: { accountId: string | null; today: string }) {
  const library = useDeviceLibrary(`${RHYTHM_KEY}:${accountId || 'device'}`, readRhythm, EMPTY_RHYTHM);
  const [date, setDate] = useState(today);
  const plan = library.value.days.find(d => d.date === date) ?? newDay(date);
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<keyof typeof HELP_SCRIPTS>('clarify');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const id = useId();
  const change = (patch: Partial<DailyPlan>) => {
    const ok = library.update(old => saveDay(old, { ...(old.days.find(d => d.date === date) ?? newDay(date)), ...patch }));
    setMessage(ok ? 'Saved on this device.' : 'This change did not save. Export a recovery copy if needed.');
  };
  const fields = (keys: Field[]) => keys.map(key => <label key={key}>
    {FIELDS[key]}
    <textarea className="input" rows={2} maxLength={2000} value={plan[key]} disabled={plan.paused || library.blocked}
      onChange={e => change({ [key]: e.target.value })} />
  </label>);
  return <section className="today-why" aria-label="Daily operating rhythm">
    <h2>Daily operating rhythm</h2>
    <p>Choose one meaningful outcome. Keep the plan small and change it when the day changes. Optional and private on this device; it does not sync or enter AI context.</p>
    <label>Plan date<input className="input" type="date" value={date} onChange={e => {
      if (e.target.value) { setDate(e.target.value); setMessage(''); setConfirmDelete(false); }
    }} /></label>
    {library.error && <p role="alert">{library.error}</p>}
    {library.blocked && <button type="button" className="btn" onClick={() => {
      const body = library.recovery();
      if (body) download({ name: 'daily-plan-recovery.txt', body, mime: 'text/plain' });
    }}>Export recovery copy</button>}
    <p role="status">{message}</p>
    <button type="button" className="btn workspace-text-button" disabled={library.blocked} onClick={() => change({ paused: !plan.paused })}>
      {plan.paused ? 'Resume daily plan' : 'Pause daily plan'}
    </button>
    <p>{plan.paused ? 'Paused. Your saved plan is kept; resume when you choose.' : 'Morning · about two to five minutes'}</p>
    <fieldset disabled={plan.paused || library.blocked}>
      <legend>My outcome and Daily Three</legend>
      {fields(['outcome', 'why', 'done', 'commitments', 'must', 'forward', 'maintain'])}
      <details><summary>Start here and prepare a fallback</summary>
        {fields(['first', 'window', 'obstacle', 'response', 'minimum'])}
        <label>Time box<select className="input" value={plan.minutes} onChange={e => change({ minutes: Number(e.target.value) as DailyPlan['minutes'] })}>
          {TIMEBOXES.map(n => <option key={n} value={n}>{n} minutes</option>)}
        </select></label>
        <p>A first step has a stopping point and fits your chosen time. You decide what is realistic.</p>
      </details>
      <details><summary>Context packet and human support</summary>
        <p>Include only the instructions, sources and notes needed to start. Official systems retain authority over deadlines, records and course policy.</p>
        {fields(['prompt', 'rubric', 'sources', 'question', 'support', 'tried'])}
        <label>Help-request type<select className="input" value={kind} onChange={e => setKind(e.target.value as keyof typeof HELP_SCRIPTS)}>
          {Object.entries(HELP_SCRIPTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Help-request draft<textarea className="input" rows={4} readOnly value={helpDraft(plan, kind)} /></label>
        <p>Review and edit after copying. This draft is not sent to anyone.</p>
      </details>
      <details><summary>Midday check-in · repair the plan</summary>
        {fields(['changed', 'next'])}
        <label>Choose a response<select className="input" value={plan.repair} onChange={e => change({ repair: e.target.value as DailyPlan['repair'] })}>
          {RESPONSES.map(r => <option key={r}>{r}</option>)}
        </select></label>
        <label>Progress state<select className="input" value={plan.status} onChange={e => change({ status: e.target.value as DailyPlan['status'] })}>
          {PROGRESS.map(r => <option key={r}>{r}</option>)}
        </select></label>
      </details>
      <details><summary>End-of-day close · about one to two minutes</summary>
        {fields(['moved', 'waiting', 'tomorrow', 'helped'])}
      </details>
      <details><summary>Daily support audit</summary>
        <p>Rate the support around your plan. These states do not score your ability, effort, attendance or academic risk. Choose one adjustment if a support is missing.</p>
        {Object.entries(AUDIT).map(([key, question]) => <label key={key} htmlFor={`${id}-${key}`}>{question}
          <select id={`${id}-${key}`} className="input" value={plan.audit[key]} onChange={e => change({ audit: { ...plan.audit, [key]: e.target.value as 'Not yet' | 'Partial' | 'Ready' } })}>
            {['Not yet', 'Partial', 'Ready'].map(s => <option key={s}>{s}</option>)}
          </select>
        </label>)}
      </details>
    </fieldset>
    <button type="button" className="btn" onClick={() => download({ name: `daily-plan-${date}.md`, body: exportDay(plan), mime: 'text/markdown' })}>Export this daily plan</button>
    <p>Export includes your private notes and reflection. Review the file before sharing it. Device workspace backups also include these plans.</p>
    <button type="button" className="btn workspace-text-button" disabled={library.blocked} onClick={() => setConfirmDelete(true)}>Delete this daily plan</button>
    {confirmDelete ? (
      <ConfirmDialog
        title={`Delete the daily plan for ${date}?`}
        preview={
          <ActionPreview
            subject={`Daily plan for ${date}`}
            says={`Semester will delete the daily plan for ${date} from this device.`}
            exactly="The private outcome, Daily Three, fallback, support, check-in, reflection, and support-audit fields saved for this date."
            doesNotChange="Other daily plans for this account stay saved. Downloaded exports, workspace backups, and official course or calendar records do not change."
            recovery={{
              kind: 'none',
              how: 'Restore only from an exported plan or device workspace backup created before deletion.',
            }}
          />
        }
        confirmLabel="Delete plan"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          const ok = library.update(old => ({ ...old, days: old.days.filter(d => d.date !== date) }));
          setMessage(ok ? 'Daily plan deleted from this device.' : 'The plan could not be deleted.');
          if (ok) setConfirmDelete(false);
        }}
      />
    ) : null}
  </section>;
}
