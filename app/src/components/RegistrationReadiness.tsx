import { useMemo } from 'react';
import { EMPTY_MEETINGS, meetingKey, meetingWithNamedAgenda, readMeetings } from '../lib/advisor-meeting';
import { useDeviceLibrary } from '../lib/device-library';
import { MODULE_FLAGS, moduleOn } from '../lib/experience-flags';
import { hasPathProfile } from '../lib/path-profile';
import { namedCoursesFrom, overallReadiness, pathReadiness, readinessCount, readinessFacts, type PathReadinessInput, type PathReadinessItem } from '../lib/path-readiness';
import { useRegistrationPlan } from '../lib/registration-plan';
import { useStore } from '../state/store';
import { usePathProfile } from './PathProfileForm';
import { SectionLabel } from './ui';

const stateText = { ready: 'Ready', attention: 'Needs attention', not_started: 'Not started' } as const;

/**
 * A single, student-facing readiness view over data Semester already keeps.
 * It routes to the existing My Path and Registration workspaces instead of
 * creating another planner, and it never promotes imported data to official.
 */
export function RegistrationReadiness({ onPrepareMeeting }: { onPrepareMeeting?: () => void } = {}) {
  const { state, account, dispatch } = useStore();
  const profile = usePathProfile();
  const plan = useRegistrationPlan();
  const meetings = useDeviceLibrary(meetingKey(account?.id), readMeetings, EMPTY_MEETINGS);
  const input = useMemo<PathReadinessInput>(() => ({
    pathConfigured: hasPathProfile(profile.value),
    requirementTotal: state.requirements.length,
    namedCourses: namedCoursesFrom(state.courses),
    cart: plan.cart,
    catalog: plan.catalog,
    registration: plan.data,
    meetings: meetings.value,
    institution: plan.institution,
  }), [meetings.value, plan.cart, plan.catalog, plan.data, plan.institution, profile.value, state.courses, state.requirements.length]);
  const items = useMemo(() => pathReadiness(input), [input]);
  const count = readinessCount(items);
  const overall = overallReadiness(items, readinessFacts(input));
  const action = (item: PathReadinessItem): { label: string; run: () => void; disabled?: boolean } => {
    if (item.id === 'named' && item.state === 'attention') {
      return {
        label: 'Add to my meeting',
        run: () => {
          const wrote = meetings.update((lib) => meetingWithNamedAgenda(lib, namedCoursesFrom(state.courses), Date.now()));
          if (wrote) onPrepareMeeting?.();
        },
      };
    }
    if (item.id === 'named' && item.state === 'ready' && onPrepareMeeting) {
      return { label: 'Show my meeting', run: () => onPrepareMeeting() };
    }
    if (item.id === 'named' && item.state === 'ready') {
      return { label: 'On your agenda', disabled: true, run: () => {} };
    }
    return {
      label: item.destination === 'degree' ? 'Open My Path' : 'Open Registration',
      run: () => dispatch({ type: 'go', screen: item.destination }),
    };
  };

  return (
    <section className="path-readiness" aria-labelledby="path-readiness-title">
      <SectionLabel aside={`${count.ready} of ${count.total} ready`}>Registration readiness</SectionLabel>
      <h3 id="path-readiness-title" className="balance-heading">Know what is ready before your window opens</h3>
      <p className="portal-muted">
        This is preparation, not registration clearance. Your registrar, advisor and official system remain the authority.
      </p>
      <p className="path-readiness-overall" data-state={overall.state}>
        <strong>{overall.label}.</strong> {overall.why}
      </p>
      <ol className="path-readiness-list">
        {items.map((item) => {
          const next = action(item);
          return (
            <li key={item.id} data-state={item.state}>
              <div>
                <strong>{item.label}</strong>
                <span className="path-readiness-state">{stateText[item.state]}</span>
                <p>{item.detail}</p>
              </div>
              <button type="button" className="balance-button" onClick={next.run} disabled={next.disabled}>
                {next.label}
              </button>
            </li>
          );
        })}
      </ol>

      <details className="path-readiness-systems">
        <summary>Institution connections and official actions</summary>
        <dl>
          <div><dt>Institution-managed resources</dt><dd>{plan.institution ? `Imported catalog from ${plan.institution}; Semester has not verified it with the institution.` : 'No institution-managed catalog or resource feed is connected.'}</dd></div>
          <div><dt>SSO and LTI</dt><dd>Secure foundations exist, but a design partner must configure and authorize each tenant before they are active.</dd></div>
          <div><dt>OneRoster</dt><dd>Tenant-scoped staging exists; no live adapter or certified synchronization is active.</dd></div>
          <div><dt>Course workspace</dt><dd>{moduleOn(MODULE_FLAGS.course_studio) ? 'Course Studio is enabled for this build; the external LMS remains the source of truth.' : 'Semester uses imported course context and links back to the LMS; native course administration is not enabled.'}</dd></div>
          <div><dt>Official-system writes</dt><dd>{plan.data.portalUrl ? 'Your approved handoff opens the official registration system. Semester does not submit or claim a seat.' : 'No authorized write connection is active. Add the official portal address for a confirmed handoff.'}</dd></div>
        </dl>
      </details>
    </section>
  );
}
