import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { ActionButton, Notice, SectionLabel } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { CATEGORY_TEXT } from '../components/community/ReportSheet';
import { cloudConfigured } from '../lib/cloud';
import { COMMUNITY_FLAGS, enabled } from '../community/flags';
import { CRISIS_NOTICE } from '../community/crisis';
import { VOLUNTEER_RULES } from '../community/volunteer';
import {
  applyToVolunteer,
  attest,
  decideTask,
  loadPrograms,
  loadVolunteer,
  nextTasks,
  type VolunteerAction,
  type VolunteerRecord,
  type VolunteerStanding,
  type VolunteerTask,
} from '../community/client';

const CATEGORY = Object.fromEntries(CATEGORY_TEXT);

const KIND_TEXT: Record<string, string> = {
  course: 'a course community',
  study_group: 'a study group',
  student_organization: 'an organization',
  career_alumni: 'a career community',
  peer_mentorship: 'a mentorship community',
  research: 'a research community',
  campus_bulletin: 'the campus bulletin',
  event: 'an event',
  housing_transport: 'housing and transport',
};

const STATUS_TEXT: Record<VolunteerRecord['status'], string> = {
  onboarding: 'Practising. Answer practice cases until you pass.',
  active: 'Active. You can review real cases.',
  probation: 'On probation. You’ll see practice cases only until your accuracy recovers.',
  paused: 'Paused. Your recent accuracy fell below the line; Trust & Safety will be in touch about retraining.',
  revoked: 'Your volunteer access has ended.',
};

const REASONS: [string, string][] = [
  ['no_violation', 'Nothing wrong with it'],
  ['spam.promotion', 'Unwanted promotion'],
  ['spam.link', 'Suspicious link'],
  ['offtopic', 'Off topic for this community'],
  ['duplicate', 'Duplicate'],
];

const CONFIDENTIALITY =
  'I will not share, screenshot, discuss or act on anything I see in the review queue outside it, including after I stop volunteering.';
const RECUSAL =
  'I understand I will never be shown a post I wrote or reported, one from a community I host or moderate, or one from somebody either of us has blocked — and if I recognise who wrote a post, I will skip it.';

/**
 * Volunteer moderation, from the volunteer's side.
 *
 * Opened from Community, and only there, when the build flag and this school's
 * programme switch are both on. Everything consequential is the server's:
 * eligibility, training, calibration, the 20-an-hour cap, which cases a
 * volunteer is shown, and that a removal needs a second volunteer. This screen
 * says those rules in words and does what the server allows.
 *
 * Each task is an opaque id with a category, a severity, a community type and
 * the text — the same shape for a real case and a practice case, so a
 * volunteer cannot tell which of their answers are being scored.
 */
export function Volunteer() {
  const { account } = useStore();
  if (!enabled(COMMUNITY_FLAGS, 'volunteerModeration')) {
    return (
      <Page blurb="Volunteer moderation for Community.">
        <Notice>Volunteer moderation isn’t switched on in this build.</Notice>
      </Page>
    );
  }
  if (!cloudConfigured || !account) {
    return (
      <Page blurb="Volunteer moderation for Community.">
        <Notice>Volunteer moderation needs a signed-in account at your school.</Notice>
      </Page>
    );
  }
  return <VolunteerSignedIn />;
}

