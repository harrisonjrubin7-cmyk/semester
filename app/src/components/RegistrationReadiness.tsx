import { useEffect, useMemo, useState } from 'react';
import { EMPTY_MEETINGS, meetingKey, meetingWithNamedAgenda, readMeetings } from '../lib/advisor-meeting';
import { useDeviceLibrary } from '../lib/device-library';
import { MODULE_FLAGS, moduleOn } from '../lib/experience-flags';
import { hasPathProfile } from '../lib/path-profile';
import { namedCoursesFrom, overallReadiness, pathReadiness, readinessCount, readinessFacts, type PathReadinessInput, type PathReadinessItem } from '../lib/path-readiness';
import { useRegistrationPlan } from '../lib/registration-plan';
import { useStore } from '../state/store';
import { cloudConfigured } from '../lib/cloud';
import { formatDateTime } from '../lib/locale';
import { useModuleGate } from '../lib/modulegate';
import { FLAG } from '../lib/enrollment/service';
import { loadMyHold, loadMyReadiness, staleTerms, type HoldNotice, type ReadinessStanding } from '../lib/enrollment/client';
import { usePathProfile } from './PathProfileForm';
import { Notice, SectionLabel } from './ui';

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
    importedAt: plan.importedAt,
  }), [meetings.value, plan.cart, plan.catalog, plan.data, plan.importedAt, plan.institution, profile.value, state.courses, state.requirements.length]);
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

      {cloudConfigured && <SchoolRecordCheck />}

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

/** Nothing is read from the school unless it runs registration through Semester. */
function SchoolRecordCheck() {
  const gate = useModuleGate(FLAG);
  return gate.status === 'on' ? <HoldStanding /> : null;
}

type Reading = { hold: HoldNotice; standing: ReadinessStanding[]; at: number };

const clock = (at: number) => formatDateTime(new Date(at), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * What the school's own record says, beside the preparation above: whether a
 * hold stops the student adding courses, and whether the server still counts
 * their readiness as current.
 *
 * When an office resolves a hold, the server marks any readiness worked out
 * while the hold stood as `stale` (`my_registration_readiness`). This shows
 * that as "Something changed — check again" rather than leaving an old answer
 * looking current, and "Check again" reads both afresh. A clear reading is a
 * receipt that says when it was checked and that it is not enrollment.
 */
export function HoldStanding() {
  const [reading, setReading] = useState<Reading | null | string>(null);
  const [reads, setReads] = useState(0);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([loadMyHold(), loadMyReadiness()]).then(
      ([hold, standing]) => { if (live) setReading({ hold, standing, at: Date.now() }); },
      (e: unknown) => { if (live) setReading(e instanceof Error ? e.message : 'Could not check your school’s registration record.'); },
    );
    return () => { live = false; };
  }, [reads]);

  const again = () => {
    setAsked(true);
    setReading(null);
    setReads((n) => n + 1);
  };
  const checkAgain = (
    <button type="button" className="balance-button" onClick={again}>
      Check again
    </button>
  );

  if (reading === null) {
    return <p role="status">Checking your school’s registration record…</p>;
  }
  if (typeof reading === 'string') {
    return (
      <div>
        <Notice alert>{reading} Nothing has changed.</Notice>
        {checkAgain}
      </div>
    );
  }

  const stale = staleTerms(reading.standing);
  const office = reading.hold.office || 'The office that placed it';
  return (
    <div data-hold-standing={stale.length ? 'stale' : reading.hold.held ? 'held' : 'clear'}>
      <SectionLabel>Your school’s record</SectionLabel>
      {stale.length > 0 && (
        <>
          <Notice>
            <strong>Something changed — check again.</strong> Your readiness for {stale.join(', ')} was worked out before
            something on your record changed, such as a hold being cleared, so it no longer counts as ready.
            {asked ? ` Checked ${clock(reading.at)}: your school has not worked it out again yet.` : ''}
          </Notice>
          {checkAgain}
        </>
      )}
      {reading.hold.held ? (
        <p>
          <strong>A hold stops you adding courses.</strong> {office} can clear it; you can still drop or withdraw.
          {reading.hold.link && (
            <>
              {' '}
              <a href={reading.hold.link} target="_blank" rel="noopener noreferrer">
                Contact {reading.hold.office || 'the office'} (opens outside Semester)
              </a>
            </>
          )}
        </p>
      ) : (
        <p>
          <strong>Checked {clock(reading.at)}.</strong> No hold stops you adding courses. This is not enrollment: you are not
          registered in any course until you enroll and your school confirms it.
        </p>
      )}
      {stale.length === 0 && checkAgain}
    </div>
  );
}
