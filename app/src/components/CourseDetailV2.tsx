import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModal, useScrim } from '../a11y/modal';
import { EMPTY_CAREER, readCareer } from '../lib/career';
import {
  EMPTY_SHORTLIST,
  SHORTLIST_KEY,
  careerDirections,
  catalogAge,
  clashLine,
  describedSkills,
  meetingLine,
  planImpact,
  readShortlist,
  relatedFuture,
  requirementFit,
  requisites,
  scheduleFit,
  seatLine,
  toggleCompare,
  liveShortlist,
  toggleSaved,
  type Shortlist,
  whyItMayFit,
} from '../lib/course-detail';
import { useDeviceLibrary } from '../lib/device-library';
import { DESKTOP, useMedia } from '../lib/media';
import type { CatalogCourse } from '../lib/registration';
import { useRegistrationPlan } from '../lib/registration-plan';
import { useNow, useStore } from '../state/store';
import { ConfirmDialog } from './ConfirmDialog';
import { SourceBadge } from './SourceBadge';

const STATE_MARK = { recorded: '✓', in_progress: '…', in_cart: '✓', not_recorded: '?' } as const;

/**
 * Course Detail V2 (`course_detail_v2`, Phase F): one course, laid out for a
 * decision.
 *
 * Under 1180px it is a modal sheet over the list; from 1180px a drawer docked
 * on the right that leaves the list usable, so another result can be opened
 * without closing it first. Both close on Escape and return focus.
 *
 * Facts come first (credits, modality, meetings, seats as reported), then
 * "Why it may fit", then each section a decision turns on. Every section
 * says where it came from. Adding to the cart and leaving for the official
 * catalog both go through a preview first.
 */
