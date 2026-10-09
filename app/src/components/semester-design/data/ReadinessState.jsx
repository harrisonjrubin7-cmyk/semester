import React from 'react';
/** Outcome state for a readiness check (registration readiness and similar). Never shows "eligible" when evidence is missing. Glyph + words carry meaning. */
const RS = {
  ready_as_of: ['✓', 'Ready'],
  blocked: ['⊘', 'Blocked'],
  review_required: ['?', 'Review required'],
  unknown: ['◌', 'Unknown'],
  stale: ['◷', 'Out of date'],
  handoff_pending: ['⇄', 'With an office'],
  action_completed: ['✓', 'Done'],
};
export function ReadinessState({ state = 'unknown', label, asOf, source }) {
  const [g, w] = RS[state] || RS.unknown;
  const sub = [state === 'ready_as_of' && asOf ? 'as of ' + asOf : asOf, source].filter(Boolean).join(' · ');
  return <span className="rds" data-state={state}><span aria-hidden="true">{g}</span><span>{label || w}</span>{sub && <span className="gov-sub">{sub}</span>}</span>;
}
