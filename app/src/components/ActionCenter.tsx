import { Suspense, lazy, useMemo, useState } from 'react';
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
import { DISMISS_REASONS, dismissNote, dismissReasonOf, snoozePresets, type SnoozePreset } from '../lib/actionchoices';
import { useDeviceLibrary } from '../lib/device-library';
import { useNow, useStore } from '../state/store';
import { ClarityQuestion } from './ClarityQuestion';
import { EXPERIENCE_FLAGS } from '../lib/experience-flags';
import { askForHelp, helpFromAction } from '../lib/help-routes';
import { requireOnline } from '../lib/offline-mode';
import { ExplanationSheet } from './ExplanationSheet';
import { SourceBadge } from './SourceBadge';
import { ActionButton, SectionLabel } from './ui';

/*
 * Loaded only when a student opens it. The feedback form reaches `lib/privacy`
 * and `lib/cloud`; imported eagerly it put both into Today's entry chunk
 * (+17.6 kB) for a panel most visits never open.
 */
const SaySomething = lazy(() => import('./SaySomething').then((m) => ({ default: m.SaySomething })));

/**
 * The Action Center: one most important thing, up to three more, the rest
 * behind "View all".
 *
 * Every control is a button — no swipe, no long press — so the whole list can
 * be worked with a keyboard or a switch (the compact-layout rule in
 * `docs/market-readiness/TODAY_ADAPTIVE_BACKLOG.md`). What the student does is
 * stored on this device under `semester.actions.v1:<account>`; nothing here
 * sends, shares or schedules anything, so nothing here needs a confirmation.
 * "Something is wrong" is recorded, not sent — the note says so, because a
 * student who thinks a report went somewhere and it did not has been failed by
 * the app. "Ask for help" is recorded too, and when the action has a person to
 * ask (`helpFromAction` in `lib/help-routes.ts`) and `VITE_HUMAN_HELP` is on,
 * it then opens Get help on that need. It still sends nothing: the student
 * reads, ticks and confirms there. Otherwise it keeps the note.
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
  snooze: 'Snoozed.',
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
    return;
  }
  // An official site offline would open a page that cannot load, and with
  // offline mode on, the hand-off is refused like every other (Phase M).
  try {
    requireOnline('handoff');
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
    return;
  }
  if (window.confirm(`This opens ${action.primary.target} in your browser. Continue?`)) {
    window.open(action.primary.target, '_blank', 'noopener,noreferrer');
  }
}

/** The score's working, in words, for the explanation sheet. */
export function rankingLine(s: Scored): string {
  const p = s.parts;
  return `Urgency ${p.urgency} + importance ${p.impact} + ready to do ${p.actionability} + source confidence ${p.confidence}${
    p.fatigue ? ` − ${p.fatigue} for being snoozed before` : ''
  } = ${s.score}.`;
}

/**
 * "Why this?" opens the explanation sheet (`ExplanationSheet`): a bottom
 * sheet on a phone, a drawer beside the page on a desktop. It was an inline
 * `<details>` that pushed the list down by a screen's height when opened.
 */
