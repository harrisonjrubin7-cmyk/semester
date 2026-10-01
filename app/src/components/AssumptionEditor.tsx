import { useCallback, useRef, useState } from 'react';
import type { AssumptionAdapter } from '../lib/assumptions';

/** Drafts live only in this component. Account/context keys discard them on navigation. */
export function AssumptionEditor({ assumptions, title = 'Review planning assumptions' }: {
  assumptions: AssumptionAdapter[];
  title?: string;
}) {
  const returnTo = useRef<string | null>(null);
  const focusEdit = useCallback((id: string, element: HTMLButtonElement | null) => {
    if (element && returnTo.current === id) { returnTo.current = null; element.focus(); }
  }, []);
  return <details className="portal-panel">
    <summary>{title}</summary>
    {assumptions.length ? assumptions.map(assumption => <AssumptionRow
      key={JSON.stringify([assumption.id, assumption.owner, assumption.label, assumption.value, assumption.source, assumption.context])}
      assumption={assumption}
      editRef={element => focusEdit(assumption.id, element)}
      onClose={() => { returnTo.current = assumption.id; }}
    />) : <p>No assumptions recorded. Dependent outcomes are unknown.</p>}
  </details>;
}

function AssumptionRow({ assumption: a, initialValue, onClose, editRef }: { assumption: AssumptionAdapter; initialValue?: string; onClose?: () => void; editRef?: (element: HTMLButtonElement | null) => void }) {
  const [draft, setDraft] = useState<string | null>(initialValue ?? null);
  const [preview, setPreview] = useState(initialValue !== undefined);
  const [error, setError] = useState('');
  const focusDraft = useCallback((element: HTMLInputElement | HTMLSelectElement | null) => { element?.focus(); }, []);
  const valid = draft !== null && a.validate(draft);
  return <fieldset>
    <legend>{a.label}</legend>
    <p>Value: {a.value || 'Not recorded'} · Owner: {a.owner === 'institution' ? 'Institution — locked' : 'You'}</p>
    <p>Source: {a.source || 'Not recorded'}</p>
    <ul aria-label={`Current outcomes for ${a.label}`}>{a.outcomes(a.value).map((outcome, i) => <li key={i}>{outcome}</li>)}</ul>
    {draft === null ? <button ref={editRef} type="button" disabled={a.owner === 'institution'} onClick={() => setDraft(a.value)}>Edit {a.label}</button> : <>
      <label>Proposed {a.label}{a.options ? <select ref={focusDraft} className="input" aria-label={`Proposed ${a.label}`} value={draft} onChange={e => { setDraft(e.target.value); setPreview(false); setError(''); }}>{a.options.map(option => <option key={option}>{option}</option>)}</select> : <input ref={focusDraft} className="input" aria-label={`Proposed ${a.label}`} type={a.type || 'text'} min={a.min} max={a.max} step={a.step ?? 'any'} maxLength={a.maxLength}
        value={draft} onChange={e => { setDraft(e.target.value); setPreview(false); setError(''); }} />}</label>
      {!valid && <p role="status">Enter a valid value{a.type === 'number' ? ` between ${a.min} and ${a.max}` : ''}.</p>}
      <button type="button" disabled={!valid} onClick={() => setPreview(true)}>Preview {a.label}</button>
      {preview && valid && <section aria-label={`Preview ${a.label}`}>
        <p>Before: {a.value || 'Not recorded'} → After: {draft || 'Not recorded'}</p>
        <ul>{a.outcomes(draft!).map((outcome, i) => <li key={i}>{outcome}</li>)}</ul>
        <button type="button" onClick={() => {
          if (a.owner === 'institution' || !a.validate(draft!)) return;
          if (a.apply(draft!) === false) setError('Could not apply this change. Your original value is preserved.');
          else { setDraft(null); setPreview(false); onClose?.(); }
        }}>Apply {a.label}</button>
      </section>}
      <button type="button" onClick={() => { setDraft(null); setPreview(false); setError(''); onClose?.(); }}>Cancel {a.label}</button>
      {error && <p role="alert">{error}</p>}
    </>}
  </fieldset>;
}


export interface NativeAssumptionRequest { id: string; value: string; token: number }

/** A native change opens the same draft/preview controls; no mutation happens here. */
export function NativeAssumptionEditor({ assumptions, request, onClose }: {
  assumptions: AssumptionAdapter[];
  request: NativeAssumptionRequest;
  onClose: () => void;
}) {
  const assumption = assumptions.find(a => a.id === request.id);
  return assumption && assumption.owner !== 'institution' ? <section className="portal-panel" aria-label="Pending assumption change">
    <p>Review this change before applying it. Your saved value is unchanged.</p>
    <AssumptionRow key={JSON.stringify([request.token, assumption.id, assumption.label, assumption.value, assumption.source, assumption.owner, assumption.context])} assumption={assumption} initialValue={request.value} onClose={onClose} />
  </section> : null;
}

export function useNativeAssumptions(assumptions: AssumptionAdapter[], scope: string) {
  const [request, setRequest] = useState<(NativeAssumptionRequest & { scope: string; before: string }) | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const close = () => { setRequest(null); if (returnFocus.current?.isConnected) returnFocus.current.focus(); };
  const [previousScope, setPreviousScope] = useState(scope);
  if (scope !== previousScope) { setPreviousScope(scope); setRequest(null); }
  const signature = (a: AssumptionAdapter) => JSON.stringify([a.id, a.label, a.value, a.source, a.owner, a.context]);
  const current = assumptions.find(a => a.id === request?.id);
  if (request?.scope === scope && (!current || request.before !== signature(current))) setRequest(null);
  const visible = request?.scope === scope && current && request.before === signature(current) ? request : null;
  return {
    edit: (id: string, value: string) => {
      const a = assumptions.find(candidate => candidate.id === id);
      if (a && a.owner !== 'institution') {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setRequest(old => ({ id, value, scope, before: signature(a), token: (old?.token ?? 0) + 1 }));
      }
    },
    editor: visible ? <NativeAssumptionEditor assumptions={assumptions} request={visible} onClose={close} /> : null,
  };
}

/** Existing multi-field draft forms use the same before/after outcome presentation. */
export function AssumptionImpact({ label, before, after }: { label: string; before: string[]; after: string[] }) {
  return <section aria-label={`Preview ${label}`}>
    <p>Current outcomes</p><ul>{before.map((line, i) => <li key={i}>{line}</li>)}</ul>
    <p>Proposed outcomes — review before saving</p><ul>{after.map((line, i) => <li key={i}>{line}</li>)}</ul>
  </section>;
}
