import { useState } from 'react';
import type { AssumptionAdapter } from '../lib/assumptions';

/** Drafts live only in this component. Account/context keys discard them on navigation. */
export function AssumptionEditor({ assumptions, title = 'Review planning assumptions' }: {
  assumptions: AssumptionAdapter[];
  title?: string;
}) {
  return <details className="portal-panel">
    <summary>{title}</summary>
    {assumptions.length ? assumptions.map(assumption => <AssumptionRow
      key={JSON.stringify([assumption.id, assumption.owner, assumption.label, assumption.value, assumption.source])}
      assumption={assumption}
    />) : <p>No assumptions recorded. Dependent outcomes are unknown.</p>}
  </details>;
}

function AssumptionRow({ assumption: a }: { assumption: AssumptionAdapter }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const valid = draft !== null && a.validate(draft);
  return <fieldset>
    <legend>{a.label}</legend>
    <p>Value: {a.value || 'Not recorded'} · Owner: {a.owner === 'institution' ? 'Institution — locked' : 'You'}</p>
    <p>Source: {a.source || 'Not recorded'}</p>
    <ul aria-label={`Current outcomes for ${a.label}`}>{a.outcomes(a.value).map((outcome, i) => <li key={i}>{outcome}</li>)}</ul>
    {draft === null ? <button type="button" disabled={a.owner === 'institution'} onClick={() => setDraft(a.value)}>Edit {a.label}</button> : <>
      <label>Proposed {a.label}{a.options ? <select className="input" aria-label={`Proposed ${a.label}`} value={draft} onChange={e => { setDraft(e.target.value); setPreview(false); setError(''); }}>{a.options.map(option => <option key={option}>{option}</option>)}</select> : <input className="input" aria-label={`Proposed ${a.label}`} type={a.type || 'text'} min={a.min} max={a.max} step={a.step ?? 'any'} maxLength={a.maxLength}
        value={draft} onChange={e => { setDraft(e.target.value); setPreview(false); setError(''); }} />}</label>
      {!valid && <p role="status">Enter a valid value{a.type === 'number' ? ` between ${a.min} and ${a.max}` : ''}.</p>}
      <button type="button" disabled={!valid} onClick={() => setPreview(true)}>Preview {a.label}</button>
      {preview && valid && <section aria-label={`Preview ${a.label}`}>
        <p>Before: {a.value || 'Not recorded'} → After: {draft || 'Not recorded'}</p>
        <ul>{a.outcomes(draft!).map((outcome, i) => <li key={i}>{outcome}</li>)}</ul>
        <button type="button" onClick={() => {
          if (a.owner === 'institution' || !a.validate(draft!)) return;
          if (a.apply(draft!) === false) setError('Could not apply this change. Your original value is preserved.');
          else { setDraft(null); setPreview(false); }
        }}>Apply {a.label}</button>
      </section>}
      <button type="button" onClick={() => { setDraft(null); setPreview(false); setError(''); }}>Cancel {a.label}</button>
      {error && <p role="alert">{error}</p>}
    </>}
  </fieldset>;
}
