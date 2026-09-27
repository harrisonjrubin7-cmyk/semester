import { useMemo, useState } from 'react';
import {
  ACTIONS_PREFIX,
  EMPTY_ACTION_CHOICES,
  rank,
  readActionChoices,
  transition,
  type Action,
  type ActionEvent,
  type Choice,
  type Scored,
} from '../lib/actions';
import { useDeviceLibrary } from '../lib/device-library';
import { useNow, useStore } from '../state/store';
import { SourceBadge } from './SourceBadge';
import { ActionButton, SectionLabel } from './ui';

/**
 * The Action Center: one most important thing, up to five more, the rest
 * behind "View all".
 *
 * Every control is a button — no swipe, no long press — so the whole list can
 * be worked with a keyboard or a switch (the compact-layout rule in
 * `docs/market-readiness/TODAY_ADAPTIVE_BACKLOG.md`). What the student does is
 * stored on this device under `semester.actions.v1:<account>`; nothing here
 * sends, shares or schedules anything, so nothing here needs a confirmation.
 * "Ask for help" and "Something is wrong" are recorded, not sent — the note
 * says so, because a student who thinks a request went to an advisor and it
 * did not has been failed by the app.
 */

const DAY = 86_400_000;

/** Tomorrow at 8 in the morning, local time. A snooze a student can picture. */
export function tomorrowMorning(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 8, 0, 0, 0).getTime();
}

const DONE_SAYS: Partial<Record<ActionEvent, string>> = {
  start: 'Marked as started.',
  complete: 'Marked as done.',
  snooze: 'Snoozed until tomorrow morning.',
  dismiss: 'Hidden — it will not come back unless you reopen it.',
  block: 'Marked as blocked.',
  correct: 'Noted on this device. Use Report on the source to fix the underlying date or detail.',
  help: 'Noted on this device. Semester has not sent this to anyone — bring it to your advisor or office hours.',
};

