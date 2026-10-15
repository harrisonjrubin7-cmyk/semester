import React, { useId } from 'react';
/** Native date (and optional time) input with a visible label and the date spoken back unambiguously. */
export function DateField({ label, hint, value, onChange, withTime = false, said }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      {hint && <span className="field-hint">{hint}</span>}
      <input id={id} className="input nums" type={withTime ? 'datetime-local' : 'date'} value={value} onChange={onChange} />
      {said && <span className="field-hint nums">{said}</span>}
    </div>
  );
}
