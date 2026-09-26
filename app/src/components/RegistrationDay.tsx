import { useEffect, useMemo, useState } from 'react';
import { EmptyState, Notice } from './ui';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import type { CatalogCourse } from '../lib/registration';
import {
  CHECKLIST,
  EMPTY_REGISTRATION_DAY,
  MAX_BACKUPS,
  REGISTRATION_DAY_KEY,
  addBackup,
  candidates,
  countdown,
  moveBackup,
  prune,
  readRegistrationDay,
  readiness,
  removeBackup,
  sectionList,
  toggleCheck,
} from '../lib/registration-day';

/**
 * The registration-day tab of the registration workspace.
 *
 * Everything here is planning. It never submits an enrollment and it never
 * claims a seat is available — seat counts come from the catalog file the
 * student imported, and the screen says so beside every one.
 */
export function RegistrationDay({
  catalog,
  cart,
  institution,
  onOpenCart,
}: {
  catalog: CatalogCourse[];
  cart: CatalogCourse[];
  institution: string | null;
  onOpenCart: () => void;
}) {
  const library = useDeviceLibrary(REGISTRATION_DAY_KEY, readRegistrationDay, EMPTY_REGISTRATION_DAY);
  const data = library.value;
  const [now, setNow] = useState(() => new Date());
  const [status, setStatus] = useState('');

  // A minute is the resolution anybody reads a registration clock at.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Backups pointing at sections that left the cart or the catalog go quietly.
  useEffect(() => {
    const next = prune(data, cart, catalog);
    if (next !== data) library.update(next);
    // `library.update` is stable per key; `data` changes when it writes.
  }, [data, cart, catalog, library]);

  const clock = countdown(data.opensAt, now);
  const ready = readiness(data, cart, catalog);
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const list = sectionList(data, cart, catalog);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(list);
      library.update((d) => (d.checks.includes('copied') ? d : toggleCheck(d, 'copied')));
      setStatus('Section list copied. Paste it somewhere you can see during registration.');
    } catch {
      download({ name: 'Semester registration plan.txt', body: list, mime: 'text/plain' });
      setStatus('Your browser blocked copying, so the list was downloaded instead.');
    }
  };

  if (!cart.length) {
    return (
      <EmptyState
        title="Plan your registration day"
        body="Add the sections you want to your cart first. Then choose a backup for each one, so a full class never means deciding on the spot."
        action={{ label: 'Open cart →', onClick: onOpenCart }}
      />
    );
  }

  return (
    <div className="registration-day">
      {library.error ? (
        <Notice alert>
          {library.error}
          <button
            onClick={() =>
              download({ name: 'Semester registration-day recovery.json', body: library.recovery(), mime: 'application/json' })
            }
          >
            Download recovery copy
          </button>
        </Notice>
      ) : null}

      <section className="portal-panel" aria-labelledby="regday-when">
        <span className="portal-eyebrow">Registration day</span>
        <h3 id="regday-when">When your window opens</h3>
        <p role="timer" aria-live="off">
          <strong>{clock.line}</strong>
        </p>
        {clock.phase === 'soon' ? (
          <p className="portal-notice">Less than three days to go. Work through the checklist below today.</p>
        ) : null}
        <div className="portal-filter-row">
          <label className="portal-check">
            Registration time
            <input
              className="input"
              type="datetime-local"
              aria-label="Your registration time"
              value={data.opensAt ?? ''}
              onChange={(e) =>
                library.update((d) => ({ ...d, opensAt: e.target.value || null, source: 'student_entered' }))
              }
            />
          </label>
        </div>
        <p className="portal-muted">
          Source: {data.source === 'imported' ? 'Imported' : 'Student entered'}. Semester cannot see your official time
          ticket — check it in {institution ? `${institution}’s` : 'your school’s'} registration system.
        </p>
      </section>

      <div className="portal-stats" aria-label="Registration readiness">
        <div>
          <strong>
            {ready.done}/{ready.total}
          </strong>
          <span>Steps ready</span>
        </div>
        <div>
          <strong>{cart.length - ready.unbacked.length}/{cart.length}</strong>
          <span>Sections with a backup</span>
        </div>
        <div>
          <strong>{ready.conflicts}</strong>
          <span>Time conflicts</span>
        </div>
      </div>

      <section className="portal-panel" aria-labelledby="regday-backups">
        <h3 id="regday-backups">If a section is full</h3>
        <p className="portal-muted">
          Up to {MAX_BACKUPS} backups per section, tried in order. Other sections of the same course come first, and
          nothing is offered that clashes with the rest of your cart. Seat counts are from your imported catalog, not live.
        </p>
        {cart.map((primary) => {
          const chosen = data.backups[primary.id] ?? [];
          const offer = candidates(primary, catalog, cart, chosen);
          return (
            <article key={primary.id} className="portal-panel regday-course">
              <h4>
                {primary.code} · Section {primary.section} — {primary.title}
              </h4>
              {chosen.length ? (
                <ol aria-label={`Backups for ${primary.code} section ${primary.section}`}>
                  {chosen.map((id, i) => {
                    const b = byId.get(id);
                    if (!b) return null;
                    return (
                      <li key={id}>
                        <span>
                          {b.code} · Section {b.section} ·{' '}
                          {b.seats === null ? 'seats not provided' : b.seats === 0 ? 'reported closed' : `${b.seats} reported seats`}
                        </span>
                        <span className="portal-actions">
                          <button
                            disabled={i === 0}
                            aria-label={`Move ${b.code} section ${b.section} up`}
                            onClick={() => library.update((d) => moveBackup(d, primary.id, id, -1))}
                          >
                            Up
                          </button>
                          <button
                            disabled={i === chosen.length - 1}
                            aria-label={`Move ${b.code} section ${b.section} down`}
                            onClick={() => library.update((d) => moveBackup(d, primary.id, id, 1))}
                          >
                            Down
                          </button>
                          <button
                            aria-label={`Remove backup ${b.code} section ${b.section}`}
                            onClick={() => library.update((d) => removeBackup(d, primary.id, id))}
                          >
                            Remove
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="portal-warning">No backup yet.</p>
              )}
              {chosen.length < MAX_BACKUPS ? (
                offer.length ? (
                  <label className="portal-check">
                    Add a backup
                    <select
                      className="input"
                      aria-label={`Add a backup for ${primary.code} section ${primary.section}`}
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id) library.update((d) => addBackup(d, primary.id, id));
                      }}
                    >
                      <option value="">Choose a section…</option>
                      {offer.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} {c.section} — {c.title}
                          {c.seats === 0 ? ' (reported closed)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="portal-muted">
                    No other section in this catalog fits around the rest of your cart. Ask your advisor for an
                    alternative that satisfies the same requirement.
                  </p>
                )
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="portal-panel" aria-labelledby="regday-check">
        <h3 id="regday-check">Before your window opens</h3>
        <ul className="regday-checklist">
          {CHECKLIST.map((item) => (
            <li key={item.id}>
              <label className="portal-check">
                <input
                  type="checkbox"
                  checked={data.checks.includes(item.id)}
                  onChange={() => library.update((d) => toggleCheck(d, item.id))}
                />
                <span>
                  <strong>{item.label}</strong>
                  <small className="portal-block">{item.why}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="portal-panel" aria-labelledby="regday-list">
        <h3 id="regday-list">Your section list</h3>
        <pre className="regday-list">{list}</pre>
        <div className="portal-actions">
          <button className="portal-primary" onClick={() => void copy()}>
            Copy section list
          </button>
          <button onClick={() => download({ name: 'Semester registration plan.txt', body: list, mime: 'text/plain' })}>
            Download
          </button>
        </div>
        <p className="portal-muted">
          Semester never registers for you. Enroll in your school’s official registration system.
        </p>
        {status ? (
          <p className="portal-notice" role="status">
            {status}
          </p>
        ) : null}
      </section>
    </div>
  );
}
