import { useState } from 'react';
import { STATE_TEXT, orderQueue, stateOf, type Assignment } from '../lib/triage';

export type AssignmentOption = 'focus' | 'reserve' | 'steps' | 'help' | 'later';

const OPTIONS: ReadonlyArray<readonly [AssignmentOption, string]> = [
  ['focus', 'Start a focus session'],
  ['reserve', 'Reserve time'],
  ['steps', 'Break into steps'],
  ['help', 'Ask for help'],
  ['later', 'Not now'],
];

/**
 * Assignments as states a student can act on, never as scores. Open work
 * comes first in `orderQueue()` order; waiting, blocked, deferred and finished work
 * is folded into one closed group. The weighting behind the order is private
 * to `lib/triage.ts` and nothing numeric is drawn here.
 *
 * `onOption(id, option)` is called when the student picks one of the five
 * options. Without it the buttons do nothing.
 */
export function AssignmentStates({
  assignments,
  now: nowProp,
  onOption,
}: {
  assignments: Assignment[];
  now?: number;
  onOption?: (id: string, option: AssignmentOption) => void;
}) {
  // Read the clock once per mount, so a render never changes its own answer.
  const [mounted] = useState(() => Date.now());
  const now = nowProp ?? mounted;
  if (assignments.length === 0) return <p className="today-why">No assignments are saved yet.</p>;
  const open = orderQueue(assignments, now);
  const openIds = new Set(open.map((a) => a.id));
  const rest = assignments.filter((a) => !openIds.has(a.id));

  return (
    <section aria-label="Assignments" data-assignment-states>
      {open.length > 1 ? (
        // The order is a suggestion and the student can question it: this says
        // what it was made from, in words, with no number to read as a verdict.
        <p className="today-why" data-order-note>
          Ordered by how soon each is due, then what you marked important, what other work waits on it, and time you
          have already saved. It is a suggestion, not a verdict on any of it.
        </p>
      ) : null}
      {open.length > 0 ? (
        <ul>
          {open.map((a) => (
            <Row key={a.id} a={a} now={now} onOption={onOption} />
          ))}
        </ul>
      ) : null}
      {rest.length > 0 ? (
        <details>
          <summary>Waiting, blocked or finished</summary>
          <ul>
            {rest.map((a) => (
              <Row key={a.id} a={a} now={now} onOption={onOption} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function Row({ a, now, onOption }: { a: Assignment; now: number; onOption?: (id: string, o: AssignmentOption) => void }) {
  const t = stateOf(a, now);
  return (
    <li data-assignment={a.id} data-state={t.state}>
      <p className="today-why">{a.course}</p>
      <strong>{a.title}</strong>
      <p>{STATE_TEXT[t.state]}</p>
      {t.reasons.length > 0 ? (
        <ul>
          {t.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
      {t.unknowns.length > 0 ? (
        <>
          <p className="today-why">What Semester does not know</p>
          <ul>
            {t.unknowns.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </>
      ) : null}
      <div>
        <button type="button" className="btn" onClick={() => onOption?.(a.id, OPTIONS[0][0])}>
          {OPTIONS[0][1]}
        </button>
        <details>
          <summary>Other ways to handle this</summary>
          <ul className="assignment-options-list">
            {OPTIONS.slice(1).map(([key, label]) => (
              <li key={key}>
                <button type="button" className="btn" onClick={() => onOption?.(a.id, key)}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </li>
  );
}
