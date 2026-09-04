/**
 * "A new version is ready."
 *
 * The service worker calls `skipWaiting()` on install, so a new one takes
 * control the moment it activates. What does *not* change is the page already
 * running: it keeps the JavaScript it booted with. So somebody who leaves a
 * tab open for a week — which is how most people use this on a laptop — can be
 * looking at last month's app while the worker underneath it serves this
 * month's files. Nothing looks wrong. Things are just quietly not fixed.
 *
 * ## It never reloads by itself
 *
 * A reload would throw away an essay draft, a half-written note, a practice
 * paper mid-sitting. Everything the app holds is saved as you go, but "as you
 * go" means at the end of a keystroke, not in the middle of a thought. So this
 * says there is a new version and waits to be pressed.
 */

import { useEffect, useState } from 'react';

export function Fresh() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Only when there was already a controller. On a first visit the worker
    // takes control for the first time and fires this too, and telling
    // somebody a version is ready thirty seconds after they arrived is
    // nonsense — they have that version.
    if (!navigator.serviceWorker.controller) return;

    const onChange = () => setReady(true);
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange);
  }, []);

  if (!ready) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line-top)',
        background: 'var(--app-panel)',
        boxShadow: '0 14px 32px rgba(0,0,0,0.38)',
        maxWidth: 420,
        marginInline: 'auto',
      }}
    >
      <span style={{ flex: 1, fontSize: 'calc(12.5px * var(--text-scale, 1))', lineHeight: 1.45 }}>
        A newer version of the app is ready.
      </span>
      <button
        type="button"
        className="bare"
        onClick={() => setReady(false)}
        aria-label="Not now"
        style={{ width: 'auto', flex: 'none', opacity: 0.5, fontSize: 'calc(12px * var(--text-scale, 1))', padding: '0 6px' }}
      >
        Later
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => window.location.reload()}
        style={{ flex: 'none', height: 32, fontSize: 'calc(12px * var(--text-scale, 1))', paddingInline: 14 }}
      >
        Reload
      </button>
    </div>
  );
}
