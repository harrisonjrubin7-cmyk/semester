import { useMemo, useState } from 'react';
import { useDeviceLibrary } from '../lib/device-library';
import { NOT_OFFICIAL, hasPathProfile, pathCredits, pathStatus, termLine } from '../lib/path-profile';
import { EMPTY_REGISTRATION, readRegistration } from '../lib/portal-storage';
import { pathSnapshot } from '../lib/today-decision';
import { useStore } from '../state/store';
import { PathProfileForm, usePathProfile } from './PathProfileForm';
import { SourceBadge } from './SourceBadge';
import { SectionLabel } from './ui';
import { RegistrationReadiness } from './RegistrationReadiness';

/**
 * The Path Snapshot on My Path: status, credits, target, goals, and the
 * sentence that says none of it is official — above the tabs, so it is the
 * first thing on the screen and never scrolled past.
 *
 * Credits in the registration cart count as *planned*, never as registered:
 * the cart is a plan the student has not submitted anywhere.
 */
export function PathSnapshotCard({ onPrepareMeeting }: { onPrepareMeeting?: () => void } = {}) {
  const { state } = useStore();
  const profile = usePathProfile();
  const registration = useDeviceLibrary('semester.registration.v1', readRegistration, EMPTY_REGISTRATION);
  const [editing, setEditing] = useState(false);
  const p = profile.value;

  const snapshot = useMemo(() => pathSnapshot(state.requirements, state.taken), [state.requirements, state.taken]);
  const planned = useMemo(() => {
    const r = registration.value;
    const courses = r.catalog?.courses ?? [];
    return courses.filter((c) => r.cart.includes(c.id)).reduce((n, c) => n + (c.credits || 0), 0);
  }, [registration.value]);
  const credits = pathCredits(p, state.taken, planned);
  const status = pathStatus(snapshot);
  const target = termLine(p.targetTerm);
  const set = hasPathProfile(p);

  return (
    <section aria-labelledby="path-snapshot-title" style={{ border: '1px solid var(--app-line)', borderRadius: 'var(--r-md)', padding: 'var(--sp-5)', marginBottom: 'var(--sp-6)' }}>
      <SectionLabel>Path Snapshot</SectionLabel>
      <h2 id="path-snapshot-title" style={{ fontSize: 'var(--type-md)', margin: 'var(--sp-2) 0' }}>
        {status.label}
        {p.programme ? ` · ${p.programme}` : ''}
      </h2>
      <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: '0 0 var(--sp-3)' }}>{snapshot.detail}</p>

      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(7.5em, 1fr))', gap: 'var(--sp-3)', margin: '0 0 var(--sp-3)' }}>
        <div><dt style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>Complete</dt><dd style={{ margin: 0 }}>{credits.complete} credits</dd></div>
        <div><dt style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>In progress</dt><dd style={{ margin: 0 }}>{credits.inProgress} credits</dd></div>
        <div><dt style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>Planned</dt><dd style={{ margin: 0 }}>{credits.planned} credits</dd></div>
        <div>
          <dt style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>Remaining</dt>
          <dd style={{ margin: 0 }}>{credits.remaining === null ? 'Add credits needed' : `${credits.remaining} of ${credits.target}`}</dd>
        </div>
        <div><dt style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>Target</dt><dd style={{ margin: 0 }}>{target ?? 'Not set'}</dd></div>
        <div>
          <dt style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>Requirements</dt>
          <dd style={{ margin: 0 }}>{snapshot.total > 0 ? `${snapshot.covered} of ${snapshot.total} covered` : 'None recorded'}</dd>
        </div>
      </dl>

      {p.goals.length > 0 && (
        <>
          <p style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', margin: 0 }}>Your goals</p>
          <ul style={{ margin: 'var(--sp-1) 0 var(--sp-3)', paddingInlineStart: '1.2em', fontSize: 'var(--type-sm)' }}>
            {p.goals.map((g) => <li key={g}>{g}</li>)}
          </ul>
        </>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'baseline', marginBottom: 'var(--sp-3)' }}>
        <SourceBadge label="student_entered" at={p.updatedAt} />
        <SourceBadge label="estimated" />
      </div>
      <p style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-3)', textWrap: 'pretty' }}>
        <strong>{NOT_OFFICIAL}</strong>
      </p>

      {!set ? (
        <details>
          <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 'var(--type-sm)' }}>
            Add your path details (optional)
          </summary>
          <PathProfileForm />
        </details>
      ) : editing ? (
        <>
          <PathProfileForm onSaved={() => setEditing(false)} />
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
        </>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>Edit your path details</button>
      )}
      <RegistrationReadiness onPrepareMeeting={onPrepareMeeting} />
    </section>
  );
}