function VolunteerSignedIn() {
  const [on, setOn] = useState<boolean | null>(null);
  const [record, setRecord] = useState<VolunteerRecord | null>(null);
  const [standing, setStanding] = useState<VolunteerStanding | null>(null);
  const [queue, setQueue] = useState<VolunteerTask[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const programs = await loadPrograms();
      setOn(programs.volunteerModeration);
      if (!programs.volunteerModeration) return;
      const v = await loadVolunteer();
      setRecord(v.record);
      setStanding(v.standing);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load volunteer moderation.');
    }
  }, []);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const act = (work: () => Promise<void>, done = '') => {
    setBusy(true);
    setError('');
    void work()
      .then(async () => {
        await refresh();
        if (done) setStatus(done);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'That did not work.'))
      .finally(() => setBusy(false));
  };

  const blurb = 'Help keep course and study-group spaces on topic, under Trust & Safety’s rules.';

  if (on === false) {
    return (
      <Page blurb={blurb}>
        <Notice>Your school hasn’t switched volunteer moderation on.</Notice>
      </Page>
    );
  }

  if (on === null) {
    return <Page blurb={blurb}>{error && <Trouble said={error} />}</Page>;
  }

  if (!record) {
    return (
      <Page blurb={blurb}>
        {error && <Trouble said={error} />}
        <SectionLabel>What volunteers do</SectionLabel>
        <p>
          Volunteers review low-risk reports — spam, off-topic posts, minor etiquette — in course and study-group
          communities. Anything serious goes straight to trained professionals and is never shown to a volunteer, and
          neither is anything from a support community.
        </p>
        <SectionLabel>To join</SectionLabel>
        <ul>
          <li>A verified student account at least {VOLUNTEER_RULES.minAccountAgeDays} days old, with no active restriction.</li>
          <li>Training with Trust & Safety, a confidentiality agreement and the recusal rules.</li>
          <li>
            {VOLUNTEER_RULES.calibrationTasks} practice cases with known answers, passing at{' '}
            {Math.round(VOLUNTEER_RULES.calibrationPass * 100)}%.
          </li>
          <li>
            At most {VOLUNTEER_RULES.perHour} reviews an hour and {VOLUNTEER_RULES.perDay} a day.
          </li>
        </ul>
        <ActionButton disabled={busy} onClick={() => act(applyToVolunteer, 'Application received. Next: training and the two agreements.')}>
          Apply to volunteer
        </ActionButton>
        {status && <p role="status">{status}</p>}
      </Page>
    );
  }

  if (record.status === 'revoked' || record.status === 'paused') {
    return (
      <Page blurb={blurb}>
        <Notice>{STATUS_TEXT[record.status]}</Notice>
      </Page>
    );
  }

  const ready = record.trained && record.confidentialitySigned && record.recusalAcknowledged;
  const atCap =
    standing !== null &&
    (standing.reviewsLastHour >= VOLUNTEER_RULES.perHour || standing.reviewsToday >= VOLUNTEER_RULES.perDay);

  return (
    <Page blurb={blurb}>
      {error && <Trouble said={error} />}
      {status && <p role="status">{status}</p>}

      <SectionLabel>Before your first review</SectionLabel>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-3)' }}>
        <li className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <strong>Training</strong>
          <span>{record.trained ? 'Done — recorded by Trust & Safety.' : 'Waiting — Trust & Safety records this after your session.'}</span>
        </li>
        <li className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <strong>Confidentiality</strong>
          <span>{CONFIDENTIALITY}</span>
          {record.confidentialitySigned ? (
            <span>Done — you agreed.</span>
          ) : (
            <div>
              <ActionButton disabled={busy} onClick={() => act(() => attest('confidentiality'))}>
                I agree
              </ActionButton>
            </div>
          )}
        </li>
        <li className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <strong>Recusal</strong>
          <span>{RECUSAL}</span>
          {record.recusalAcknowledged ? (
            <span>Done — you agreed.</span>
          ) : (
            <div>
              <ActionButton disabled={busy} onClick={() => act(() => attest('recusal'))}>
                I understand
              </ActionButton>
            </div>
          )}
        </li>
      </ul>

      <SectionLabel style={{ marginTop: 'var(--sp-6)' }}>Where you stand</SectionLabel>
      <p>{STATUS_TEXT[record.status]}</p>
      {standing && (
        <ul>
          {record.status === 'onboarding' && (
            <li>
              {Math.min(standing.onboardingAnswered, VOLUNTEER_RULES.calibrationTasks)} of {VOLUNTEER_RULES.calibrationTasks} practice
              cases answered.
            </li>
          )}
          <li>
            Accuracy on recent checks:{' '}
            {standing.quality === null ? 'not enough checks yet' : `${standing.quality} out of 100`}. Active needs{' '}
            {VOLUNTEER_RULES.activeAt}; below {VOLUNTEER_RULES.pauseBelow} pauses reviewing.
          </li>
          <li>
            {standing.reviewsLastHour} of {VOLUNTEER_RULES.perHour} reviews this hour · {standing.reviewsToday} of{' '}
            {VOLUNTEER_RULES.perDay} today.
          </li>
        </ul>
      )}

      <SectionLabel style={{ marginTop: 'var(--sp-6)' }} aside={queue.length ? `${queue.length}` : undefined}>
        Your queue
      </SectionLabel>
      <Notice>{CRISIS_NOTICE}</Notice>
      <p>
        Some of these are practice cases with known answers, and you won’t be told which. Removing a post needs a
        second volunteer to agree; if two of you disagree, a professional decides.
      </p>
      {!ready ? (
        <p>Your queue opens once training and both agreements are done.</p>
      ) : atCap ? (
        <p>You’ve reached the review limit for now. Take a break — the queue will be here.</p>
      ) : (
        <ActionButton
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError('');
            void nextTasks()
              .then((t) => {
                setQueue(t);
                if (t.length === 0) setStatus('Nothing to review right now.');
              })
              .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load cases to review.'))
              .finally(() => setBusy(false));
          }}
        >
          {queue.length ? 'Refresh the queue' : 'Get cases to review'}
        </ActionButton>
      )}

      <ol style={{ listStyle: 'none', padding: 0, margin: 'var(--sp-4) 0 0', display: 'grid', gap: 'var(--sp-4)' }}>
        {queue.map((t) => (
          <TaskCard
            key={t.taskId}
            task={t}
            busy={busy}
            onDecide={(action, reason) =>
              act(async () => {
                await decideTask(t.taskId, action, reason);
                setQueue((all) => all.filter((x) => x.taskId !== t.taskId));
              }, 'Recorded.')
            }
          />
        ))}
      </ol>
    </Page>
  );
}

function TaskCard({
  task,
  busy,
  onDecide,
}: {
  task: VolunteerTask;
  busy: boolean;
  onDecide: (action: VolunteerAction, reason: string) => void;
}) {
  // No default: a reason picked by leaving the first one selected is not a reason.
  const [reason, setReason] = useState('');
  return (
    <li className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-3)' }} aria-label="A post to review">
      <span style={{ color: 'var(--app-dim)' }}>
        Reported as: {CATEGORY[task.category] ?? task.category} · {task.severity === 'P3' ? 'minor' : 'standard'} · in{' '}
        {KIND_TEXT[task.communityKind] ?? 'a community'}
      </span>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{task.body}</p>
      <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        Reason
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="" disabled>
            Choose a reason first
          </option>
          {REASONS.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
        <button type="button" className="btn btn-secondary" disabled={busy || !reason} onClick={() => onDecide('allow', reason)}>
          Keep it up
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy || !reason} onClick={() => onDecide('label', reason)}>
          Add a label
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy || !reason} onClick={() => onDecide('remove', reason)}>
          Remove it
        </button>
      </div>
    </li>
  );
}