export function CourseDetailV2({
  course,
  catalog,
  cart,
  importedAt,
  onToggleCart,
  onOpen,
  onClose,
}: {
  course: CatalogCourse;
  catalog: CatalogCourse[];
  cart: CatalogCourse[];
  importedAt: string | null;
  onToggleCart: (id: string) => boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const { state, account } = useStore();
  const wide = useMedia(DESKTOP);
  const headingId = useId();
  const first = useRef<HTMLHeadingElement>(null);
  const { ref: modalRef, onKeyDown: modalKeys } = useModal<HTMLDivElement>({ onClose, initial: first, on: !wide });
  const scrim = useScrim(onClose);
  const { data: day } = useRegistrationPlan();
  const library = useDeviceLibrary(SHORTLIST_KEY, readShortlist, EMPTY_SHORTLIST);
  // Read and changed against this catalog, so a stale or reused id counts for nothing.
  const shortlist = {
    value: liveShortlist(library.value, catalog),
    update: (f: (l: Shortlist) => Shortlist) => library.update((l) => f(liveShortlist(l, catalog))),
  };
  const career = useDeviceLibrary(`semester.career.v1:${account?.id || 'device'}:${state.term}`, readCareer, EMPTY_CAREER).value;
  const [confirm, setConfirm] = useState<'add' | 'remove' | 'leave' | null>(null);
  const [said, setSaid] = useState('');
  const now = useNow();

  useEffect(() => {
    if (!wide) return undefined;
    const came = document.activeElement as HTMLElement | null;
    first.current?.focus();
    return () => {
      if (came && came.isConnected) came.focus();
    };
  }, [wide]);

  const reqs = useMemo(() => requisites(course, state.taken, cart), [course, state.taken, cart]);
  const fit = useMemo(() => requirementFit(course, state.requirements, state.taken), [course, state.requirements, state.taken]);
  const clashes = useMemo(() => scheduleFit(course, cart, state.commitments), [course, cart, state.commitments]);
  const impact = planImpact(course, cart, day.creditTarget);
  const why = whyItMayFit({ course, fit, reqs, clashes, impact });
  const skills = useMemo(() => describedSkills(course), [course]);
  const directions = careerDirections(skills, career.opportunities);
  const future = useMemo(() => relatedFuture(course, catalog), [course, catalog]);
  const age = catalogAge(importedAt, now);
  const saved = shortlist.value.saved.includes(course.id);
  const comparing = shortlist.value.compare.includes(course.id);

  const confirmCart = () => {
    const adding = confirm === 'add';
    setConfirm(null);
    if (onToggleCart(course.id)) {
      setSaid(adding ? `${course.code} section ${course.section} is in your cart. Nothing was submitted to your school.` : `${course.code} section ${course.section} was removed from your cart.`);
    }
  };

  const body = (
    <>
      <div className="explain-head">
        <div>
          <span className="portal-eyebrow">
            {course.code} · Section {course.section} · {course.term}
          </span>
          <h2 id={headingId} ref={first} tabIndex={-1} className="explain-title">
            {course.title}
          </h2>
        </div>
        <button type="button" className="explain-close" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="explain-body course-v2">
        <p className="course-v2-source">
          <SourceBadge label="imported" at={age.at} now={now.getTime()} /> From the catalog you imported.
          {age.stale ? ' It is over two months old — check the official catalog for changes.' : ''}
        </p>

        <dl className="course-v2-facts">
          <div><dt>Credits</dt><dd>{course.credits}</dd></div>
          <div><dt>Modality</dt><dd>{course.modality || 'Not stated in the catalog'}</dd></div>
          <div><dt>Meets</dt><dd>{meetingLine(course)}</dd></div>
          <div><dt>Instructor</dt><dd>{course.instructor || 'Not supplied'}</dd></div>
          <div><dt>Location</dt><dd>{course.location || 'Not supplied'}</dd></div>
          <div><dt>Seats</dt><dd>{seatLine(course)}</dd></div>
        </dl>

        <div className="course-v2-actions">
          <button type="button" className="balance-button" aria-pressed={saved} onClick={() => shortlist.update((l) => toggleSaved(l, course.id, course.code))}>
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            className="balance-button"
            aria-pressed={comparing}
            disabled={!saved}
            title={saved ? undefined : 'Save it first to compare'}
            onClick={() => shortlist.update((l) => toggleCompare(l, course.id))}
          >
            {comparing ? 'Comparing' : 'Compare'}
          </button>
          <button type="button" className="balance-button" onClick={() => setConfirm(impact.inCart ? 'remove' : 'add')}>
            {impact.inCart ? 'Remove from cart…' : 'Add to cart…'}
          </button>
          {course.url ? (
            <button type="button" className="balance-button" onClick={() => setConfirm('leave')}>
              Official catalog…
            </button>
          ) : null}
        </div>
        {!course.url ? <p className="balance-muted">This catalog file has no link to the official course page.</p> : null}
        {said ? <p role="status" className="balance-said">{said}</p> : null}

        <Section title="Why it may fit" badge="estimated">
          {why.reasons.length ? (
            <ul>{why.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          ) : (
            <p>Nothing Semester holds points either way yet. Add your requirements and completed courses on My Path to see more.</p>
          )}
          <details className="balance-more">
            <summary>What this can’t tell you</summary>
            <ul>{why.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
            <p>Other options: {why.alternatives.join(' ')}</p>
          </details>
        </Section>

        <Section title="Requirement fit" badge="estimated">
          {state.requirements.length === 0 ? (
            <p>Add your requirements on My Path to see where this could count.</p>
          ) : fit.length ? (
            <ul>
              {fit.map((f) => (
                <li key={f.requirement.id}>
                  {f.requirement.programme ? `${f.requirement.programme}: ` : ''}
                  {f.requirement.name} — {f.left} {f.unit} still needed{f.elective ? ' (any course counts)' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p>No requirement you recorded accepts {course.code} and still needs something.</p>
          )}
          <p className="balance-muted">May count. Only your school’s degree audit decides.</p>
        </Section>

        <Section title="Prerequisites and corequisites" badge="imported">
          <p>{reqs.text || 'The catalog lists none — check with the department.'}</p>
          {reqs.items.length ? (
            <ul className="course-v2-requisites">
              {reqs.items.map((r) => (
                <li key={`${r.kind}:${r.code}`} data-state={r.state}>
                  <span aria-hidden="true">{STATE_MARK[r.state]}</span> {r.kind === 'corequisite' ? 'Corequisite: ' : ''}
                  {r.says}
                </li>
              ))}
            </ul>
          ) : null}
          {reqs.unread ? <p className="balance-muted">The wording has conditions besides course codes; read it above.</p> : null}
          <p className="balance-muted">
            Read against the courses you recorded <SourceBadge label="student_entered" /> — the department decides whether you may enroll.
          </p>
        </Section>

        <Section title="Schedule fit" badge="estimated">
          {!course.meetings.length ? (
            <p>No meeting times in the catalog, so nothing to check.</p>
          ) : clashes.length ? (
            <ul>{clashes.map((c) => <li key={`${c.with}:${c.day}:${c.from}`}>{clashLine(c)}</li>)}</ul>
          ) : (
            <p>No overlaps with your cart or your timed commitments.</p>
          )}
        </Section>

        <Section title="Plan impact" badge="estimated">
          <p>{impact.says}</p>
          {impact.target === null ? <p className="balance-muted">Set a credit target in Registration day to compare against it.</p> : null}
        </Section>

        <Section title="Description" badge="imported">
          <p>{course.description || 'The catalog does not include a description.'}</p>
        </Section>

        <Section title="Skills and career directions" badge="estimated">
          {skills.length ? (
            <>
              <p>Named in the description: {skills.join(', ')}.</p>
              {directions.length ? (
                <ul>
                  {directions.map((d) => (
                    <li key={d.title}>
                      {d.title} — saved in your Career list; asks for {d.skills.join(', ')}.
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="balance-muted">None of the opportunities you saved in Career mention these.</p>
              )}
            </>
          ) : (
            <p>The description does not name skills Semester recognises.</p>
          )}
          <p className="balance-muted">Suggestions from the wording only — not a claim about what you will learn.</p>
        </Section>

        <Section title="Related future courses" badge="imported">
          {future.length ? (
            <ul className="course-v2-future">
              {future.map((c) => (
                <li key={c.id}>
                  <button type="button" className="workspace-text-button" onClick={() => onOpen(c.id)}>
                    {c.code} · {c.title}
                  </button>{' '}
                  lists {course.code} as a prerequisite.
                </li>
              ))}
            </ul>
          ) : (
            <p>No course in this catalog lists {course.code} as a prerequisite.</p>
          )}
        </Section>

        <details className="balance-more">
          <summary>Coming later</summary>
          <ul>
            <li>Student workload and usefulness insights — only moderated, verified reports will appear here. Semester shows no professor ratings.</li>
            <li>A faculty-approved study pack, when an instructor publishes one.</li>
            <li>Links to the syllabus this course is taught from.</li>
          </ul>
          <p className="balance-muted">None of these is available yet, and nothing is estimated in their place.</p>
        </details>
      </div>

      {confirm === 'add' || confirm === 'remove' ? (
        <ConfirmDialog
          title={confirm === 'add' ? 'Add to your registration cart?' : 'Remove from your registration cart?'}
          preview={
            <>
              <p>
                <strong>
                  {course.code} · Section {course.section} — {course.title}
                </strong>
              </p>
              <p>{confirm === 'add' ? impact.says : `Your cart goes from ${impact.before + course.credits} to ${impact.before} credits.`}</p>
              <p>The cart is a draft on this device. It does not register you, and it does not hold a seat.</p>
            </>
          }
          confirmLabel={confirm === 'add' ? 'Add to cart' : 'Remove from cart'}
          onConfirm={confirmCart}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm === 'leave' && course.url ? (
        <ConfirmDialog
          title="Open the official catalog?"
          tone="external"
          preview={<p className="dialog-url">{course.url}</p>}
          confirmLabel="Open catalog"
          onConfirm={() => {
            window.open(course.url, '_blank', 'noopener,noreferrer');
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </>
  );

  const escape = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && !confirm) {
      ev.stopPropagation();
      onClose();
    }
  };
  const host = typeof document === 'undefined' ? null : document.querySelector('.device');

  if (wide) {
    const aside = (
      <aside className="explain-drawer course-drawer" aria-labelledby={headingId} onKeyDown={escape}>
        {body}
      </aside>
    );
    return host ? createPortal(aside, host) : aside;
  }
  const sheet = (
    <div className="explain-wash" {...scrim}>
      <div
        ref={modalRef}
        className="explain-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={confirm ? undefined : modalKeys}
        onClick={(ev) => ev.stopPropagation()}
      >
        <span className="explain-handle" aria-hidden="true" />
        {body}
      </div>
    </div>
  );
  return host ? createPortal(sheet, host) : sheet;
}

function Section({ title, badge, children }: { title: string; badge: 'imported' | 'estimated'; children: ReactNode }) {
  const id = useId();
  return (
    <section className="course-v2-section" aria-labelledby={id}>
      <h3 id={id}>
        {title} <SourceBadge label={badge} />
      </h3>
      {children}
    </section>
  );
}
