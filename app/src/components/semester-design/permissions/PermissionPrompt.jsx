import React, { useId } from 'react';
/** Semester's own pre-prompt, shown before the system permission dialog. Why, when, fallback, what's kept.
 * Hardened: unique heading ids (several prompts per page), "Not now" never blocks the fallback path, denied-by-you vs blocked-by-device kept distinct, unsupported devices get the fallback only, busy while the OS dialog is open, managed-device note. */
export function PermissionPrompt({ capability, glyph = '?', why, when, fallback, kept, allowLabel = 'Continue', onAllow, onNotNow, onUseFallback, fallbackLabel, state = 'ask', managedBy, settingsHint = 'Settings › Semester' }) {
  const tid = useId();
  const S = { ask: null, requesting: ['…', 'Waiting for your device’s answer.'], granted: ['✓', 'On. You can turn this off in Privacy › Device.'], denied: ['○', 'Not now. You can turn this on later in Privacy › Device.'], blocked: ['⊘', 'Blocked in your device settings. Semester can’t ask again; change it in ' + settingsHint + '.'], unsupported: ['–', 'This device can’t provide your ' + capability + '.'], managed: ['⊘', 'Turned off by ' + (managedBy || 'your organisation') + '.'] };
  const st = S.hasOwnProperty(state) ? state : 'ask'; const s = S[st];
  return (
    <section className="perm-prompt" data-state={st} aria-labelledby={tid} aria-busy={st === 'requesting' || undefined}>
      <div className="perm-head"><span className="perm-glyph" aria-hidden="true">{glyph}</span><div><div className="perm-kicker">{st === 'ask' || st === 'requesting' ? 'Semester will ask your device' : 'Device permission'}</div><h3 id={tid} className="perm-title">Use your {capability}?</h3></div></div>
      <dl className="perm-facts">
        <div><dt>Why</dt><dd>{why}</dd></div>
        {when && <div><dt>When</dt><dd>{when}</dd></div>}
        {fallback && <div><dt>If you say no</dt><dd>{fallback}</dd></div>}
        {kept && <div><dt>What's kept</dt><dd>{kept}</dd></div>}
      </dl>
      {s && <p className="perm-result" role="status"><span aria-hidden="true">{s[0]}</span> {s[1]}</p>}
      <div className="perm-actions">
        {st === 'ask' && <><button type="button" className="btn btn-primary" onClick={onAllow}><span>{allowLabel}</span></button><button type="button" className="btn btn-ghost" onClick={onNotNow}><span>Not now</span></button></>}
        {st === 'requesting' && <button type="button" className="btn btn-primary" disabled><span>Waiting…</span></button>}
        {st !== 'ask' && st !== 'granted' && st !== 'requesting' && onUseFallback && <button type="button" className="btn" onClick={onUseFallback}><span>{fallbackLabel || 'Continue without it'}</span></button>}
      </div>
    </section>
  );
}
