import React from 'react';
const GLYPH = { waiting: '○', working: '…', done: '✓', failed: '!' };
const SAID = { waiting: 'waiting', working: 'in progress', done: 'done', failed: 'failed' };
/** A process in named steps — "Gathering sources → Drafting → Ready". Shows the work instead of faking certainty. */
export function StepStatus({ steps = [], label = 'Progress' }) {
  return (
    <ol className="state-steps" aria-label={label}>
      {steps.map((s) => (
        <li key={s.label} data-state={s.state} aria-current={s.state === 'working' ? 'step' : undefined}>
          <span className="status-glyph" aria-hidden="true" style={{ width: '1em', textAlign: 'center' }}>{GLYPH[s.state]}</span>{s.label}<span className="sr-only"> — {SAID[s.state]}</span>
        </li>
      ))}
    </ol>
  );
}
