import React, { useId } from 'react';
/** On/off setting. The state is spoken as a word beside the track, never carried by colour alone.
 * Hardened: pending state while a save is in flight (no double toggles), optional consequence sentence, custom state words, disabled reason. */
export function Switch({ checked = false, onChange, label, about, disabled, disabledReason, pending = false, onWord = 'On', offWord = 'Off', id }) {
  const auto = useId(); const fid = id || auto; const aid = fid + '-about';
  const desc = [about, disabled && disabledReason].filter(Boolean).join(' ');
  return (
    <button id={fid} type="button" role="switch" aria-checked={checked} aria-busy={pending || undefined} aria-describedby={desc ? aid : undefined} className="switch" data-pending={pending || undefined} disabled={disabled}
      onClick={() => !pending && onChange && onChange(!checked)} style={{ background: 'none', border: 0, padding: 0, color: 'var(--text-primary)', textAlign: 'left' }}>
      <span className="switch-track" aria-hidden="true"></span>
      <span className="switch-state" aria-hidden="true">{pending ? 'Saving…' : checked ? onWord : offWord}</span>
      <span className="switch-label">{label}{desc && <span className="choice-about" id={aid}>{desc}</span>}</span>
    </button>
  );
}
