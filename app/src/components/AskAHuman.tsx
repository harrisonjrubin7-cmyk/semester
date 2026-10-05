import { URGENT_SAFETY_TEXT, needs, type AskNeed, type AskNeedId } from '../lib/ask-human';

/**
 * Ask a human: the ten needs from `lib/ask-human.ts`, each with who to
 * contact, why, what to bring and where the official answer lives.
 *
 * The safety line is outside every disclosure, above the list, so it is on
 * screen whether or not anything is open. Nothing here is suggested to the
 * student or ordered by what they have done; they open the one that fits.
 */
export function AskAHuman({
  list = needs(),
  onPick,
}: {
  list?: readonly AskNeed[];
  /** Called when the student opens a need's own button for details elsewhere. Optional. */
  onPick?: (id: AskNeedId) => void;
}) {
  return (
    <section aria-label="Ask a human" className="today-why">
      <p role="note">{URGENT_SAFETY_TEXT}</p>
      <h2>Who can help with what</h2>
      {list.map((n) => (
        <details key={n.id} onToggle={(e) => (e.currentTarget.open ? onPick?.(n.id) : undefined)}>
          <summary>{n.label}</summary>
          <p>{n.why}</p>
          <p>
            <strong>Contact: </strong>
            {n.contact}
          </p>
          {n.directoryOnly && <p>Semester only points to this office. It sends and stores nothing about it.</p>}
          {n.urgentText && <p>{n.urgentText}</p>}
          {n.documents.length > 0 && (
            <div>
              <p>
                <strong>What to bring</strong>
              </p>
              <ul>
                {n.documents.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          <p>
            <strong>Official source: </strong>
            {n.officialSource}
          </p>
          <p>
            <strong>Getting ready</strong>
          </p>
          <ul>
            {n.appointmentPrep.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
