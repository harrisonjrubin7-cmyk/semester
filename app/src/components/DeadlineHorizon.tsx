import { useState } from 'react';
import { GROUPS, GROUP_TEXT, group, type Deadline, type Group, type Grouped } from '../lib/deadline-groups';

export type RecoveryKind = 'Reschedule' | 'Break into steps' | 'Contact course staff' | 'Dismiss';

/** Groups that start open. The rest are one tap away, in a `<details>`. */
const OPEN_BY_DEFAULT: readonly Group[] = ['today', 'next48'];

/**
 * The deadline horizon: five groups, the two nearest open. A date that is
 * missing or unconfirmed sits in Needs confirmation, never in Today. Passed
 * items stay recoverable and say so; nothing is coloured as a failure.
 *
 * `onAction(id, kind)` is called with the item id and the recovery option the
 * student chose. Without it the options are plain text.
 */
export function DeadlineHorizon({
  deadlines,
  now: nowProp,
  onAction,
}: {
  deadlines: Deadline[];
  now?: number;
  onAction?: (id: string, kind: RecoveryKind) => void;
}) {
  // Read the clock once per mount, so a render never changes its own answer.
  const [mounted] = useState(() => Date.now());
  const now = nowProp ?? mounted;
  const grouped = group(deadlines, now);
  const total = GROUPS.reduce((n, g) => n + grouped[g].length, 0);
  if (total === 0) return <p className="today-why">Nothing is due in this horizon.</p>;

  return (
    <section aria-label="Deadline horizon" data-deadline-horizon>
      {GROUPS.map((g) => (
        <details key={g} open={OPEN_BY_DEFAULT.includes(g)} data-group={g}>
          <summary>
            {GROUP_TEXT[g]} ({grouped[g].length})
          </summary>
          {grouped[g].length === 0 ? (
            <p className="today-why">Nothing here.</p>
          ) : (
            <ul>
              {grouped[g].map((d) => (
                <Row key={d.id} item={d} onAction={onAction} />
              ))}
            </ul>
          )}
        </details>
      ))}
    </section>
  );
}

function Row({ item, onAction }: { item: Grouped; onAction?: (id: string, kind: RecoveryKind) => void }) {
  return (
    <li data-deadline={item.id}>
      <strong>{item.title}</strong>
      <p>{item.status}</p>
      <p className="today-why">{item.source}</p>
      <p className="today-why">Confidence: {item.confidence}</p>
      <p>{item.action}</p>
      <details className="today-why">
        <summary>More options</summary>
        <ul>
          {item.recovery.map((r) => (
            <li key={r}>
              {onAction ? (
                <button type="button" className="workspace-text-button" onClick={() => onAction(item.id, r as RecoveryKind)}>
                  {r}
                </button>
              ) : (
                r
              )}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
