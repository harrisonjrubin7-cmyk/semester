import { useEffect, useRef, useState } from 'react';
import { useNow, useStore } from '../../state/store';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { SourceBadge } from '../SourceBadge';
import { Result, RowItem, Rows, Row, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDateTime } from '../../lib/locale';
import { useRegistrationPlan } from '../../lib/registration-plan';
import {
  clashes,
  drop,
  enroll,
  inPlan,
  landing,
  loadMyHold,
  loadMyRegistration,
  loadSections,
  meetsSaid,
  phase,
  sectionName,
  withdraw,
  type Answer,
  type HoldNotice,
  type LiveSection,
  type MyEnrollment,
  type TermCalendar,
} from '../../lib/enrollment/client';

/**
 * A student's registration for one term: their enrollments and places in
 * line, any hold, and the sections they can enroll in.
 *
 * Enrolling is two steps, because the ledger takes the seat at commit and
 * never at review: Review shows where a request would land now (a seat, the
 * waitlist, a request for approval), and Confirm sends that expectation with
 * it. If the last seat went in between, the server answers
 * `stale_seat_count` and writes nothing, and the student is told so — rather
 * than finding themselves on a waitlist they did not agree to.
 *
 * Dropping and withdrawing are also two steps, and neither is styled as the
 * primary action: leaving a seat can hand it to the next person waiting, and
 * a withdrawal records a W.
 *
 * Every write goes through `useAttempts`, so its idempotency key is kept
 * across a retry after a lost reply and a fresh one is made for the next
 * attempt.
 */

type Load<T> = T | null | { error: string };
const failed = <T,>(v: Load<T>): v is { error: string } => !!v && typeof v === 'object' && 'error' in (v as object);

const STATE_SAID: Record<MyEnrollment['state'], string> = {
  enrolled: 'Enrolled',
  waitlisted: 'On the waitlist',
  pending_approval: 'Waiting for the registrar’s approval',
  dropped: 'Dropped',
  left_waitlist: 'Left the waitlist',
  withdrawn: 'Withdrawn — a W is recorded',
  denied: 'Not approved',
};

const LIVE = new Set<MyEnrollment['state']>(['enrolled', 'waitlisted', 'pending_approval']);

