import React, { useId } from 'react';
/** Native select, drawn in Semester's palette. Never imitate a select with a menu.
 * Hardened: placeholder that can't be re-chosen, hint/error association, required in words, disabled options, option groups. */
export function Select({ label, hint, error, options = [], groups, id, placeholder, required = false, ...rest }) {
  const auto = useId(); const fid = id || auto; const hid = fid + '-hint'; const eid = fid + '-err';
  const opt = (o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>);
  const extra = placeholder && rest.value === undefined && rest.defaultValue === undefined ? { defaultValue: '' } : {};
  return (
    <div className="field">
      <label className="field-label" htmlFor={fid}>{label}{required && <span className="field-req"> · Required</span>}</label>
      {hint && <span className="field-hint" id={hid}>{hint}</span>}
      <select id={fid} className="input" required={required} aria-required={required || undefined} aria-invalid={error ? 'true' : undefined} aria-describedby={[hint && hid, error && eid].filter(Boolean).join(' ') || undefined} {...extra} {...rest}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {groups ? groups.map((g) => <optgroup key={g.label} label={g.label}>{g.options.map(opt)}</optgroup>) : options.map(opt)}
      </select>
      {error && <span className="field-error" id={eid} aria-live="polite"><span aria-hidden="true">!</span>{error}</span>}
    </div>
  );
}
