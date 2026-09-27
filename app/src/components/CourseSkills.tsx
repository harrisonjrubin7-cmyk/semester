import { EMPTY_EVIDENCE, decide, readEvidence, reviewedSkills, slug } from '../lib/career-evidence';
import { useDeviceLibrary } from '../lib/device-library';
import { deriveSkillClaims } from '../lib/skills-graph';
import type { Course } from '../lib/types';
import { useStore } from '../state/store';
import { evidenceKey } from './CareerEvidence';

/**
 * Skills this course suggests (`career_evidence`, Phase I), on the course's
 * overview: read from the course's own description and unit names, and
 * confirmed or rejected here or in Career › Evidence — the same decision in
 * both places. A suggestion is not a claim until the student confirms it.
 */
export function CourseSkills({ course }: { course: Course }) {
  const { state, account, catalog, dispatch } = useStore();
  const store = useDeviceLibrary(evidenceKey(account?.id, state.term), readEvidence, EMPTY_EVIDENCE);
  const guide = catalog.guides[course.id];
  const claims = deriveSkillClaims({
    courses: [
      {
        id: course.id,
        title: `${course.code} ${course.name}`,
        details: [guide?.blurb, ...(guide?.units.map((u) => u.name) ?? [])].filter(Boolean).join(' '),
        sourceLabel: `${course.code} · ${course.name}`,
      },
    ],
    projects: [],
    work: [],
    organizations: [],
  });
  if (!claims.length) return null;
  const skills = reviewedSkills(claims, store.value).filter((s) => s.origin === 'suggested');
  const claimOf = (key: string) => claims.find((c) => slug(c.skill) === key)!;
  return (
    <section className="portal-panel course-skills" aria-label="Skills from this course">
      <h3>Skills this course may show</h3>
      <p className="portal-muted">Suggested from the course description. Confirm the ones you can back up; only confirmed skills reach your résumé.</p>
      <ul className="evidence-list">
        {skills.map((s) => (
          <li key={s.key} data-state={s.state}>
            <strong>{s.name}</strong> — {s.state === 'suggested' ? 'Suggested' : s.state === 'confirmed' ? 'Confirmed' : 'Rejected'}{' '}
            {s.state !== 'confirmed' ? (
              <button type="button" className="balance-button" onClick={() => store.update((e) => decide(e, claimOf(s.key), 'confirmed', s.name, Date.now()))}>
                Confirm
              </button>
            ) : null}{' '}
            {s.state !== 'rejected' ? (
              <button type="button" className="balance-button" onClick={() => store.update((e) => decide(e, claimOf(s.key), 'rejected', s.name, Date.now()))}>
                Reject
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <button type="button" className="workspace-text-button" onClick={() => dispatch({ type: 'go', screen: 'career' })}>
        Bullets, portfolio and résumé versions are in Career → Evidence
      </button>
    </section>
  );
}
