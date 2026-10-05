import { useEffect, useMemo, useState } from 'react';
import { download } from '../lib/deliver';
import { useRegistrationPlan } from '../lib/registration-plan';
import {
  clockDigits,
  countdown,
  courseReferences,
  localTime,
  modeActive,
  summaryLines,
} from '../lib/registration-day';
import { useStore } from '../state/store';
import { ConfirmDialog } from './ConfirmDialog';
import { SourceBadge } from './SourceBadge';

/**
 * Registration Day Mode on Today (`registration_day_mode`, Phase C).
 *
 * Shown only while the mode is active — the window opens within 72 hours, or it
 * opened in the last day, or the student switched it on — and otherwise
 * renders nothing. It is the brief's card:
 *
 *   REGISTRATION OPENS IN 01:42:18
 *   ✓ 15 credits selected   ✓ No schedule conflicts   ! One backup option needed
 *   Primary plan, and for each section the backups in order
 *   [Copy course references] [Open official registration system] [Advisor questions]
 *
 * Nothing here registers anybody, and nothing claims a seat. The official
 * system opens only after a confirmation that says Semester cannot see what
 * happens there.
 */
export function RegistrationDayCard() {
  const { dispatch } = useStore();
  const plan = useRegistrationPlan();
  const { data, cart, catalog, importedAt } = plan;
  const [now, setNow] = useState(() => new Date());
  const [said, setSaid] = useState('');
  const [leaving, setLeaving] = useState(false);

  // A second at a time in the last day, when the clock shows seconds;
  // every half-minute otherwise.
  const opens = localTime(data.opensAt)?.getTime() ?? null;
  const fast = opens !== null && opens - now.getTime() <= 24 * 3_600_000 && opens > now.getTime();
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), fast ? 1000 : 30_000);
    return () => window.clearInterval(id);
  }, [fast]);

  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  if (!modeActive(data, now)) return null;

  const digits = clockDigits(data.opensAt, now);
  const clock = countdown(data.opensAt, now);
  const lines = cart.length ? summaryLines(data, cart, catalog) : [];
  const references = courseReferences(cart);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(references);
      setSaid('Course references copied. Nothing was submitted.');
    } catch {
      download({ name: 'Semester course references.txt', body: references, mime: 'text/plain' });
      setSaid('Your browser blocked copying, so the references were downloaded instead.');
    }
  };
  const goRegistration = () => dispatch({ type: 'go', screen: 'yes' });

  return (
    <section className="regday-card" aria-labelledby="regday-card-title">
      <p className="action-kicker">Registration day</p>
      <h2 id="regday-card-title" className="regday-card-clock">
        {digits ? (
          <>
            Registration opens in <span role="timer" aria-live="off">{digits}</span>
          </>
        ) : (
          clock.line
        )}
      </h2>
      <p className="action-meta">
        <SourceBadge label={data.source} /> Your registration time, as you entered it. Check it in your school’s system.
      </p>

      {cart.length ? (
        <>
          <ul className="regday-card-lines" aria-label="Registration readiness">
            {lines.map((line) => (
              <li key={line.text} className={line.ok ? 'is-ok' : 'is-open'}>
                <span aria-hidden="true">{line.ok ? '✓' : '!'}</span>
                <span className="sr-only">{line.ok ? 'Ready: ' : 'Needs attention: '}</span>
                {line.text}
              </li>
            ))}
          </ul>

          <h3 className="regday-card-heading">Primary plan</h3>
          <ol className="regday-card-plan">
            {cart.map((c) => {
              const backups = (data.backups[c.id] ?? []).map((id) => byId.get(id)).filter((b) => !!b);
              return (
                <li key={c.id}>
                  <strong>{c.code}</strong> <span className="action-meta">section {c.section} · {c.title}</span>
                  {backups.length ? (
                    <div className="regday-card-backups">
                      <span className="action-meta">If {c.code} is unavailable:</span>
                      <ol>
                        {backups.map((b) => <li key={b!.id}>{b!.code} {b!.section}</li>)}
                      </ol>
                    </div>
                  ) : (
                    <p className="action-meta">No backup chosen yet.</p>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="action-meta">
            <SourceBadge label="imported" at={importedAt ? Date.parse(importedAt) : undefined} /> Sections and seat counts
            from the catalog you imported. Not live: a seat shown here may be gone.
          </p>
        </>
      ) : (
        <p className="action-body">Add the sections you plan to take to your registration cart to see your plan here.</p>
      )}

      <div className="regday-card-actions">
        {cart.length ? (
          <button type="button" className="quick-action" onClick={() => void copy()}>Copy course references</button>
        ) : null}
        <button type="button" className="quick-action" onClick={() => (data.portalUrl ? setLeaving(true) : goRegistration())}>
          {data.portalUrl ? 'Open official registration system' : 'Add your registration system’s address'}
        </button>
        <button type="button" className="quick-action" onClick={() => dispatch({ type: 'go', screen: 'degree' })}>
          Prepare advisor questions
        </button>
        <button type="button" className="quick-action" onClick={goRegistration}>Registration day plan</button>
      </div>
      <p className="action-meta">Semester never registers you and cannot hold a seat.</p>
      {said ? <p role="status" className="action-meta">{said}</p> : null}

      {leaving && data.portalUrl ? (
        <ConfirmDialog
          tone="external"
          title="Open your registration system?"
          confirmLabel="Open in a new tab"
          onCancel={() => setLeaving(false)}
          onConfirm={() => {
            setLeaving(false);
            window.open(data.portalUrl!, '_blank', 'noopener,noreferrer');
          }}
          preview={(
            <>
              <p>This opens the address you saved:</p>
              <p className="dialog-url">{data.portalUrl}</p>
              <p>Semester does not sign you in or send it your plan. Paste your course references there yourself.</p>
            </>
          )}
        />
      ) : null}
    </section>
  );
}
