import { useId, useState } from 'react';
import { seedHelp } from '../lib/help-routes';
import { NEVER, allDoors, route, summary, type Door } from '../lib/nowrongdoor';
import { useStore } from '../state/store';
import { EXPERIENCE_FLAGS } from '../lib/experience-flags';
import { ActionButton, SectionLabel } from './ui';

/**
 * "Describe the problem" — the no-wrong-door front of Help.
 *
 * One field, the student's own words, and the answer `lib/nowrongdoor.ts`
 * gives: whose question it is, what Semester can do first, what to bring, and
 * a way to the person. Nothing typed here is stored: the sentence lives in
 * this component and is gone when the screen is. When the student chooses to
 * ask a person, the sentence becomes the question on the help form, where
 * they read exactly what will be sent before it goes.
 */
export function NoWrongDoor() {
  const { dispatch } = useStore();
  const [problem, setProblem] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const field = useId();
  const shown = asked === null ? null : route(asked);
  const every = asked !== null && shown === null ? allDoors() : null;

  const ask = (d: Door) => {
    if (EXPERIENCE_FLAGS.humanHelp === 'off' || d.handoff === 'directory') return;
    seedHelp({ need: d.need.id, from: 'From “Describe the problem” on Help', fields: {}, question: (asked ?? '').trim() }, () => dispatch({ type: 'go', screen: 'university' }));
  };

  return (
    <section className="no-wrong-door" aria-label="Describe the problem">
      <SectionLabel>Describe the problem</SectionLabel>
      <p className="no-wrong-door-lead">
        In your own words. Semester says whose question it is, what it can do first, and what to bring. Nothing you type here is kept.
      </p>
      <label htmlFor={field} className="sr-only">
        What is going on
      </label>
      <textarea
        id={field}
        className="input"
        rows={2}
        value={problem}
        placeholder="I do not understand why I cannot register."
        onChange={(e) => {
          setProblem(e.target.value);
          setAsked(null);
          setCopied(false);
        }}
      />
      <div className="no-wrong-door-actions">
        <ActionButton tone="primary" disabled={!problem.trim()} onClick={() => setAsked(problem)}>
          Find the right door
        </ActionButton>
      </div>

      {shown && (
        <div className="no-wrong-door-answer" role="status" aria-live="polite">
          <p className="no-wrong-door-owner">
            <strong>{shown.owner}</strong> owns this. {shown.need.note}
          </p>
          <p className="no-wrong-door-head">What Semester can do first</p>
          <ul className="no-wrong-door-list">
            {shown.can.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="no-wrong-door-head">Next</p>
          <ul className="no-wrong-door-list">
            {shown.next.map((s) => (
              <li key={s.label}>
                {s.screen ? (
                  <button type="button" className="bare link-quiet tap-y" onClick={() => dispatch({ type: 'go', screen: s.screen! })}>
                    {s.label}
                  </button>
                ) : (
                  s.label
                )}
              </li>
            ))}
          </ul>
          <div className="no-wrong-door-actions">
            {shown.handoff === 'request' && EXPERIENCE_FLAGS.humanHelp !== 'off' && (
              <ActionButton tone="primary" onClick={() => ask(shown)}>
                Ask {shown.owner.toLowerCase()}
              </ActionButton>
            )}
            <ActionButton
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(summary(asked ?? '', shown))
                  .then(() => setCopied(true))
                  .catch(() => {});
              }}
            >
              {copied ? 'Copied' : 'Copy a summary to take with you'}
            </ActionButton>
          </div>
          <p className="no-wrong-door-never">{NEVER}</p>
        </div>
      )}

      {every && (
        <div className="no-wrong-door-answer" role="status" aria-live="polite">
          <p className="no-wrong-door-owner">Semester cannot tell from that sentence whose question it is. Every door, so none is wrong:</p>
          <ul className="no-wrong-door-list">
            {every.map((d) => (
              <li key={d.need.id}>
                <strong>{d.need.label}</strong> — {d.owner}
              </li>
            ))}
          </ul>
          <p className="no-wrong-door-never">{NEVER}</p>
        </div>
      )}
    </section>
  );
}
