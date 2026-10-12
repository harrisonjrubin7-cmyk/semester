import { useId, useMemo, useState } from 'react';
import { useNow, useStore } from '../state/store';
import { SectionLabel, Notice, EmptyState } from './ui';
import { ErrorSummary, FieldMessage, fieldProps, useFieldErrors } from './FieldMessage';
import { newId } from '../lib/idb';
import { current } from '../lib/housing';
import {
  CHANNELS,
  addDays,
  checkBackAtFor,
  checkBackProblem,
  CHANNEL_TEXT,
  EMERGENCY_GUIDANCE,
  LIMITS,
  NEXT,
  STATUS_TEXT,
  URGENCIES,
  URGENCY_TEXT,
  checkDraft,
  fromLocalInput,
  isOpen,
  likelyDuplicate,
  needsFollowUp,
  newMaintenance,
  ordered,
  placeLine,
  titleOf,
  visitProblem,
  toLocalInput,
  whenLine,
  type Channel,
  type CheckBackChoice as CheckBack,
  type DraftField,
  type MaintenanceDraft,
  type MaintenanceRequest,
  type MaintenanceStatus,
  type Urgency,
} from '../lib/maintenance';

/**
 * Repairs reported to housing (catalog G-010), on Housing's "My housing" tab.
 *
 * Reuses the form pattern of `HousingDetails` beside it — `useFieldErrors`,
 * `ErrorSummary`, `FieldMessage` — and the shared `Notice` and `EmptyState`.
 * Removing a request is undoable (`dropMaintenance` in `lib/undo.ts`), so it
 * takes the undo toast rather than a confirmation, as `ActionPreview`'s notes
 * ask of reversible work.
 *
 * What this never does: send anything to housing. The intro, the emergency
 * notice and every follow-up say so.
 */

/** The suggestion is counted from the report, and its label says so; the rest count from now. */
const suggestedLabel = (u: Urgency, from: 'report' | 'now'): string =>
  `${u === 'routine' ? '3 days' : u === 'urgent' ? '4 hours' : '1 hour'} after ${from === 'report' ? 'you reported it' : 'reporting it again'} (suggested)`;
const LABELS: Record<DraftField, string> = {
  hall: 'Building',
  what: 'What is wrong',
  where: 'Where in the room',
  reference: 'Housing reference number',
  reportedAt: 'When you reported it',
  checkBackAt: 'When to check back',
};
const ORDER = ['what', 'hall', 'where', 'reference', 'reportedAt', 'checkBackAt'] as const;

