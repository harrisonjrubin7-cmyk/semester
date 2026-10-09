import React from 'react';
/** Form error summary: count, each error linked to its field. Focus moves here on submit.
 * Hardened: focuses itself when errors first appear (autoFocus), de-duplicates by field, scrolls the field into view without scrollIntoView, supports field-less errors (e.g. server rejection) as plain text. */
export const ErrorSummary = React.forwardRef(function ErrorSummary({ errors = [], title, autoFocus = true, onFieldFocus }, ref) {
  const inner = React.useRef(null);
  const seen = new Set(); const list = errors.filter((e) => { const k = (e.field || '') + '|' + e.message; if (seen.has(k)) return false; seen.add(k); return true; });
  const had = React.useRef(false);
  React.useEffect(() => { const el = inner.current; if (list.length && !had.current && autoFocus && el) el.focus(); had.current = list.length > 0; }, [list.length, autoFocus]);
  if (!list.length) return null;
  const go = (ev, e) => { const el = e.field && document.getElementById(e.field); if (!el) return; ev.preventDefault(); const y = el.getBoundingClientRect().top + window.pageYOffset - 96; window.scrollTo({ top: y }); el.focus({ preventScroll: true }); if (onFieldFocus) onFieldFocus(e.field); };
  const n = list.length;
  return <div className="error-summary" role="alert" tabIndex={-1} ref={(el) => { inner.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }}><b><span aria-hidden="true">! </span>{title || (n + (n > 1 ? ' things need' : ' thing needs') + ' fixing before you continue')}</b><ul>{list.map((e, i) => <li key={(e.field || 'x') + i}>{e.field ? <a href={'#' + e.field} onClick={(ev) => go(ev, e)}>{e.message}</a> : e.message}</li>)}</ul></div>;
});
