import React, { useId } from 'react';
/** Labelled text input. Persistent visible label; hint, error and character count are programmatically associated.
 * Hardened: required/optional said in words (not just *), error announced politely, maxLength counter, read-only and disabled kept distinct, prefix/suffix units. */
export function TextField({ label, hint, error, multiline = false, id, required = false, optional = false, maxLength, showCount, prefix, suffix, readOnly, disabled, value, defaultValue, onChange, ...rest }) {
  const auto = useId(); const fid = id || auto; const hid = fid + '-hint'; const eid = fid + '-err'; const cid = fid + '-count';
  const [len, setLen] = React.useState(String(value ?? defaultValue ?? '').length);
  const El = multiline ? 'textarea' : 'input';
  const count = maxLength && (showCount ?? true);
  const near = count && len >= maxLength * 0.9;
  const input = <El id={fid} className="input" aria-invalid={error ? 'true' : undefined} aria-required={required || undefined} required={required} readOnly={readOnly} disabled={disabled} maxLength={maxLength} value={value} defaultValue={defaultValue}
    aria-describedby={[hint && hid, error && eid, count && cid].filter(Boolean).join(' ') || undefined}
    onChange={(e) => { setLen(e.target.value.length); if (onChange) onChange(e); }} {...rest} />;
  return (
    <div className="field" data-readonly={readOnly || undefined} data-disabled={disabled || undefined}>
      <label className="field-label" htmlFor={fid}>{label}{required && <span className="field-req"> · Required</span>}{optional && !required && <span className="field-opt"> · Optional</span>}</label>
      {hint && <span className="field-hint" id={hid}>{hint}</span>}
      {prefix || suffix ? <div className="input-affix">{prefix && <span className="affix" aria-hidden="true">{prefix}</span>}{input}{suffix && <span className="affix" aria-hidden="true">{suffix}</span>}</div> : input}
      <div className="field-foot">
        {error ? <span className="field-error" id={eid} aria-live="polite"><span aria-hidden="true">!</span>{error}</span> : <span></span>}
        {count && <span className="field-count" id={cid} data-near={near || undefined}>{len} / {maxLength}<span className="sr-only">{near ? ' characters, close to the limit' : ' characters'}</span></span>}
      </div>
    </div>
  );
}
