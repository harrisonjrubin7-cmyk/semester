import { useEffect, useMemo, useState } from 'react';
import {
  DEMAND_SOURCE_LINE,
  NOT_FOR_LINE,
  contributionChanged,
  contributionFrom,
  type Contributed,
  type MyContribution,
} from '../lib/course-demand';
import { contribute, myContribution, stopContributing } from '../lib/course-demand-remote';
import { useRegistrationPlan } from '../lib/registration-plan';
import { useStore } from '../state/store';
import { ConfirmDialog } from './ConfirmDialog';

const day = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function CourseList({ courses }: { courses: readonly Contributed[] }) {
  return (
    <ul className="demand-list">
      {courses.map((c) => (
        <li key={`${c.role}:${c.course}`}>
          <strong>{c.course}</strong> — {c.role === 'primary' ? 'planning to take' : `backup ${c.rank ?? 1}`}
        </li>
      ))}
    </ul>
  );
}

/**
 * Contribute to course demand (`demand_forecasting`, Phase K), under the
 * registration cart. Off until the student says so, per term.
 *
 * The confirmation shows exactly what is sent — the term, and each course
 * code as planned or a backup — and what is not. Stopping is prospective,
 * and says so. When the cart has changed since, the student is told and can
 * send the new plan; nothing is updated behind their back.
 */
export function DemandContribution({ accountId }: { accountId?: string | null } = {}) {
  const { account } = useStore();
  const userId = accountId !== undefined ? accountId : (account?.id ?? null);
  const plan = useRegistrationPlan();
  const proposed = useMemo(() => contributionFrom(plan.cart, plan.data.backups, plan.catalog), [plan.cart, plan.data.backups, plan.catalog]);
  const term = proposed?.term ?? '';
  const [mine, setMine] = useState<MyContribution | null | 'loading' | 'error'>('loading');
  const [round, setRound] = useState(0);
  const [confirm, setConfirm] = useState<'send' | 'stop' | null>(null);
  const [said, setSaid] = useState('');
  const [failed, setFailed] = useState('');

  useEffect(() => {
    if (!userId || !term) return;
    let live = true;
    myContribution(term)
      .then((m) => live && setMine(m))
      .catch(() => live && setMine('error'));
    return () => {
      live = false;
    };
  }, [userId, term, round]);

  const header = (
    <>
      <h3>Help your school plan sections</h3>
      <p className="portal-muted">
        If you choose, the courses in your cart are counted with other students’ — anonymously, and only when ten or more
        plan the same course — so your registrar and departments can see where demand is. {NOT_FOR_LINE}
      </p>
    </>
  );

  if (!userId) {
    return (
      <section className="portal-panel demand-contribution" aria-label="Contribute to course demand">
        {header}
        <p>Sign in to contribute. Nothing is counted from this device.</p>
      </section>
    );
  }
  if (!proposed || !proposed.courses.length) {
    return (
      <section className="portal-panel demand-contribution" aria-label="Contribute to course demand">
        {header}
        <p>Add courses to your cart first.</p>
      </section>
    );
  }

  const run = async (what: () => Promise<unknown>, ok: string) => {
    setFailed('');
    try {
      await what();
      setSaid(ok);
      setRound((r) => r + 1);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    }
  };

  const live = mine !== 'loading' && mine !== 'error' && mine !== null && mine.revokedAt === null ? mine : null;
  const changed = live ? contributionChanged(live.courses, proposed.courses) : false;

  return (
    <section className="portal-panel demand-contribution" aria-label="Contribute to course demand">
      {header}
      {said ? <p role="status" className="balance-said">{said}</p> : null}
      {failed ? <p role="alert">{failed}</p> : null}
      {mine === 'loading' ? <p role="status">Checking whether you contribute for {term}…</p> : null}
      {mine === 'error' ? <p role="alert">Could not check your contribution. Try again later.</p> : null}

      {live ? (
        <>
          <p>
            <strong>You contribute for {term}</strong>
            {live.consentedAt ? ` since ${day(live.consentedAt)}` : ''}.
          </p>
          <CourseList courses={live.courses} />
          {changed ? <p className="portal-warning">Your cart has changed since you sent it. The counts still use what you sent.</p> : null}
          <div className="office-buttons">
            {changed ? (
              <button type="button" className="balance-button" onClick={() => setConfirm('send')}>
                Send my current plan…
              </button>
            ) : null}
            <button type="button" className="balance-button" onClick={() => setConfirm('stop')}>
              Stop contributing…
            </button>
          </div>
        </>
      ) : mine !== 'loading' && mine !== 'error' ? (
        <>
          {mine?.revokedAt ? <p>You stopped contributing for {term} on {day(mine.revokedAt)}.</p> : null}
          <button type="button" className="balance-button" onClick={() => setConfirm('send')}>
            Contribute my plan for {term}…
          </button>
        </>
      ) : null}
      <p className="portal-muted">{DEMAND_SOURCE_LINE}</p>

      {confirm === 'send' ? (
        <ConfirmDialog
          title={`Contribute your ${term} plan?`}
          preview={
            <>
              <p>Sent to your school’s demand count:</p>
              <CourseList courses={proposed.courses} />
              {proposed.skipped.length ? <p>Left out, because they are not course codes: {proposed.skipped.join(', ')}.</p> : null}
              <p>
                <strong>Not sent:</strong> your name, sections, times, instructors, or anything else in Semester.
              </p>
              <p>
                Staff see only how many students plan each course, and only when ten or more do. Nobody sees your plan. {NOT_FOR_LINE}
              </p>
              <p>You can stop at any time. Counts already published keep you until they are next refreshed; none after that.</p>
            </>
          }
          confirmLabel="Contribute"
          onConfirm={() => {
            setConfirm(null);
            void run(() => contribute(proposed.term, proposed.courses), `Contributing your ${proposed.term} plan.`);
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm === 'stop' ? (
        <ConfirmDialog
          title={`Stop contributing for ${term}?`}
          preview={
            <>
              <p>Your courses are removed from the demand count now.</p>
              <p>Counts already published keep you until they are next refreshed. No refresh after that counts you.</p>
            </>
          }
          confirmLabel="Stop contributing"
          onConfirm={() => {
            setConfirm(null);
            void run(() => stopContributing(term), `You no longer contribute for ${term}.`);
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </section>
  );
}