/** Calendar days, not 24-hour periods: 9 a.m. the day after tomorrow is "in 2 days". */
function dayStart(at: number): number {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dueLine(action: Action, now: number): string | null {
  if (typeof action.dueAt !== 'number') return null;
  const days = Math.round((dayStart(action.dueAt) - dayStart(now)) / DAY);
  if (action.dueAt < now) return 'Overdue';
  if (days <= 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

function go(action: Action) {
  if (action.primary.kind === 'navigate') {
    location.hash = action.primary.target;
  } else if (window.confirm(`This opens ${action.primary.target} in your browser. Continue?`)) {
    window.open(action.primary.target, '_blank', 'noopener,noreferrer');
  }
}

function Why({ s }: { s: Scored }) {
  const { explanation: e, source } = s.action;
  const p = s.parts;
  return (
    <details className="today-why">
      <summary>Why am I seeing this?</summary>
      <p>{e.trigger}</p>
      {e.factors.length > 0 && (
        <>
          <p><strong>Based on</strong></p>
          <ul>{e.factors.map((f) => <li key={f}>{f}</li>)}</ul>
        </>
      )}
      <p><strong>What it should change:</strong> {e.expectedImpact}</p>
      {e.limitations.length > 0 && (
        <>
          <p><strong>What Semester cannot see</strong></p>
          <ul>{e.limitations.map((f) => <li key={f}>{f}</li>)}</ul>
        </>
      )}
      {e.alternatives.length > 0 && (
        <>
          <p><strong>Other reasonable choices</strong></p>
          <ul>{e.alternatives.map((f) => <li key={f}>{f}</li>)}</ul>
        </>
      )}
      <p><strong>Source:</strong> {source.system}</p>
      <p>
        <strong>How it was ranked:</strong> urgency {p.urgency} + importance {p.impact} + ready to do {p.actionability} +
        source confidence {p.confidence}
        {p.fatigue ? ` − ${p.fatigue} for being snoozed before` : ''} = {s.score}.
      </p>
    </details>
  );
}

function NoteForm({
  kind,
  onSave,
  onCancel,
}: {
  kind: 'correct' | 'help';
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const label = kind === 'correct' ? 'What is wrong with this?' : 'What do you need help with?';
  return (
    <div className="action-note">
      <label>
        {label}
        <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} />
      </label>
      <p className="today-sync-status">Saved on this device only. Semester does not send it to anyone.</p>
      <div className="today-action-tools">
        <button type="button" className="workspace-text-button" disabled={!note.trim()} onClick={() => onSave(note)}>
          Save note
        </button>
        <button type="button" className="workspace-text-button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Controls({
  s,
  act,
  compact,
}: {
  s: Scored;
  act: (id: string, event: ActionEvent, note?: string) => void;
  compact?: boolean;
}) {
  const [noting, setNoting] = useState<'correct' | 'help' | null>(null);
  const id = s.action.id;
  if (noting) {
    return (
      <NoteForm
        kind={noting}
        onCancel={() => setNoting(null)}
        onSave={(note) => {
          act(id, noting, note);
          setNoting(null);
        }}
      />
    );
  }
  return (
    <div className="today-action-tools" aria-label={`Choices for ${s.action.title}`} role="group">
      {s.status === 'open' && !compact && (
        <button type="button" className="workspace-text-button" onClick={() => act(id, 'start')}>Start</button>
      )}
      <button type="button" className="workspace-text-button" onClick={() => act(id, 'complete')}>Done</button>
      <button type="button" className="workspace-text-button" onClick={() => act(id, 'snooze')}>Snooze until tomorrow</button>
      {!compact && (
        <>
          <button type="button" className="workspace-text-button" onClick={() => act(id, 'dismiss')}>Not relevant</button>
          <button type="button" className="workspace-text-button" onClick={() => setNoting('correct')}>Something is wrong</button>
          <button type="button" className="workspace-text-button" onClick={() => setNoting('help')}>Ask for help</button>
        </>
      )}
    </div>
  );
}

function Row({ s, now, act }: { s: Scored; now: number; act: (id: string, event: ActionEvent, note?: string) => void }) {
  const due = dueLine(s.action, now);
  return (
    <li className="action-row">
      <button type="button" className="today-timeline-row" onClick={() => go(s.action)}>
        <span>
          {due && <small>{due}</small>}
          <strong>{s.action.title}</strong>
          <small>{s.action.whyItMatters}</small>
        </span>
        <span aria-hidden="true">→</span>
      </button>
      <SourceBadge label={s.action.source.label} at={s.action.source.at} now={now} />
      <Controls s={s} act={act} compact />
      <Why s={s} />
    </li>
  );
}

export function ActionCenter({ actions }: { actions: Action[] }) {
  const { account } = useStore();
  const now = useNow().getTime();
  const key = `${ACTIONS_PREFIX}:${account?.id || 'device'}`;
  const library = useDeviceLibrary(key, readActionChoices, EMPTY_ACTION_CHOICES);
  const choices = library.value.choices;
  const ranked = useMemo(() => rank(actions, choices, now), [actions, choices, now]);
  const [said, setSaid] = useState<{ text: string; undo?: { id: string; prev: Choice | undefined } } | null>(null);

  const act = (id: string, event: ActionEvent, note?: string) => {
    const prev = choices[id];
    const moved = transition(prev, event, now, { until: tomorrowMorning(now), note });
    if (!moved.ok) {
      setSaid({ text: moved.why });
      return;
    }
    const saved = library.update((v) => ({ ...v, choices: { ...v.choices, [id]: moved.choice } }));
    setSaid(saved ? { text: DONE_SAYS[event] ?? 'Saved.', undo: { id, prev } } : { text: 'That could not be saved on this device.' });
  };

  const undo = () => {
    const u = said?.undo;
    if (!u) return;
    library.update((v) => {
      const next = { ...v.choices };
      if (u.prev) next[u.id] = u.prev;
      else delete next[u.id];
      return { ...v, choices: next };
    });
    setSaid({ text: 'Undone.' });
  };

  const top = ranked.mostImportant;
  return (
    <div className="action-center">
      <SectionLabel>Next best step</SectionLabel>
      {library.error && <p role="alert">{library.error}</p>}
      {top ? (
        <article aria-labelledby="action-top-title">
          {dueLine(top.action, now) && <p className="today-sync-status">{dueLine(top.action, now)}</p>}
          <h2 id="action-top-title">{top.action.title}</h2>
          <p>{top.action.whyItMatters}</p>
          <SourceBadge label={top.action.source.label} at={top.action.source.at} now={now} />
          <ActionButton tone="primary" onClick={() => go(top.action)}>{top.action.primary.label}</ActionButton>
          <Controls s={top} act={act} />
          <Why s={top} />
        </article>
      ) : (
        <p className="today-clear">Nothing needs you right now. Anything you snoozed comes back tomorrow morning.</p>
      )}

      {said && (
        <p role="status" className="today-dismissed">
          {said.text}{' '}
          {said.undo && (
            <button type="button" className="workspace-text-button" onClick={undo}>Undo</button>
          )}
        </p>
      )}

      {ranked.next.length > 0 && (
        <>
          <SectionLabel>Next</SectionLabel>
          <ol className="action-list">
            {ranked.next.map((s) => <Row key={s.action.id} s={s} now={now} act={act} />)}
          </ol>
        </>
      )}

      {ranked.rest.length > 0 && (
        <details className="today-why">
          <summary>View all ({ranked.rest.length} more)</summary>
          <ol className="action-list">
            {ranked.rest.map((s) => <Row key={s.action.id} s={s} now={now} act={act} />)}
          </ol>
        </details>
      )}

      {ranked.hidden.some((h) => h.status === 'snoozed') && (
        <p className="today-sync-status">
          {ranked.hidden.filter((h) => h.status === 'snoozed').length} snoozed until tomorrow morning.
        </p>
      )}
    </div>
  );
}
