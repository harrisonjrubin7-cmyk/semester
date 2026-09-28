import { useEffect, useState } from 'react';
import { noticesFor, readIncidents, say, type Incident } from '../lib/statusnotice';
import { useNow, useStore } from '../state/store';

/**
 * A service notice on the screens it concerns, and nowhere else.
 *
 * Reads `status-incidents.json` once — the same file `public/status.html`
 * reads, beside the app, so an incident is posted once and appears in both
 * places — and draws one line per live notice for the screen you are on. A
 * notice that names no screen is about the whole service and appears on all
 * of them; a slow calendar feed appears on the calendar and nowhere else.
 *
 * Quiet by design. `role="status"` rather than an alert: the app still works,
 * something in it is slow, and a giant red banner for a minor issue on an
 * unrelated screen is the thing the brief says not to build. The fetch fails
 * silently — offline, or a build without the file — because a missing status
 * file is not itself an incident.
 */
export function StatusNotice({ incidents: given }: { incidents?: Incident[] } = {}) {
  const { state } = useStore();
  const now = useNow();
  const [fetched, setFetched] = useState<Incident[]>([]);

  useEffect(() => {
    if (given || typeof fetch !== 'function') return;
    let stale = false;
    fetch(`${import.meta.env.BASE_URL}status-incidents.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!stale && data) setFetched(readIncidents(data));
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [given]);

  const notices = noticesFor(state.screen, given ?? fetched, now.getTime());
  if (notices.length === 0) return null;

  return (
    <div style={{ padding: '0 var(--page-pad)' }}>
      {notices.map((n) => {
        const { head, body } = say(n);
        return (
          <p
            key={n.id}
            role="status"
            data-status-notice={n.kind}
            style={{
              margin: '0 0 var(--sp-3)',
              padding: 'var(--sp-3) var(--sp-4)',
              border: '1px solid var(--app-line)',
              borderRadius: 'var(--r-md)',
              background: 'var(--app-panel)',
              fontSize: 'var(--type-sm)',
              lineHeight: 'var(--leading-relaxed)',
            }}
          >
            <strong style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 'var(--type-xs)', marginRight: 'var(--sp-3)' }}>{head}</strong>
            {body}
          </p>
        );
      })}
    </div>
  );
}
