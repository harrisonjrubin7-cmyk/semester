import { useId, useState } from 'react';
import type { GuideActionKind, GuideModel } from '../lib/guide-bar';

/**
 * The Semester Guide bar: the model from `lib/guide-bar.ts`, drawn.
 *
 * It decides nothing. What it says, what it counts and whether it shows at all
 * are the model's; this only turns that into a labelled region with buttons.
 * "Why this matters" opens the explanation in place (what it used, what it
 * does not know) rather than navigating, so Understand never costs the student
 * their place. Every other button reports its kind to the screen, which owns
 * what happens next and passes back `confirmation` to be said.
 *
 * Reuses the sync strip's classes: one quiet line under the header, the panel
 * colour, no warning tone. Nothing here is coloured by how soon something is.
 */
export function GuideBar({
  model,
  confirmation,
  onAction,
}: {
  model: GuideModel;
  /** What the last choice did, from `confirmationFor`. Spoken politely, not announced as an alert. */
  confirmation?: string | null;
  onAction: (kind: Exclude<GuideActionKind, 'why'>) => void;
}) {
  const [open, setOpen] = useState(false);
  const detail = useId();
  if (model.hidden) return null;

  return (
    <section aria-label="Semester Guide" data-guide-bar className="sync-strip">
      <p className="sync-strip-text">{model.minimal ? model.line : model.headline}</p>
      {!model.minimal && model.nextBestStep && (
        <p className="sync-strip-text">
          <strong>Next: </strong>
          {model.nextBestStep}
        </p>
      )}
      {model.actions.map((a) =>
        a.kind === 'why' ? (
          <button key={a.kind} type="button" className="bare tappable sync-strip-btn" aria-expanded={open} aria-controls={detail} onClick={() => setOpen(!open)}>
            {a.label}
          </button>
        ) : (
          <button key={a.kind} type="button" className="bare tappable sync-strip-btn" onClick={() => onAction(a.kind as Exclude<GuideActionKind, 'why'>)}>
            {a.label}
          </button>
        ),
      )}
      {/* Always in the document, hidden while closed: the button's aria-controls
          has to name something that exists, and the accessibility smoke fails a
          reference to an element that is not there. */}
      <div id={detail} className="sync-strip-text" hidden={!open || model.minimal}>
          {model.why && <p>{model.why}</p>}
          <p>
            <strong>What this used</strong>
          </p>
          <ul>
            {model.dataUsed.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p>
            <strong>What it does not know</strong>
          </p>
          <ul>
            {model.doesNotKnow.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
      </div>
      <p className="sync-strip-text" role="status">
        {confirmation ?? ''}
      </p>
    </section>
  );
}
