import React, { useId } from 'react';
import { IconButton } from '../core/IconButton.jsx';
const FOC = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
/** Bottom sheet (mobile) / window (desktop). Default use: "Source & details" — origin, freshness, used in, limitations.
 * Hardened (modal): focus moves in on open and returns to the opener on close, Tab is trapped, Escape closes, background scroll locks, title is the labelled heading, scrim click can be disabled for unsaved work. */
export function Sheet({ title, children, onClose, inline = false, actions, description, closeOnScrim = true, initialFocus }) {
  const hid = useId(); const did = useId(); const ref = React.useRef(null);
  React.useEffect(() => {
    if (inline) return; const opener = document.activeElement; const box = ref.current; if (!box) return;
    const first = (initialFocus && box.querySelector(initialFocus)) || box.querySelector(FOC) || box; first.focus();
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (e) => { if (e.key === 'Escape' && onClose) { e.stopPropagation(); onClose(); return; } if (e.key !== 'Tab') return; const f = [...box.querySelectorAll(FOC)]; if (!f.length) { e.preventDefault(); return; } const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } };
    box.addEventListener('keydown', key);
    return () => { box.removeEventListener('keydown', key); document.body.style.overflow = prev; if (opener && opener.focus) opener.focus(); };
  }, [inline, initialFocus, onClose]);
  const box = (
    <div ref={ref} className={'sheet' + (inline ? ' is-inline' : '')} role={inline ? 'region' : 'dialog'} aria-modal={inline ? undefined : true} aria-labelledby={hid} aria-describedby={description ? did : undefined} tabIndex={-1}>
      {!inline && <div className="sheet-grip" aria-hidden="true"></div>}
      <div className="sheet-head"><h2 id={hid} style={{ fontSize: 'var(--type-display-xs)', fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: 0 }}>{title}</h2>{onClose && <IconButton icon="close" label={'Close ' + title} onClick={onClose} />}</div>
      {description && <p id={did} className="sheet-desc">{description}</p>}
      <div className="sheet-body">{children}</div>
      {actions && <div className="dialog-actions" style={{ marginTop: 'var(--sp-7)' }}>{actions}</div>}
    </div>
  );
  return inline ? box : <div className="sheet-scrim" onMouseDown={(e) => e.target === e.currentTarget && closeOnScrim && onClose && onClose()}>{box}</div>;
}
/** The Source & details definition list used inside a Sheet. Missing values say "Not recorded". */
export function SourceDetails({ items = [] }) {
  return <dl className="source-list">{items.map((it, i) => <React.Fragment key={it.label + i}><dt>{it.label}</dt><dd>{it.value === null || it.value === undefined || it.value === '' ? <span style={{ color: 'var(--text-tertiary)' }}>Not recorded</span> : it.value}</dd></React.Fragment>)}</dl>;
}
