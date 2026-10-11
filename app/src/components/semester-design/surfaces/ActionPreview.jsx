import React from 'react';
const RECOVERY = { undo: 'You can undo this.', request: 'This can be reversed on request: ', none: 'This can’t be undone.' };
/** What a person is about to do, said before they do it. Recovery is required.
 * Hardened: an unknown or missing recovery kind is treated as "can't be undone" (never implies safety), who else is affected and when it takes effect are explicit, irreversible actions are marked for the confirm button to pick up. */
export function ActionPreview({ subject, says, exactly, doesNotChange, recovery = { kind: 'undo' }, subjectTo, provenance, affects, effective, cost }) {
  const kind = recovery && RECOVERY[recovery.kind] ? recovery.kind : 'none';
  return (
    <div className="action-preview" data-recovery={kind}>
      {subject && <p style={{ margin: 0 }}><strong>{subject}</strong></p>}
      {provenance}
      <dl className="action-preview-facts">
        <dt>What happens</dt><dd>{says}</dd>
        {exactly && <><dt>Exactly what</dt><dd>{exactly}</dd></>}
        {affects && <><dt>Who else is affected</dt><dd>{affects}</dd></>}
        {effective && <><dt>When</dt><dd>{effective}</dd></>}
        {cost && <><dt>Cost</dt><dd>{cost}</dd></>}
        {doesNotChange && <><dt>What stays the same</dt><dd>{doesNotChange}</dd></>}
        <dt>Taking it back</dt><dd>{kind === 'none' && <span aria-hidden="true">⊘ </span>}{RECOVERY[kind]}{recovery && recovery.how ? ' ' + recovery.how : ''}</dd>
      </dl>
      {subjectTo && <p className="action-preview-caveat">{subjectTo}</p>}
    </div>
  );
}