function when(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : formatDateTime(at, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** The term's calendar in one sentence. */
export function phaseSaid(t: TermCalendar | null, now: Date): string {
  switch (phase(t, now)) {
    case 'before':
      return `Registration for ${t!.term} opens ${when(t!.opensAt)}.`;
    case 'add_drop':
      return `Add/drop is open until ${when(t!.addDropEndsAt)}. You can enroll and drop without a W until then.`;
    case 'withdraw':
      return `Add/drop has ended. You can withdraw until ${when(t!.withdrawEndsAt)}, which records a W.`;
    case 'closed':
      return `The withdrawal deadline for ${t!.term} has passed. Changes now go through the registrar.`;
    default:
      return 'Your school has not published this term’s registration dates in Semester.';
  }
}

function landingSaid(s: LiveSection): string {
  switch (landing(s)) {
    case 'seat':
      return `There is a seat (${s.seatsTaken} of ${s.capacity} taken). Confirming enrolls you now.`;
    case 'waitlist':
      return `The section is full. Confirming puts you on the waitlist, number ${s.waiting + 1} in line. You are not enrolled until a seat comes to you.`;
    case 'approval':
      return 'This section needs the registrar’s approval. Confirming sends a request; you are not enrolled until they approve it.';
    case 'full':
      return 'The section and its waitlist are both full, so there is nothing to confirm.';
  }
}

const CONFIRM_LABEL = { seat: 'Confirm enrollment', waitlist: 'Join the waitlist', approval: 'Send the request', full: '' } as const;

export function StudentRegistration({ term, calendar }: { term: string; calendar: TermCalendar | null }) {
  const now = useNow();
  const { say } = useStore();
  const plan = useRegistrationPlan();
  const { attempt } = useAttempts();
  const [sections, setSections] = useState<Load<LiveSection[]>>(null);
  const [mine, setMine] = useState<Load<MyEnrollment[]>>(null);
  const [hold, setHold] = useState<Load<HoldNotice>>(null);
  const [readAt, setReadAt] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const [reads, setReads] = useState(0);
  const reviewHead = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    const err = (e: unknown) => ({ error: e instanceof Error ? e.message : 'Could not load this.' });
    loadSections(term).then((v) => { if (live) { setSections(v); setReadAt(Date.now()); } }, (e: unknown) => { if (live) setSections(err(e)); });
    loadMyRegistration(term).then((v) => { if (live) setMine(v); }, (e: unknown) => { if (live) setMine(err(e)); });
    loadMyHold().then((v) => { if (live) setHold(v); }, (e: unknown) => { if (live) setHold(err(e)); });
    return () => { live = false; };
  }, [term, reads]);

  useEffect(() => {
    if (reviewing) reviewHead.current?.focus();
  }, [reviewing]);

  const reload = () => setReads((n) => n + 1);

  /** One write: the answer, a refusal in words, or no answer and a retry with the same key. */
  async function send(what: string, run: (key: string) => Promise<Answer>): Promise<void> {
      setBusy(true);
      setSaid(null);
      try {
        const answer = await attempt(what, run);
        if (answer.ok) {
          const extra = answer.promoted > 0 ? ' A waiting student was given the seat.' : '';
          setSaid({ tone: 'ok', text: `${answer.message}${answer.replayed ? ' (Already done — nothing was sent twice.)' : ''}${extra}` });
          say(answer.message);
          setReviewing(null);
          setLeaving(null);
        } else {
          const office = answer.hold?.office ? ` ${answer.hold.office} placed it.` : '';
          setSaid({ tone: 'refused', text: `${answer.message}${office}` });
        }
        setReads((n) => n + 1);
      } catch (e) {
        const text = e instanceof Error ? e.message : 'The request was not sent.';
        setSaid(settled(e) ? { tone: 'refused', text } : { tone: 'unknown', text, retry: () => void send(what, run) });
      } finally {
        setBusy(false);
      }
  }

  if (failed(sections) || failed(mine)) {
    return (
      <>
        <Notice alert>
          {(failed(sections) ? sections.error : failed(mine) ? mine.error : '')} Your plan on the Registration screen is still
          there. Try again, or use your school’s own registration system.
        </Notice>
        <button type="button" className="btn" onClick={reload}>
          Load again
        </button>
      </>
    );
  }
  if (sections === null || mine === null) return <p role="status">Loading your registration for {term}…</p>;

  const byId = new Map(sections.map((s) => [s.id, s]));
  const enrolled = mine.filter((m) => m.state === 'enrolled').map((m) => byId.get(m.sectionId)).filter((s): s is LiveSection => !!s);
  const liveIn = new Set(mine.filter((m) => LIVE.has(m.state)).map((m) => m.sectionId));
  const stage = phase(calendar, now);
  const credits = enrolled.reduce((n, s) => n + s.credits, 0);

  return (
    <>
      <Result said={said} />

      {failed(hold) ? (
        <Notice>Could not check for a registration hold just now. If there is one, enrolling will say so.</Notice>
      ) : hold?.held ? (
        <Notice alert>
          A hold on your account stops you adding courses. {hold.office || 'The office that placed it'} can clear it; you can
          still drop or withdraw.
          {hold.link && (
            <>
              {' '}
              <a href={hold.link} target="_blank" rel="noopener noreferrer">
                Contact {hold.office || 'the office'} (opens outside Semester)
              </a>
            </>
          )}
        </Notice>
      ) : null}

      <p>{phaseSaid(calendar, now)}</p>

      <SectionLabel aside={enrolled.length ? `${credits} credits${calendar ? ` of ${calendar.maxCredits}` : ''}` : undefined}>
        Your courses
      </SectionLabel>
      {mine.length === 0 ? (
        <EmptyState inline title="Nothing yet this term" body="Sections you enroll in, wait for or ask to join appear here, with your place in line." />
      ) : (
        <Rows label={`Your courses in ${term}`}>
          {mine.map((m) => {
            const name = sectionName(m);
            const canDrop = m.state === 'waitlisted' || m.state === 'pending_approval' || (m.state === 'enrolled' && (stage === 'add_drop' || stage === 'before'));
            const canWithdraw = m.state === 'enrolled' && stage === 'withdraw';
            const verb = m.state === 'waitlisted' ? 'Leave the waitlist' : m.state === 'pending_approval' ? 'Cancel the request' : canWithdraw ? 'Withdraw' : 'Drop';
            const consequence =
              m.state === 'waitlisted'
                ? `You give up your place in line for ${name}. Nothing else changes.`
                : m.state === 'pending_approval'
                  ? `Your request for ${name} is withdrawn. Nothing else changes.`
                  : canWithdraw
                    ? `You leave ${name} and a W is recorded on your transcript. It cannot be undone here.`
                    : `You lose your seat in ${name}, and the next person waiting may get it. No W is recorded.`;
            return (
              <RowItem key={m.enrollmentId}>
                <div>
                  <strong>{name}</strong>
                  <Sub>
                    {STATE_SAID[m.state]}
                    {m.state === 'waitlisted' && m.waitPosition ? ` — number ${m.waitPosition} in line` : ''}
                  </Sub>
                </div>
                {(canDrop || canWithdraw) && leaving !== m.sectionId && (
                  <Row>
                    <button type="button" className="btn" disabled={busy} onClick={() => { setLeaving(m.sectionId); setSaid(null); }}>
                      {verb} {name}
                    </button>
                  </Row>
                )}
                {leaving === m.sectionId && (
                  <div role="group" aria-label={`${verb} ${name}?`}>
                    <p>
                      <strong>{verb} {name}?</strong> {consequence}
                    </p>
                    <Row>
                      <button type="button" className="btn" disabled={busy} onClick={() => setLeaving(null)}>
                        Keep {name}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          void send(`${canWithdraw ? 'withdraw' : 'drop'}:${m.sectionId}`, (key) =>
                            canWithdraw ? withdraw(m.sectionId, key, name) : drop(m.sectionId, key, name),
                          )
                        }
                      >
                        {verb} — confirm
                      </button>
                    </Row>
                  </div>
                )}
              </RowItem>
            );
          })}
        </Rows>
      )}

      <SectionLabel aside={<SourceBadge label="institution_verified" at={readAt} />}>Sections this term</SectionLabel>
      {sections.length === 0 ? (
        <EmptyState inline title="No sections yet" body={`Your registrar has not opened any sections for ${term} in Semester. Your plan on the Registration screen is unaffected.`} />
      ) : (
        <Rows label={`Sections in ${term}`}>
          {sections.map((s) => {
            const name = sectionName(s);
            const planned = inPlan(s, plan.cart);
            const clash = clashes(s, enrolled);
            const where = landing(s);
            const open = reviewing === s.id;
            return (
              <RowItem key={s.id}>
                <div>
                  <strong>{name}</strong> · {s.title}
                  <Sub>
                    {s.credits} credits{s.meetings.length ? ` · ${meetsSaid(s.meetings)}` : ''} · {s.seatsTaken} of {s.capacity} seats taken
                    {s.waitlistCapacity > 0 ? ` · ${s.waiting} waiting` : ''}
                  </Sub>
                  <Sub>
                    {[
                      planned === 'section' ? 'In your plan' : planned === 'course' ? 'This course is in your plan, as another section' : '',
                      s.requiresApproval ? 'Needs the registrar’s approval' : '',
                      s.prerequisites.length ? `Needs ${s.prerequisites.join(', ')} first` : '',
                      clash.length ? `Meets at the same time as ${clash.map(sectionName).join(', ')}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Sub>
                </div>
                {!liveIn.has(s.id) && !open && (
                  <Row>
                    <button type="button" className="btn" disabled={busy} onClick={() => { setReviewing(s.id); setSaid(null); }}>
                      Review {name}
                    </button>
                  </Row>
                )}
                {open && (
                  <section aria-labelledby={`review-${s.id}`}>
                    <h3 id={`review-${s.id}`} ref={reviewHead} tabIndex={-1}>
                      Review before you enroll
                    </h3>
                    <p>{landingSaid(s)}</p>
                    {clash.length > 0 && <p>It meets at the same time as {clash.map(sectionName).join(', ')}; the registrar will refuse it unless one is dropped.</p>}
                    <Row>
                      {where !== 'full' && (
                        <ActionButton
                          tone="primary"
                          disabled={busy}
                          style={{ width: 'auto', flex: '1 1 auto' }}
                          onClick={() =>
                            void send(`enroll:${s.id}`, (key) =>
                              enroll(s.id, key, where === 'seat' || where === 'waitlist' ? where : null, name),
                            )
                          }
                        >
                          {CONFIRM_LABEL[where]}
                        </ActionButton>
                      )}
                      <button type="button" className="btn" disabled={busy} onClick={() => setReviewing(null)}>
                        Cancel
                      </button>
                    </Row>
                  </section>
                )}
              </RowItem>
            );
          })}
        </Rows>
      )}
    </>
  );
}
