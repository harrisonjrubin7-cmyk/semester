import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './ui';
import { ErrorState, SuccessState } from './unity/States';
import { NextSteps } from './unity/NextSteps';
import { SourceBadge } from './SourceBadge';
import { termLoad } from '../lib/termload';
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
  clockDigits,
  countdown,
  courseReferences,
  derivedChecks,
  moveBackup,
  prune,
  readRegistrationDay,
  readiness,
  removeBackup,
  safePortalUrl,
  sectionList,
  summaryLines,
  toggleCheck,
} from '../lib/registration-day';
import { MODULE_FLAGS, moduleOn } from '../lib/experience-flags';
import { ConfirmDialog } from './ConfirmDialog';
import { HANDOFF_STATUSES, WORDS, describe as describeHandoff, isStatus, report, startHandoff } from '../lib/handoff-status';

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
  importedAt = null,
  onOpenCart,
  mode = moduleOn(MODULE_FLAGS.registration_day_mode),
}: {
  catalog: CatalogCourse[];
  cart: CatalogCourse[];
  institution: string | null;
  /** When the catalog was imported, for the seat counts' freshness. */
  importedAt?: string | null;
  onOpenCart: () => void;
  /** Registration Day Mode (Phase C). Off, this tab is exactly what #762 shipped. */
  mode?: boolean;
}) {
  const library = useDeviceLibrary(REGISTRATION_DAY_KEY, readRegistrationDay, EMPTY_REGISTRATION_DAY);
  const data = library.value;
  const [now, setNow] = useState(() => new Date());
  const [status, setStatus] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [portalDraft, setPortalDraft] = useState('');

  // A minute is the resolution anybody reads a registration clock at.
  const digits = mode ? clockDigits(data.opensAt, now) : null;
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), digits ? 1000 : 30_000);
    return () => window.clearInterval(id);
  }, [digits]);

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
  const load = termLoad({
    credits: cart.reduce((sum, c) => sum + c.credits, 0),
    target: data.creditTarget,
    min: data.minCredits,
    max: data.maxCredits,
    studyHours: data.studyHours,
  });

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

  const copyReferences = async () => {
    const text = courseReferences(cart);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Course references copied. Nothing was submitted.');
    } catch {
      download({ name: 'Semester course references.txt', body: text, mime: 'text/plain' });
      setStatus('Your browser blocked copying, so the references were downloaded instead.');
    }
  };

  // Takes the student to the first section still without a backup.
  const addBackups = () => {
    const first = ready.unbacked[0];
    if (!first) return;
    const pick = document.querySelector<HTMLSelectElement>(
      `select[aria-label="Add a backup for ${first.code} section ${first.section}"]`,
    );
    if (pick) pick.focus();
    else document.getElementById('regday-backups')?.scrollIntoView?.({ block: 'start' });
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
        <ErrorState
          title="Could not save on this device"
          body={library.error}
          recover={{
            label: 'Download recovery copy',
            run: () =>
              download({ name: 'Semester registration-day recovery.json', body: library.recovery(), mime: 'application/json' }),
          }}
        />
      ) : null}

      <section className="portal-panel" aria-labelledby="regday-when">
        <span className="portal-eyebrow">Registration day</span>
        <h3 id="regday-when">When your window opens</h3>
        <p role="timer" aria-live="off">
          <strong>{digits ? `Opens in ${digits}` : clock.line}</strong>
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
          <SourceBadge label={data.source} /> Semester cannot see your official time ticket — check it in{' '}
          {institution ? `${institution}’s` : 'your school’s'} registration system.
        </p>
        {mode ? (
          <div className="regday-mode">
            <label className="portal-check">
              <input
                type="checkbox"
                checked={data.remind}
                onChange={(e) => library.update((d) => ({ ...d, remind: e.target.checked }))}
              />
              <span>
                <strong>Remind me the day before and an hour before</strong>
                <small className="portal-block">
                  Uses your “registrar deadline” reminder setting and stays silent in your quiet hours.
                </small>
              </span>
            </label>
            <label className="portal-check">
              <input
                type="checkbox"
                checked={data.manual}
                onChange={(e) => library.update((d) => ({ ...d, manual: e.target.checked }))}
              />
              <span>
                <strong>Show Registration Day Mode on Today now</strong>
                <small className="portal-block">It appears by itself in the week before your window opens.</small>
              </span>
            </label>
          </div>
        ) : null}
      </section>

      {mode ? (
        <section className="portal-panel" aria-labelledby="regday-plan">
          <h3 id="regday-plan">Your plan at a glance</h3>
          <ul className="regday-card-lines" aria-label="Registration readiness summary">
            {summaryLines(data, cart, catalog).map((line) => (
              <li key={line.text} className={line.ok ? 'is-ok' : 'is-open'}>
                <span aria-hidden="true">{line.ok ? '✓' : '!'}</span>
                <span className="sr-only">{line.ok ? 'Ready: ' : 'Needs attention: '}</span>
                {line.text}
              </li>
            ))}
          </ul>
          <label className="portal-check">
            Credits I plan to register for
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={40}
              aria-label="Credits I plan to register for"
              value={data.creditTarget ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value);
                library.update((d) => ({ ...d, creditTarget: e.target.value && n > 0 && n <= 40 ? n : null }));
              }}
            />
          </label>
          <p className="portal-muted">
            <SourceBadge label="student_entered" /> Your own target. Semester does not know what load is right for you.
          </p>
        </section>
      ) : null}

      {mode ? (
        <section className="portal-panel" aria-labelledby="regday-load">
          <h3 id="regday-load">How heavy this term is</h3>
          <ul className="regday-card-lines" aria-label="Term load estimate">
            {load.lines.map((line) => (
              <li key={line} className="is-ok">
                {line}
              </li>
            ))}
          </ul>
          {load.flags.some((f) => f !== 'fits') ? (
            <p role="status" className="portal-muted">
              Worth a look with your advisor before your window opens. Nothing here stops you from registering.
            </p>
          ) : null}
          <p className="portal-muted">
            <SourceBadge label="estimated" /> {load.assumption} A planning estimate, not a credit check: your school and
            your advisor decide what you may take.
          </p>
          {(
            [
              ['minCredits', 'Fewest credits my school asks for full-time', 40],
              ['maxCredits', 'Most credits my school allows without approval', 40],
              ['studyHours', 'Hours a week I can study after work and travel', 100],
            ] as const
          ).map(([key, label, cap]) => (
            <label key={key} className="portal-check">
              {label}
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={1}
                max={cap}
                aria-label={label}
                value={data[key] ?? ''}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  library.update((d) => ({ ...d, [key]: e.target.value && v > 0 && v <= cap ? v : null }));
                }}
              />
            </label>
          ))}
          {load.missing.length > 0 ? (
            <p className="portal-muted">Not checked yet: {load.missing.join(', ')}.</p>
          ) : null}
          <p className="portal-muted">
            <SourceBadge label="student_entered" /> The limits and hours are the ones you type; Semester does not know
            your school&rsquo;s rules.
          </p>
        </section>
      ) : null}

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
      {ready.done === ready.total ? (
        <SuccessState
          title="Your registration checklist is complete"
          body={`When your window opens, enroll in ${institution ? `${institution}’s` : 'your school’s'} registration system with your section list beside you, trying each backup in order if a section is full.`}
          next={{ label: 'Copy section list', run: () => void copy() }}
        />
      ) : null}

      <section className="portal-panel" aria-labelledby="regday-backups">
        <h3 id="regday-backups">If a section is full</h3>
        <p className="portal-muted">
          Up to {MAX_BACKUPS} backups per section, tried in order. Other sections of the same course come first, and
          nothing is offered that clashes with the rest of your cart. Seat counts are from your imported catalog, not live.
        </p>
        {mode ? (
          <p className="portal-muted">
            <SourceBadge label="imported" at={importedAt ? Date.parse(importedAt) : undefined} /> Seat counts as of your
            last catalog import. Seat alerts are not available: your school has not connected a live seat feed, so
            Semester cannot tell you when a seat opens.
          </p>
        ) : null}
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
        {mode ? (
          <>
            <h4>Worked out from your plan</h4>
            <ul className="regday-card-lines" aria-label="Checks Semester can see">
              {derivedChecks(data, cart, catalog).map((c) => (
                <li key={c.id} className={c.ok ? 'is-ok' : 'is-open'}>
                  <span aria-hidden="true">{c.ok ? '✓' : '!'}</span>
                  <span className="sr-only">{c.ok ? 'Ready: ' : 'Not yet: '}</span>
                  {c.label}
                </li>
              ))}
            </ul>
          </>
        ) : null}
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
        {mode ? (
          <>
            <h4>Course references</h4>
            <pre className="regday-list">{courseReferences(cart)}</pre>
            <div className="portal-actions">
              <button onClick={() => void copyReferences()}>Copy course references</button>
            </div>
            <h4>Your official registration system</h4>
            {data.portalUrl ? (
              <div className="portal-actions">
                <button className="portal-primary" onClick={() => setLeaving(true)}>Open official registration system</button>
                <button onClick={() => library.update((d) => ({ ...d, portalUrl: null }))}>Change address</button>
              </div>
            ) : (
              <form
                className="portal-filter-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const url = safePortalUrl(portalDraft);
                  if (!url) {
                    setStatus('Use the https:// address of your school’s registration system.');
                    return;
                  }
                  library.update((d) => ({ ...d, portalUrl: url }));
                  setPortalDraft('');
                }}
              >
                <input
                  className="input"
                  type="url"
                  inputMode="url"
                  aria-label="Your school’s registration system address"
                  placeholder="https://"
                  value={portalDraft}
                  onChange={(e) => setPortalDraft(e.target.value)}
                />
                <button type="submit">Save address</button>
              </form>
            )}
            <p className="portal-muted">
              <SourceBadge label="student_entered" /> The address you saved. Semester is not connected to it.
            </p>
            {data.portalUrl ? (
              <>
                <h4>After you leave</h4>
                <label className="portal-check">
                  Where your registration stands
                  <select
                    className="input"
                    aria-label="Where your registration stands"
                    value={data.handoff?.status ?? ''}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!isStatus(next)) return;
                      const at = Date.now();
                      library.update((d) => ({ ...d, handoff: report(d.handoff ?? startHandoff('registration', at), next, at) }));
                    }}
                  >
                    <option value="">Choose one…</option>
                    {HANDOFF_STATUSES.map((id) => (
                      <option key={id} value={id}>{WORDS[id].label}</option>
                    ))}
                  </select>
                </label>
                {data.handoff && describeHandoff(data.handoff, now.getTime()) ? (
                  <p className="portal-muted" role="status">
                    <SourceBadge label="student_entered" /> {describeHandoff(data.handoff, now.getTime())!.line}{' '}
                    {describeHandoff(data.handoff, now.getTime())!.next}
                  </p>
                ) : (
                  <p className="portal-muted">Only you can say how it went; Semester cannot see your school’s system.</p>
                )}
                {data.handoff ? (
                  <div className="portal-actions">
                    <button onClick={() => library.update((d) => ({ ...d, handoff: null }))}>Clear this note</button>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
        <p className="portal-muted">
          Semester never registers for you. Enroll in your school’s official registration system.
        </p>
        {status ? (
          <p className="portal-notice" role="status">
            {status}
          </p>
        ) : null}
      </section>

      {/* Copy section list is the button just above, so it is not offered twice. */}
      <NextSteps
        steps={[
          ...(ready.unbacked.length
            ? [
                {
                  label: 'Add backups',
                  why: `${ready.unbacked.length} section${ready.unbacked.length === 1 ? ' has' : 's have'} no backup yet.`,
                  run: addBackups,
                },
              ]
            : []),
          { label: 'Open cart', why: 'Change the sections you are planning around.', run: onOpenCart },
        ]}
      />
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
    </div>
  );
}