function Why({ s, explain }: { s: Scored; explain: (s: Scored) => void }) {
  return (
    <button type="button" className="workspace-text-button" aria-haspopup="dialog" onClick={() => explain(s)}>
      Why this?
    </button>
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
  act: (id: string, event: ActionEvent, note?: string, until?: number, says?: string) => void;
  compact?: boolean;
}) {
  const [noting, setNoting] = useState<'correct' | 'help' | null>(null);
  // Which of the two small choosers is open: more snooze times, or why it is being hidden.
  const [choosing, setChoosing] = useState<'snooze' | 'why' | null>(null);
  const id = s.action.id;
  const { dispatch } = useStore();
  const now = useNow().getTime();
  const others: SnoozePreset[] = snoozePresets(now, s.action).filter((p) => p.id !== 'tomorrow');
  const snoozeWith = (p: SnoozePreset) => {
    setChoosing(null);
    act(id, 'snooze', undefined, p.until, `Snoozed until ${p.says}.`);
  };
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
      <button type="button" className="workspace-text-button" onClick={() => act(id, 'snooze', undefined, undefined, 'Snoozed until tomorrow morning.')}>Snooze until tomorrow</button>
      {!compact && others.length > 0 && (
        <button
          type="button"
          className="workspace-text-button"
          aria-expanded={choosing === 'snooze'}
          onClick={() => setChoosing(choosing === 'snooze' ? null : 'snooze')}
        >
          More snooze times
        </button>
      )}
      {!compact && choosing === 'snooze' && (
        <div role="group" aria-label={`Snooze ${s.action.title} until`} className="today-action-tools">
          {others.map((p) => (
            <button key={p.id} type="button" className="workspace-text-button" onClick={() => snoozeWith(p)}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      {!compact && (
        <>
          <button
            type="button"
            className="workspace-text-button"
            aria-expanded={choosing === 'why'}
            onClick={() => setChoosing(choosing === 'why' ? null : 'why')}
          >
            Not relevant
          </button>
          {choosing === 'why' && (
            <div role="group" aria-label={`Why hide ${s.action.title}`} className="today-action-tools">
              {DISMISS_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="workspace-text-button"
                  onClick={() => {
                    setChoosing(null);
                    act(id, 'dismiss', dismissNote(r.id));
                  }}
                >
                  {r.label}
                </button>
              ))}
              <button
                type="button"
                className="workspace-text-button"
                onClick={() => {
                  setChoosing(null);
                  act(id, 'dismiss');
                }}
              >
                Hide without saying why
              </button>
            </div>
          )}
          <button type="button" className="workspace-text-button" onClick={() => setNoting('correct')}>Something is wrong</button>
          <button
            type="button"
            className="workspace-text-button"
            onClick={() => {
              // With a person to ask, go to them: Get help opens on this action's
              // need with its details filled in and unticked. Otherwise — a
              // setup step, or the route switched off — keep the note.
              if (EXPERIENCE_FLAGS.humanHelp !== 'off' && helpFromAction(s.action)) {
                // The model wants a note on every ask; this one says where it went.
                act(id, 'help', 'Opened Get help to ask a person. Nothing is sent until you confirm there.');
                askForHelp(s.action, () => dispatch({ type: 'go', screen: 'university' }));
              } else {
                setNoting('help');
              }
            }}
          >
            Ask for help
          </button>
        </>
      )}
    </div>
  );
}

/**
 * "Report incorrect information", opened under the action it is about.
 *
 * The existing feedback form, started on "Wrong information" and naming the
 * action and its source, so the student only adds what is wrong. It sends
 * nothing until they press Send, and signed out it gives the address instead.
 */
function Report({ s, onClose }: { s: Scored; onClose: () => void }) {
  return (
    <div className="action-note">
      <Suspense fallback={<p className="today-sync-status">Opening…</p>}>
        <SaySomething initialKind="wrong" initialNote={`About "${s.action.title}" (${s.action.source.system}): `} />
      </Suspense>
      <button type="button" className="workspace-text-button" onClick={onClose}>Close</button>
    </div>
  );
}

function Row({
  s,
  now,
  act,
  reporting,
  setReporting,
  explain,
}: {
  s: Scored;
  now: number;
  act: (id: string, event: ActionEvent, note?: string, until?: number, says?: string) => void;
  reporting: string | null;
  setReporting: (id: string | null) => void;
  explain: (s: Scored) => void;
}) {
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
      <SourceBadge label={s.action.source.label} at={s.action.source.at} now={now} unknownAge onReport={() => setReporting(s.action.id)} />
      {reporting === s.action.id && <Report s={s} onClose={() => setReporting(null)} />}
      <Controls s={s} act={act} compact />
      <Why s={s} explain={explain} />
    </li>
  );
}

export function ActionCenter({
  actions,
  closure = null,
}: {
  actions: Action[];
  /** "You are set for today…", when Today has decided the day is done (`lib/today-center.ts`). */
  closure?: string | null;
}) {
  const { account } = useStore();
  const now = useNow().getTime();
  const key = `${ACTIONS_PREFIX}:${account?.id || 'device'}`;
  const library = useDeviceLibrary(key, readActionChoices, EMPTY_ACTION_CHOICES);
  const choices = library.value.choices;
  const ranked = useMemo(() => rank(actions, choices, now), [actions, choices, now]);
  const [said, setSaid] = useState<{ text: string; undo?: { id: string; prev: Choice | undefined } } | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [explaining, setExplaining] = useState<Scored | null>(null);

  const act = (id: string, event: ActionEvent, note?: string, until?: number, says?: string) => {
    const prev = choices[id];
    const moved = transition(prev, event, now, { until: until ?? tomorrowMorning(now), note });
    if (!moved.ok) {
      setSaid({ text: moved.why });
      return;
    }
    const saved = library.update((v) => ({ ...v, choices: { ...v.choices, [id]: moved.choice } }));
    setSaid(saved ? { text: says ?? DONE_SAYS[event] ?? 'Saved.', undo: { id, prev } } : { text: 'That could not be saved on this device.' });
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
      {closure && (
        <h2 className="action-done" id="action-done-line">{closure}</h2>
      )}
      <SectionLabel>{closure ? 'When you have a moment' : 'Next best step'}</SectionLabel>
      {library.error && <p role="alert">{library.error}</p>}
      {top ? (
        <article aria-labelledby="action-top-title">
          {dueLine(top.action, now) && <p className="today-sync-status">{dueLine(top.action, now)}</p>}
          <h2 id="action-top-title">{top.action.title}</h2>
          <p>{top.action.whyItMatters}</p>
          <SourceBadge label={top.action.source.label} at={top.action.source.at} now={now} unknownAge onReport={() => setReporting(top.action.id)} />
          {reporting === top.action.id && <Report s={top} onClose={() => setReporting(null)} />}
          <ActionButton tone="primary" onClick={() => go(top.action)}>{top.action.primary.label}</ActionButton>
          <Controls s={top} act={act} />
          <Why s={top} explain={setExplaining} />
          <ClarityQuestion />
        </article>
      ) : (
        <p className="today-clear">Nothing needs you right now. Anything you snoozed comes back at the time you chose.</p>
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
            {ranked.next.map((s) => <Row key={s.action.id} s={s} now={now} act={act} reporting={reporting} setReporting={setReporting} explain={setExplaining} />)}
          </ol>
        </>
      )}

      {ranked.rest.length > 0 && (
        <details className="today-why">
          <summary>View all ({ranked.rest.length} more)</summary>
          <ol className="action-list">
            {ranked.rest.map((s) => <Row key={s.action.id} s={s} now={now} act={act} reporting={reporting} setReporting={setReporting} explain={setExplaining} />)}
          </ol>
        </details>
      )}

      {ranked.hidden.some((h) => h.status === 'snoozed') && (
        <p className="today-sync-status">
          {ranked.hidden.filter((h) => h.status === 'snoozed').length} snoozed until the time you chose.
        </p>
      )}

      {/*
        The one way back for something hidden. "Not relevant" says it can be
        reopened, and the Undo beside it lasts only until the page changes, so
        without this list an accidental dismissal would be permanent.
      */}
      {ranked.hidden.some((h) => h.status === 'dismissed' || h.status === 'snoozed') && (
        <details className="today-why">
          <summary>Hidden ({ranked.hidden.filter((h) => h.status === 'dismissed' || h.status === 'snoozed').length})</summary>
          <ul className="action-list">
            {ranked.hidden
              .filter((h) => h.status === 'dismissed' || h.status === 'snoozed')
              .map((h) => (
                <li key={h.action.id}>
                  <button type="button" className="workspace-text-button" onClick={() => act(h.action.id, 'reopen')}>
                    Bring back: {h.action.title}
                  </button>
                  <span className="today-sync-status">
                    {' · '}
                    {h.status === 'dismissed' ? 'Not relevant' : 'Snoozed'}
                    {h.status === 'dismissed' && dismissReasonOf(choices[h.action.id]) ? ` · ${dismissReasonOf(choices[h.action.id])}` : ''}
                  </span>
                </li>
              ))}
          </ul>
        </details>
      )}

      {explaining && (
        <ExplanationSheet action={explaining.action} ranking={rankingLine(explaining)} onClose={() => setExplaining(null)} />
      )}
    </div>
  );
}
