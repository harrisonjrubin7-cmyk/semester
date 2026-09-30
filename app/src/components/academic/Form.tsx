import { useId, type ReactNode } from 'react';
import { Notice } from '../ui';

/**
 * The few pieces the Enrollment and Gradebook screens share.
 *
 * Both are forms over a ledger that answers every write, so both need the
 * same three things: a labelled field, a row of buttons that wraps at 320px,
 * and one place a write's answer is shown — with a retry when nobody knows
 * whether it landed. Written once here so the two screens cannot drift, and
 * so their inline styles are tokens in one file rather than literals in two.
 */

/** What `Field` hands its control: the id its label points at, and the id of its hint when there is one. */
export interface FieldIds {
  id: string;
  hint: string | undefined;
}

/**
 * A control and its visible label, tied by `htmlFor`, with the hint read out
 * after the name (`aria-describedby`) rather than only sitting under it.
 *
 * A render prop rather than a wrapping `<label>` so the control carries its
 * own `id` in the source, where `a11y/labels.ts` can see it — and so the hint,
 * which a wrapping label would have folded into the name, is a description.
 */
export function Field({ label, hint, children }: { label: string; hint?: string; children: (ids: FieldIds) => ReactNode }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-2)', minWidth: 0 }}>
      <label htmlFor={id}>{label}</label>
      {children({ id, hint: hintId })}
      {hint && (
        <span id={hintId} style={{ color: 'var(--app-dim)', fontSize: 'var(--type-sm)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** Controls side by side that wrap onto the next line rather than overflow. */
export function Row({ children, end = false }: { children: ReactNode; end?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', alignItems: end ? 'end' : 'center' }}>{children}</div>
  );
}

/** A form's fields, one column that never forces a horizontal scroll. */
export function Stack({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div role={label ? 'group' : undefined} aria-label={label} style={{ display: 'grid', gap: 'var(--sp-5)', marginBlock: 'var(--sp-5)' }}>
      {children}
    </div>
  );
}

/** What a write answered: `ok`, a refusal, or no answer at all — which offers the retry. */
export interface Said {
  tone: 'ok' | 'refused' | 'unknown';
  text: string;
  /** Offered only when the outcome is unknown: resends with the same key. */
  retry?: () => void;
}

export function Result({ said }: { said: Said | null }) {
  if (!said) return null;
  return (
    <div>
      <Notice alert={said.tone !== 'ok'}>{said.text}</Notice>
      {said.retry && (
        <button type="button" className="btn" onClick={said.retry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** A secondary line under a row's title. */
export function Sub({ children }: { children: ReactNode }) {
  return <div style={{ color: 'var(--app-dim)', fontSize: 'var(--type-sm)' }}>{children}</div>;
}

/** A list of rows with a rule between them. */
export function Rows({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul aria-label={label} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {children}
    </ul>
  );
}

export function RowItem({ children }: { children: ReactNode }) {
  return (
    <li style={{ display: 'grid', gap: 'var(--sp-3)', paddingBlock: 'var(--sp-5)', borderBottom: '1px solid var(--app-line-soft)' }}>
      {children}
    </li>
  );
}