export function MaintenanceRequests() {
  const { state } = useStore();
  const now = useNow().getTime();
  const [adding, setAdding] = useState(false);
  const list = useMemo(() => ordered(state.maintenance), [state.maintenance]);
  const open = list.filter(isOpen);
  const closed = list.filter((r) => !isOpen(r) && r.term === state.term);

  return (
    <section aria-label="Repairs you reported">
      <SectionLabel>Repairs you reported</SectionLabel>
      <p className="maintenance-intro">
        Report a repair to housing first — their portal, front desk or phone line. Then record it here with the
        reference they gave you, and Semester will remind you when to check back. Semester does not send anything to
        housing.
      </p>

      {list.length === 0 && !adding ? (
        <EmptyState
          inline
          title="No repairs recorded"
          body="When something in your room needs fixing and you have reported it, keep track of it here."
          action={{ label: 'Record a repair', onClick: () => setAdding(true) }}
        />
      ) : null}

      {open.length > 0 ? (
        <ul className="maintenance-list" aria-label="Open repair requests">
          {open.map((r) => <RequestRow key={r.id} request={r} now={now} />)}
        </ul>
      ) : null}

      {adding ? (
        <RequestForm onDone={() => setAdding(false)} />
      ) : list.length > 0 ? (
        <button type="button" className="btn btn-ghost btn-block maintenance-add" onClick={() => setAdding(true)}>
          Record another repair
        </button>
      ) : null}

      {closed.length > 0 ? (
        <>
          <SectionLabel>Closed this term</SectionLabel>
          <ul className="maintenance-list" aria-label="Closed repair requests">
            {closed.map((r) => <RequestRow key={r.id} request={r} now={now} />)}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function checkBackLine(r: MaintenanceRequest): string {
  if (!isOpen(r)) return '';
  if (r.status === 'not_fixed') return 'Report it again so housing knows.';
  if (r.status === 'scheduled' && r.scheduledFor !== null) return `Visit scheduled for ${whenLine(r.scheduledFor)}.`;
  return r.checkBackStated
    ? `Housing said they would reply by ${whenLine(r.checkBackAt)}.`
    : `Check back ${whenLine(r.checkBackAt)} — the time you chose, not a promise from housing.`;
}

/** The buttons each status offers, in the order a student reaches for them. */
const MOVE_LABEL: Partial<Record<MaintenanceStatus, string>> = {
  scheduled: 'Visit scheduled',
  fixed: 'It is fixed',
  not_fixed: 'Still not fixed',
  reported: 'Reported it again',
  withdrawn: 'No longer needed',
};

function RequestRow({ request: r, now }: { request: MaintenanceRequest; now: number }) {
  const { dispatch } = useStore();
  const [scheduling, setScheduling] = useState(false);
  const [reReporting, setReReporting] = useState(false);
  const [newRef, setNewRef] = useState('');
  const refId = useId();
  const [reCheck, setReCheck] = useState<CheckBack>('suggested');
  const [reStated, setReStated] = useState('');
  const [reError, setReError] = useState('');
  const reCheckId = useId();
  const reStatedId = useId();
  const [visit, setVisit] = useState('');
  const [visitError, setVisitError] = useState('');
  const visitId = useId();
  const due = needsFollowUp(r, now);
  const title = useId();

  const go = (to: MaintenanceStatus) => {
    if (to === 'scheduled') {
      setScheduling(true);
      return;
    }
    if (to === 'reported') {
      // The ticket on file, to keep, replace, or clear if housing gave none.
      setNewRef(r.reference);
      setReCheck('suggested');
      setReStated('');
      setReError('');
      setReReporting(true);
      return;
    }
    dispatch({ type: 'moveMaintenance', id: r.id, change: { to, at: Date.now() } });
  };

  // A re-report starts the wait again: housing may give a new reply time, and
  // "Tomorrow" means tomorrow from now. Left on the suggestion, `move` counts
  // housing's usual response from the moment of re-reporting.
  const saveReReport = () => {
    const at = Date.now();
    const checkBackAt = reCheck === 'suggested'
      ? undefined
      : checkBackAtFor(reCheck, { urgency: r.urgency, reportedAt: at, now: at, stated: fromLocalInput(reStated) });
    const why = checkBackAt === undefined ? '' : checkBackProblem(at, checkBackAt);
    if (why) {
      setReError(reCheck === 'stated' && why.startsWith('The check-back cannot') ? 'The time housing gave has already passed. Check the date.' : why);
      return;
    }
    dispatch({
      type: 'moveMaintenance',
      id: r.id,
      change: { to: 'reported', at, reference: newRef, ...(checkBackAt === undefined ? {} : { checkBackAt, checkBackStated: reCheck === 'stated' }) },
    });
    setReReporting(false);
  };

  const saveVisit = () => {
    const at = fromLocalInput(visit);
    const why = Number.isFinite(at) ? visitProblem(r, at) : 'Give the date and time housing scheduled.';
    if (why) {
      setVisitError(why);
      return;
    }
    dispatch({ type: 'moveMaintenance', id: r.id, change: { to: 'scheduled', at: Date.now(), scheduledFor: at } });
    setScheduling(false);
    setVisitError('');
  };

  return (
    <li className="maintenance-row" aria-labelledby={title}>
      <div className="maintenance-head">
        <strong id={title}>{titleOf(r)}</strong>
        <span className="maintenance-status">{STATUS_TEXT[r.status]}</span>
      </div>
      <div className="maintenance-meta">
        {placeLine(r)} · {URGENCY_TEXT[r.urgency]} · {r.reference ? `Reference ${r.reference}` : 'No reference recorded'}
      </div>
      <div className="maintenance-meta">
        Reported by {CHANNEL_TEXT[r.channel].toLowerCase()}, {whenLine(r.reportedAt)}
      </div>
      {isOpen(r) ? <div className="maintenance-meta">{checkBackLine(r)}</div> : null}
      {due ? (
        <Notice>
          {r.status === 'scheduled'
            ? 'The visit has passed. Record whether it was fixed.'
            : r.status === 'not_fixed'
              ? 'Housing will not know it is still broken until you tell them.'
              : 'It is time to check on this one. Have the reference number ready.'}
        </Notice>
      ) : null}

      {reReporting ? (
        <div className="maintenance-visit">
          <label htmlFor={refId}>Reference number (clear it if housing gave no new one)</label>
          <input
            id={refId}
            aria-label="Reference number (clear it if housing gave no new one)"
            className="input"
            value={newRef}
            maxLength={LIMITS.reference}
            onChange={(e) => setNewRef(e.target.value)}
          />
          <label htmlFor={reCheckId}>When to check back</label>
          <select
            id={reCheckId}
            className="input"
            value={reCheck}
            onChange={(e) => {
              setReCheck(e.target.value as CheckBack);
              setReError('');
            }}
          >
            <option value="suggested">{suggestedLabel(r.urgency, 'now')}</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="week">In a week</option>
            <option value="stated">At a time housing gave me</option>
          </select>
          {reCheck === 'stated' ? (
            <>
              <label htmlFor={reStatedId}>The time housing gave</label>
              <input
                aria-label="The time housing gave"
                {...fieldProps(reStatedId, reError || undefined)}
                className="input"
                type="datetime-local"
                value={reStated}
                onChange={(e) => {
                  setReStated(e.target.value);
                  setReError('');
                }}
              />
            </>
          ) : null}
          <FieldMessage id={reStatedId} error={reError || undefined} />
          <div className="maintenance-actions">
            <button type="button" className="btn btn-primary" onClick={saveReReport}>
              Save
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setReReporting(false)}>Cancel</button>
          </div>
        </div>
      ) : scheduling ? (
        <div className="maintenance-visit">
          <label htmlFor={visitId}>When housing will come</label>
          <input
            aria-label="When housing will come"
            {...fieldProps(visitId, visitError || undefined)}
            className="input"
            type="datetime-local"
            value={visit}
            onChange={(e) => {
              setVisit(e.target.value);
              setVisitError('');
            }}
          />
          <FieldMessage id={visitId} error={visitError || undefined} />
          <div className="maintenance-actions">
            <button type="button" className="btn btn-primary" onClick={saveVisit}>Save visit</button>
            <button type="button" className="btn btn-ghost" onClick={() => setScheduling(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="maintenance-actions" role="group" aria-label={`Update: ${titleOf(r)}`}>
          {NEXT[r.status].map((to) => (
            <button key={to} type="button" className="btn btn-ghost" onClick={() => go(to)}>
              {MOVE_LABEL[to]}
            </button>
          ))}
          {r.status === 'reported' && due ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => dispatch({ type: 'snoozeMaintenance', id: r.id, until: addDays(Date.now(), 1), at: Date.now() })}
            >
              Remind me tomorrow
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'dropMaintenance', id: r.id })}>
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

function RequestForm({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useStore();
  const now = Date.now();
  const home = current(state.residences, state.term);
  const [urgency, setUrgency] = useState<Urgency>('routine');
  const [what, setWhat] = useState('');
  const [where, setWhere] = useState('');
  // Prefilled from the room on file, whose form has no length limit: clipped
  // here, in view, so what is shown is what is saved.
  const [hall, setHall] = useState((home?.hall ?? '').slice(0, LIMITS.hall));
  const [room, setRoom] = useState((home?.room ?? '').slice(0, LIMITS.room));
  const [channel, setChannel] = useState<Channel>('portal');
  const [reference, setReference] = useState('');
  const [reported, setReported] = useState(toLocalInput(now));
  const [checkBack, setCheckBack] = useState<CheckBack>('suggested');
  const [stated, setStated] = useState('');
  const [duplicateOf, setDuplicateOf] = useState<MaintenanceRequest | null>(null);
  const fields = useFieldErrors(ORDER);
  const urgencyName = useId();

  const draft = (): MaintenanceDraft => {
    const reportedAt = fromLocalInput(reported);
    const base = Number.isFinite(reportedAt) ? reportedAt : now;
    const checkBackAt = checkBackAtFor(checkBack, { urgency, reportedAt: base, now: Date.now(), stated: fromLocalInput(stated) });
    return { hall, room, what, where, urgency, channel, reference, reportedAt, checkBackAt, checkBackStated: checkBack === 'stated' };
  };

  const save = (confirmedDuplicate: boolean) => {
    const d = draft();
    if (!fields.check(checkDraft(d, Date.now()))) return;
    const dup = likelyDuplicate(state.maintenance, d);
    if (dup && !confirmedDuplicate) {
      setDuplicateOf(dup);
      return;
    }
    dispatch({ type: 'addMaintenance', request: newMaintenance(newId('mr'), state.term, d, Date.now()) });
    onDone();
  };

  const control = (k: DraftField, onValue: (v: string) => void) => ({
    ...fields.control(k),
    onChange: (e: { target: { value: string } }) => {
      onValue(e.target.value);
      fields.clear(k);
      setDuplicateOf(null);
    },
  });

  return (
    <form
      className="maintenance-form"
      aria-label="Record a repair"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      <ErrorSummary {...fields.summary(LABELS)} />

      <fieldset>
        <legend>How urgent is it?</legend>
        {URGENCIES.map((u) => (
          <label key={u} className="maintenance-choice">
            <input type="radio" name={urgencyName} value={u} checked={urgency === u} onChange={() => setUrgency(u)} />
            {URGENCY_TEXT[u]}
          </label>
        ))}
      </fieldset>
      {urgency === 'emergency' ? <Notice alert>{EMERGENCY_GUIDANCE}</Notice> : null}

      <label htmlFor={fields.message('what').id}>{LABELS.what}</label>
      <textarea aria-label={LABELS.what} className="input" rows={2} maxLength={LIMITS.what} value={what} {...control('what', setWhat)} />
      <FieldMessage {...fields.message('what')} />

      <label htmlFor={fields.message('where').id}>{LABELS.where} (optional)</label>
      <input aria-label={LABELS.where} className="input" value={where} maxLength={LIMITS.where} placeholder="Bathroom sink" {...control('where', setWhere)} />
      <FieldMessage {...fields.message('where')} />

      <label htmlFor={fields.message('hall').id}>{LABELS.hall}</label>
      <input aria-label={LABELS.hall} className="input" value={hall} maxLength={LIMITS.hall} {...control('hall', setHall)} />
      <FieldMessage {...fields.message('hall')} />

      <label htmlFor="maintenance-room">Room (optional)</label>
      <input id="maintenance-room" className="input" value={room} maxLength={LIMITS.room} onChange={(e) => setRoom(e.target.value)} />

      <label htmlFor="maintenance-channel">Where you reported it</label>
      <select id="maintenance-channel" className="input" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
        {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_TEXT[c]}</option>)}
      </select>

      <label htmlFor={fields.message('reference').id}>{LABELS.reference} (optional)</label>
      <input aria-label={LABELS.reference} className="input" value={reference} maxLength={LIMITS.reference} {...control('reference', setReference)} />
      <FieldMessage {...fields.message('reference')} />

      <label htmlFor={fields.message('reportedAt').id}>{LABELS.reportedAt}</label>
      <input aria-label={LABELS.reportedAt} className="input" type="datetime-local" value={reported} {...control('reportedAt', setReported)} />
      <FieldMessage {...fields.message('reportedAt')} />

      <label htmlFor="maintenance-checkback">{LABELS.checkBackAt}</label>
      <select id="maintenance-checkback" className="input" value={checkBack} onChange={(e) => { setCheckBack(e.target.value as CheckBack); fields.clear('checkBackAt'); }}>
        <option value="suggested">{suggestedLabel(urgency, 'report')}</option>
        <option value="tomorrow">Tomorrow</option>
        <option value="week">In a week</option>
        <option value="stated">At a time housing gave me</option>
      </select>
      {checkBack === 'stated' ? (
        <>
          <label htmlFor={fields.message('checkBackAt').id}>The time housing gave</label>
          <input aria-label="The time housing gave" className="input" type="datetime-local" value={stated} {...control('checkBackAt', setStated)} />
        </>
      ) : null}
      <FieldMessage {...fields.message('checkBackAt')} />
      <p className="maintenance-hint">
        Suggested times are Semester’s, not your school’s. Use the time housing gave you if they gave one.
      </p>

      {duplicateOf ? (
        <Notice alert>
          This looks like “{duplicateOf.what}”, which you recorded {whenLine(duplicateOf.reportedAt)} and is still open.
          Record it again only if it is a separate problem.
        </Notice>
      ) : null}

      <div className="maintenance-actions">
        {duplicateOf ? (
          <button type="button" className="btn btn-primary" onClick={() => save(true)}>Record it as a separate repair</button>
        ) : (
          <button type="submit" className="btn btn-primary">Save repair</button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}
