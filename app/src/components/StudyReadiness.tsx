import { formatDate } from '../lib/locale';
import { useId, useMemo, useState } from 'react';
import { useDeviceLibrary } from '../lib/device-library';
import { useLive } from '../lib/live';
import { datedItems } from '../lib/select';
import {
  CONFIDENCE_LABEL,
  EMPTY_READINESS,
  READINESS_KEY,
  STATUSES,
  STATUS_LABEL,
  assessmentsAhead,
  markTopic,
  materialsFor,
  papersFor,
  readReadiness,
  recommend,
  signalLine,
  topicSignals,
  type Status,
} from '../lib/study-readiness';
import type { Course } from '../lib/types';
import { useNow, useStore } from '../state/store';
import { SourceBadge } from './SourceBadge';

/**
 * Study Readiness (`study_readiness`, Phase H), a tab in the course hub.
 *
 * For one upcoming assessment: each topic's state and confidence as the
 * student marks them, the practice counts the app already has, one short
 * session to do next, and the course's own materials for that topic. It says
 * nothing about a likely grade and compares the student with nobody.
 */
export function StudyReadiness({ course }: { course: Course }) {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
  const live = useLive(course.id);
  const library = useDeviceLibrary(READINESS_KEY, readReadiness, EMPTY_READINESS);
  const headingId = useId();
  const ahead = useMemo(() => assessmentsAhead(datedItems(catalog, now), course.id, state.done), [catalog, now, course.id, state.done]);
  const [picked, setPicked] = useState<string | null>(null);
  const exam = ahead.find((i) => i.id === picked) ?? ahead[0] ?? null;
  const units = live.guide.units;
  const signals = useMemo(() => units.map((u) => topicSignals(course.id, u, state.reviews, now.getTime())), [units, course.id, state.reviews, now]);
  const papers = papersFor(state.sittings, course.id);

  if (!exam) {
    return (
      <section className="portal-panel study-readiness" aria-labelledby={headingId}>
        <h3 id={headingId}>Study readiness</h3>
        <p className="portal-muted">No exam or major assessment is ahead for this course. It appears here once the syllabus lists one.</p>
      </section>
    );
  }
  const marks = library.value.byItem[exam.id]?.topics ?? {};
  const next = recommend(units, marks, signals);
  const mark = (unit: number, patch: { status?: Status | null; confidence?: number | null }) =>
    library.update((lib) => markTopic(lib, exam.id, unit, patch, now.getTime()));

  return (
    <section className="portal-panel study-readiness" aria-labelledby={headingId}>
      <h3 id={headingId}>Study readiness</h3>
      {ahead.length > 1 ? (
        <label className="portal-check">
          Assessment
          <select className="input" value={exam.id} onChange={(e) => setPicked(e.target.value)}>
            {ahead.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title} · {i.dueShort}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p>
        <strong>{exam.title}</strong> — {exam.dueShort}
        {exam.daysAway > 1 ? `, in ${exam.daysAway} days` : ''}. <SourceBadge label={exam.checked?.confirmed ? 'imported' : 'needs_review'} />
      </p>
      <p className="portal-muted">
        Mark where each topic stands for you. Semester shows what your practice so far records, suggests one short session, and makes no prediction
        about a grade.
      </p>
      {library.error ? <p role="alert">{library.error}</p> : null}

      {next ? (
        <section className="readiness-next" aria-label="Recommended session">
          <h4 className="balance-heading">Next: a {next.minutes}-minute session</h4>
          <p>{next.why}</p>
          <ol>{next.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <button type="button" className="balance-button" onClick={() => dispatch({ type: 'openGuide', id: course.id, unit: next.unit })}>
            Open {units[next.unit]?.name ?? 'the topic'}
          </button>
        </section>
      ) : (
        <p className="balance-said">Every topic is marked Reviewed and nothing is due. Keep your usual review going.</p>
      )}

      <h4 className="balance-heading">Topics</h4>
      <ul className="readiness-topics">
        {units.map((u, i) => {
          const m = marks[String(i)] ?? { status: null, confidence: null };
          const mats = materialsFor(i, u, state.updates, course.id, live.guide.addedUnits.includes(i));
          return (
            <li key={`${i}:${u.name}`}>
              <strong>{u.name}</strong>
              <div className="portal-filter-row">
                <label className="portal-check">
                  Where it stands
                  <select className="input" value={m.status ?? ''} onChange={(e) => mark(i, { status: (e.target.value || null) as Status | null })}>
                    <option value="">Not marked</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="portal-check">
                  How confident you feel
                  <select className="input" value={m.confidence ?? ''} onChange={(e) => mark(i, { confidence: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Not rated</option>
                    {CONFIDENCE_LABEL.map((label, n) => (
                      <option key={label} value={n + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="portal-muted">Practice: {signalLine(signals[i])}</p>
              {mats.length ? (
                <ul className="readiness-materials">
                  {mats.map((x) => (
                    <li key={`${x.title}:${x.detail}`}>
                      {x.title} — {x.detail} <SourceBadge label={x.label} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <h4 className="balance-heading">Practice papers</h4>
      {papers.length ? (
        <ul className="readiness-materials">
          {papers.slice(0, 5).map((p) => (
            <li key={p.id}>
              {p.title}: {p.got} of {p.outOf} on {formatDate(new Date(p.at), { month: 'short', day: 'numeric' })}
              {p.missed.length ? `, ${p.missed.length} to look back at` : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p className="portal-muted">No practice papers taken for this course yet.</p>
      )}
      <p className="portal-muted">These are counts of your own practice. They are not a forecast of your result.</p>
    </section>
  );
}
