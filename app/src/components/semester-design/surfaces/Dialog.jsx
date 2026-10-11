import React, { useEffect, useRef, useId } from 'react';
const FOC = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
/** Modal confirmation. Focus lands on Cancel; Escape closes; consequential actions name object, consequence, recovery.
 * Hardened: Tab trapped, focus returns to the opener, background scroll locked, labelled + described, confirm disabled while busy (no double submits), optional type-to-confirm for irreversible actions, error slot keeps the dialog open, scrim click ignored while busy or when typed confirmation is required. */
export function Dialog({ open = true, title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, destructive = false, inline = false, busy = false, error, confirmText, description }) {
  const cancelRef = useRef(null); const boxRef = useRef(null); const hid = useId(); const did = useId(); const tid = useId();
  const [typed, setTyped] = React.useState('');
  useEffect(() => {
    if (!open || inline) return; const opener = document.activeElement; const box = boxRef.current;
    if (cancelRef.current) cancelRef.current.focus();
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (e) => { if (e.key !== 'Tab' || !box) return; const f = [...box.querySelectorAll(FOC)]; if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } };
    if (box) box.addEventListener('keydown', key);
    return () => { if (box) box.removeEventListener('keydown', key); document.body.style.overflow = prev; if (opener && opener.focus) opener.focus(); };
  }, [open, inline]);
  // Reset typed confirmation after close so reopening never retains authority.
  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => { if (!open) setTyped(''); }, [open]);
  if (!open) return null;
  const needType = !!confirmText; const ok = !needType || typed.trim() === confirmText;
  const box = (
    <div ref={boxRef} className="dialog" role={destructive ? 'alertdialog' : 'dialog'} aria-modal={inline ? undefined : true} aria-labelledby={hid} aria-describedby={description ? did : undefined} aria-busy={busy || undefined} onKeyDown={(e) => { if (e.key === 'Escape' && onCancel && !busy) { e.stopPropagation(); onCancel(); } }}>
      <h2 className="dialog-title" id={hid}>{title}</h2>
      {description && <p id={did} className="dialog-desc">{description}</p>}
      <div>{children}</div>
      {needType && <div className="field" style={{ marginTop: 'var(--sp-6)' }}><label className="field-label" htmlFor={tid}>Type <span className="mono">{confirmText}</span> to confirm</label><input id={tid} className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} /></div>}
      {error && <p className="field-error" role="alert" style={{ marginTop: 'var(--sp-5)' }}><span aria-hidden="true">!</span>{error}</p>}
      <div className="dialog-actions">
        <button ref={cancelRef} type="button" className="btn" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <button type="button" className={destructive ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm} disabled={busy || !ok}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </div>
  );
  return inline ? box : <div className="dialog-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && onCancel && !busy && !needType) onCancel(); }}>{box}</div>;
}
