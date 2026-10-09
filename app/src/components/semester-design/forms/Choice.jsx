import React, { useId } from 'react';
/** Radio or checkbox with a label and an optional sentence explaining the consequence.
 * Hardened: the consequence sentence is the input's description (aria-describedby), disabled says why, error state, mixed state for "some selected" checkboxes. */
export function Choice({ type = 'radio', label, about, checked, defaultChecked, onChange, name, value, disabled, disabledReason, error, mixed = false, required, id }) {
  const auto = useId(); const fid = id || auto; const aid = fid + '-about'; const eid = fid + '-err';
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current && type === 'checkbox') ref.current.indeterminate = !!mixed; }, [mixed, type]);
  return (
    <label className="choice" htmlFor={fid} data-disabled={disabled || undefined} data-invalid={error ? true : undefined}>
      <input ref={ref} id={fid} type={type} name={name} value={value} checked={checked} defaultChecked={defaultChecked} onChange={onChange} disabled={disabled} required={required}
        aria-checked={mixed && type === 'checkbox' ? 'mixed' : undefined} aria-invalid={error ? 'true' : undefined} aria-describedby={[about && aid, disabled && disabledReason && aid, error && eid].filter(Boolean).join(' ') || undefined} />
      <span>{label}{about && <span className="choice-about" id={aid}>{about}{disabled && disabledReason ? ' ' + disabledReason : ''}</span>}{!about && disabled && disabledReason && <span className="choice-about" id={aid}>{disabledReason}</span>}{error && <span className="field-error" id={eid}><span aria-hidden="true">!</span>{error}</span>}</span>
    </label>
  );
}
