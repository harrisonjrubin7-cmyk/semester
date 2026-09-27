import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Notice, SectionLabel } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { ReasonHint, REASON_MIN } from '../components/community/Escalation';
import { cloudConfigured } from '../lib/cloud';
import { COMMUNITY_FLAGS, enabled } from '../community/flags';
import { VOLUNTEER_RULES } from '../community/volunteer';
import {
  accountHash,
  addCalibrationItem,
  loadCalibrationItems,
  loadRoster,
  loadVolunteerEvents,
  manageVolunteer,
  retireCalibrationItem,
  reviewerStanding,
  type CalibrationItem,
  type ManageAction,
  type RosterEntry,
  type VolunteerEvent,
} from '../community/client';
import { formatDateTime } from '../lib/locale';

const BLURB = 'Training, calibration and standing for student volunteer moderators, and the practice cases they calibrate on.';

const when = (iso: string) =>
  formatDateTime(new Date(iso), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const day = (iso: string) => formatDateTime(new Date(iso), { month: 'short', day: 'numeric' });

/** What a volunteer's row means, in the order a senior reviewer needs to act on it. */
export function volunteerStage(v: RosterEntry): { order: number; text: string } {
  if (v.status === 'revoked') return { order: 6, text: 'Revoked' };
  if (v.status === 'paused') return { order: 1, text: 'Paused — quality fell below the line' };
  if (!v.trainedAt) return { order: 0, text: 'Waiting for training to be recorded' };
  if (!v.confidentialityAt || !v.recusalAt) return { order: 2, text: 'Trained; waiting for their agreements' };
  if (v.status === 'onboarding') return { order: 3, text: 'Calibrating' };
  if (v.status === 'probation') return { order: 4, text: 'On probation — practice cases only' };
  return { order: 5, text: 'Active' };
}

/** Whether a school has enough practice cases for anybody to finish calibrating. */
export function calibrationShortfall(items: CalibrationItem[]): string[] {
  const live = items.filter((i) => !i.retiredAt);
  const onboarding = live.filter((i) => i.kind === 'onboarding').length;
  const controls = live.filter((i) => i.kind === 'control').length;
  const out: string[] = [];
  if (onboarding < VOLUNTEER_RULES.calibrationTasks) {
    out.push(
      `${onboarding} onboarding items — nobody can finish calibrating until there are ${VOLUNTEER_RULES.calibrationTasks}.`,
    );
  }
  if (controls === 0) out.push('No control items — active volunteers have no quality check.');
  else if (controls < VOLUNTEER_RULES.qualityWindow) {
    out.push(`${controls} control items — with fewer than ${VOLUNTEER_RULES.qualityWindow}, volunteers see the same ones often.`);
  }
  return out;
}

const EVENT_TEXT: Record<string, string> = {
  applied: 'Applied',
  training_recorded: 'Training recorded',
  'attested:confidentiality': 'Signed the confidentiality agreement',
  'attested:recusal': 'Acknowledged the recusal rules',
  status: 'Status changed by calibration',
  recalibrate: 'Sent back to calibration',
  revoked: 'Revoked',
};

/**
 * The volunteer programme, for senior reviewers.
 *
 * Opened from the moderation console. Each volunteer is listed with where
 * they are — training, agreements, calibration, quality — and the three things
 * a senior reviewer can do about it: record training, send them back to
 * calibration (which clears their queue and starts the count again), or
 * revoke them. Each takes a reason, which goes into the programme's history.
 *
 * Below that, the practice cases a school's volunteers calibrate on, with a
 * warning when there are too few for anybody to finish.
 */
export function Volunteers() {
  const { account } = useStore();
  if (!enabled(COMMUNITY_FLAGS, 'volunteerModeration')) {
    return (
      <Page blurb={BLURB}>
        <Notice>Volunteer moderation isn’t switched on in this build.</Notice>
      </Page>
    );
  }
  if (!cloudConfigured || !account) {
    return (
      <Page blurb={BLURB}>
        <Notice>Sign in with a Trust & Safety account to manage volunteers.</Notice>
      </Page>
    );
  }
  return <Manager />;
}

function Manager() {
  const [senior, setSenior] = useState<boolean | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [events, setEvents] = useState<VolunteerEvent[]>([]);
  const [items, setItems] = useState<CalibrationItem[]>([]);
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [school, setSchool] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const standing = await reviewerStanding();
      setSenior(standing === 'senior');
      if (standing !== 'senior') return;
      const [r, e, i] = await Promise.all([loadRoster(), loadVolunteerEvents(), loadCalibrationItems()]);
      setRoster(r);
      setEvents(e);
      setItems(i);
      setHashes(Object.fromEntries(await Promise.all(r.map(async (v) => [v.userId, await accountHash(v.userId)] as const))));
      setSchool((s) => s || r[0]?.tenantId || i[0]?.tenantId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the volunteers.');
    }
  }, []);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const schools = useMemo(() => [...new Set([...roster.map((v) => v.tenantId), ...items.map((i) => i.tenantId)])].sort(), [roster, items]);

  if (senior === false) {
    return (
      <Page blurb={BLURB}>
        <Notice>Only a senior reviewer manages volunteers.</Notice>
      </Page>
    );
  }

  const done = async (said: string) => {
    setStatus(said);
    await refresh();
  };
  const here = roster
    .filter((v) => v.tenantId === school)
    .sort((a, b) => volunteerStage(a).order - volunteerStage(b).order || a.handle.localeCompare(b.handle));
  const itemsHere = items.filter((i) => i.tenantId === school);

  return (
    <Page blurb={BLURB}>
      {status && <p role="status">{status}</p>}
      {error && <Trouble said={error} />}
      {schools.length > 1 && (
        <label style={{ display: 'grid', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          School
          <select className="input" value={school} onChange={(e) => setSchool(e.target.value)}>
            {schools.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}

      <SectionLabel aside={`${here.length}`}>Volunteers</SectionLabel>
      {here.length === 0 && <p style={{ color: 'var(--app-dim)' }}>Nobody at this school has applied yet.</p>}
      {here.map((v) => (
        <VolunteerCard key={v.userId} v={v} history={events.filter((e) => e.volunteer === hashes[v.userId]).slice(0, 8)} onDone={done} />
      ))}

      <Calibration school={school} items={itemsHere} onDone={done} />
    </Page>
  );
}

function VolunteerCard({ v, history, onDone }: { v: RosterEntry; history: VolunteerEvent[]; onDone: (said: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stage = volunteerStage(v);
  const revoked = v.status === 'revoked';

  const act = (action: ManageAction, said: string) => {
    setBusy(true);
    setError('');
    void manageVolunteer(v.userId, action, reason.trim())
      .then(() => {
        setReason('');
        return onDone(said);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'That did not work.'))
      .finally(() => setBusy(false));
  };
  const ready = !busy && reason.trim().length >= REASON_MIN;

  return (
    <article className="portal-panel" aria-label={`Volunteer ${v.handle}`} style={{ display: 'grid', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
      <strong>{v.handle}</strong>
      <span style={{ color: 'var(--app-dim)' }}>
        {stage.text} · applied {day(v.appliedAt)}
      </span>
      <ul style={{ margin: 0 }}>
        <li>Training: {v.trainedAt ? `recorded ${day(v.trainedAt)}` : 'not yet'}</li>
        <li>
          Agreements: confidentiality {v.confidentialityAt ? 'signed' : 'not yet'}, recusal {v.recusalAt ? 'acknowledged' : 'not yet'}
        </li>
        {!revoked && v.status === 'onboarding' && (
          <li>
            Calibration since {day(v.calibrationStartedAt)}: {v.onboardingAnswered} of {VOLUNTEER_RULES.calibrationTasks} answered,{' '}
            {v.onboardingRight} right (needs{' '}
            {Math.ceil(VOLUNTEER_RULES.calibrationTasks * VOLUNTEER_RULES.calibrationPass)})
          </li>
        )}
        {!revoked && v.status !== 'onboarding' && (
          <li>
            Quality: {v.quality === null ? `not enough control answers yet (needs ${VOLUNTEER_RULES.qualityWindow})` : `${v.quality} out of 100`}
          </li>
        )}
        <li>
          {v.reviewsToday} review{v.reviewsToday === 1 ? '' : 's'} today{v.lastAnsweredAt ? ` · last active ${when(v.lastAnsweredAt)}` : ''}
        </li>
        {revoked && v.revokedReason && <li>Revoked: “{v.revokedReason}”</li>}
      </ul>

      {!revoked && (
        <>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            Reason
            <textarea className="input" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <ReasonHint reason={reason} keptWith="the volunteer’s history" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            {!v.trainedAt && (
              <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => act('record_training', `Training recorded for ${v.handle}.`)}>
                Record training
              </button>
            )}
            {(v.status === 'active' || v.status === 'probation' || v.status === 'paused') && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!ready}
                onClick={() => act('recalibrate', `${v.handle} is calibrating again, from the start.`)}
              >
                Send back to calibration
              </button>
            )}
            <button type="button" className="btn btn-secondary" disabled={!ready} onClick={() => act('revoke', `${v.handle}’s access is revoked.`)}>
              Revoke
            </button>
          </div>
          {(v.status === 'active' || v.status === 'probation' || v.status === 'paused') && (
            <p style={{ margin: 0, color: 'var(--app-dim)' }}>
              Sending back clears anything in their queue and starts calibration again; earlier answers don’t count.
            </p>
          )}
        </>
      )}

      {history.length > 0 && (
        <details>
          <summary>History</summary>
          <ul style={{ margin: 0 }}>
            {history.map((e, i) => (
              <li key={i}>
                {EVENT_TEXT[e.event] ?? e.event} {when(e.occurredAt)}
                {e.toStatus && e.fromStatus !== e.toStatus ? ` · ${e.fromStatus ?? '—'} → ${e.toStatus}` : ''}
                {e.reason && e.event !== 'status' ? ` — “${e.reason}”` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
      {error && <Trouble said={error} />}
    </article>
  );
}

function Calibration({ school, items, onDone }: { school: string; items: CalibrationItem[]; onDone: (said: string) => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Omit<CalibrationItem, 'id' | 'retiredAt' | 'tenantId'>>({
    kind: 'onboarding',
    category: 'spam_scam_or_phishing',
    severity: 'P2',
    communityKind: 'course',
    body: '',
    expectedAction: 'remove',
  });
  const live = items.filter((i) => !i.retiredAt);
  const short = calibrationShortfall(items);
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));

  const run = (work: Promise<void>, said: string) => {
    setBusy(true);
    setError('');
    void work
      .then(() => onDone(said))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'That did not work.'))
      .finally(() => setBusy(false));
  };

  return (
    <section aria-label="Practice cases" style={{ marginTop: 'var(--sp-7)' }}>
      <SectionLabel aside={`${live.length}`}>Practice cases</SectionLabel>
      <p style={{ color: 'var(--app-dim)' }}>
        Written by staff, with a known answer. Onboarding items make up a new volunteer’s calibration; control items are
        mixed into an active volunteer’s queue, look exactly like real cases, and are how quality is measured.
      </p>
      {short.length > 0 && (
        <ul role="status" style={{ margin: 0 }}>
          {short.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          aria-label="Add a practice case"
          className="portal-panel"
          style={{ display: 'grid', gap: 'var(--sp-3)', marginBlock: 'var(--sp-4)' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.body.trim().length === 0 || !school) return;
            run(
              addCalibrationItem({ ...draft, tenantId: school, body: draft.body.trim() }).then(() => setAdding(false)),
              'Practice case added.',
            );
          }}
        >
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            Used for
            <select className="input" value={draft.kind} onChange={(e) => set({ kind: e.target.value as CalibrationItem['kind'] })}>
              <option value="onboarding">Onboarding — part of calibration</option>
              <option value="control">Control — mixed into the queue to measure quality</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            Reported as
            <select className="input" value={draft.category} onChange={(e) => set({ category: e.target.value as CalibrationItem['category'] })}>
              <option value="spam_scam_or_phishing">Spam, a scam or a phishing link</option>
              <option value="other">Something else</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            Severity
            <select className="input" value={draft.severity} onChange={(e) => set({ severity: e.target.value as CalibrationItem['severity'] })}>
              <option value="P2">Standard (P2)</option>
              <option value="P3">Minor (P3)</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            Shown as a post in a
            <select className="input" value={draft.communityKind} onChange={(e) => set({ communityKind: e.target.value })}>
              <option value="course">course community</option>
              <option value="study_group">study group</option>
              <option value="student_organization">student organization</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            The post
            <textarea className="input" rows={3} maxLength={4000} value={draft.body} onChange={(e) => set({ body: e.target.value })} />
          </label>
          <p style={{ margin: 0, color: 'var(--app-dim)' }}>Write it yourself. Never paste a real student’s post.</p>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            The right answer
            <select className="input" value={draft.expectedAction} onChange={(e) => set({ expectedAction: e.target.value as CalibrationItem['expectedAction'] })}>
              <option value="remove">Remove it</option>
              <option value="allow">Nothing wrong with it</option>
            </select>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            <button className="btn btn-primary" disabled={busy || draft.body.trim().length === 0 || !school}>
              Add it
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div style={{ marginBlock: 'var(--sp-4)' }}>
          <button type="button" className="btn btn-secondary" disabled={!school} onClick={() => setAdding(true)}>
            Add a practice case
          </button>
        </div>
      )}

      <details>
        <summary>
          {live.filter((i) => i.kind === 'onboarding').length} onboarding and {live.filter((i) => i.kind === 'control').length} control items in use
        </summary>
      <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--sp-3) 0 0', display: 'grid', gap: 'var(--sp-3)' }}>
        {live.map((i) => (
          <li key={i.id} className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            <span style={{ color: 'var(--app-dim)' }}>
              {i.kind === 'onboarding' ? 'Onboarding' : 'Control'} · {i.severity === 'P2' ? 'standard' : 'minor'} · answer:{' '}
              {i.expectedAction === 'remove' ? 'remove' : 'nothing wrong'}
            </span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{i.body}</span>
            <div>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(retireCalibrationItem(i.id), 'Practice case retired.')}>
                Retire
              </button>
            </div>
          </li>
        ))}
      </ul>
      </details>
      {error && <Trouble said={error} />}
    </section>
  );
}
