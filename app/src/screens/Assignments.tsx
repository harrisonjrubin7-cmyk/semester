import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Notice, TabList } from '../components/ui';
import { Field, Row } from '../components/academic/Form';
import { InstructorAssignments } from '../components/assignments/InstructorAssignments';
import { StudentAssignments } from '../components/assignments/StudentAssignments';
import { loadMyCapabilities, type Grant } from '../lib/capabilities';
import { useAssignmentsAccess, modeSentence } from '../lib/assignments/access';
import { enrolledCourses, offeringKey, taughtCourses, type Offering } from '../lib/assignments/client';
import { termOf } from '../lib/gradebook/client';

/**
 * Assignments: an instructor's for a course, and a student's own.
 *
 * `lib/assignments/` and `20261001094000_assignments.sql` built it — an
 * assignment that is a draft until published, versions nobody overwrites, a
 * receipt the database writes with each one, per-student extensions with a
 * reason — and this is the screen that drives it. It is the first Core module
 * of the learning-management half (D-151): it shows only at a school that has
 * switched `lms_assignments` to Core, read the way the database reads it
 * (`lib/modulemode.ts`). At every other school it says, in one sentence, that
 * the school's assignments are still in its own system, and stops.
 *
 * Who sees which half comes from the caller's own course-and-term grants:
 * `assignments:author` or `:review` gives the instructor view, a student
 * holding `grades:receive` (the gradebook's roster, because there is one list
 * of who is in a course) gets their own. Somebody holding both on different
 * courses gets both. A term is offered only where a grant exists for it,
 * because grants are per term and a term typed in with none behind it would
 * only ever read nothing.
 *
 * It is kept apart from the planner on purpose: the planner is a student's own
 * list of work they typed in, and nothing it says is a record.
 */

export const BLURB = 'Your course’s assignments: write and publish them, read what students submitted, and grant extensions — or submit your own work and keep the receipt.';

type View = 'teaching' | 'mine';

export function Assignments() {
  const access = useAssignmentsAccess();
  const { dispatch } = useStore();
  const toPlanner = () => dispatch({ type: 'go', screen: 'courses' });

  if (access.status === 'loading') return <Page blurb={BLURB}><p role="status">Checking how your school runs assignments…</p></Page>;
  if (access.status === 'off') {
    return (
      <Page blurb={BLURB}>
        <Notice>Assignments in Semester need an account, and this build is not connected to one. Your own planner works without it.</Notice>
        <button type="button" className="btn" onClick={toPlanner}>Open your courses</button>
      </Page>
    );
  }
  if (access.status === 'signed_out' || access.status === 'no_school') {
    return (
      <Page blurb={BLURB}>
        <Notice>
          {access.status === 'signed_out'
            ? 'Sign in with your school account to see your assignments. They are your school’s records, so Semester needs to know who you are first.'
            : 'Your account has no school yet, so there are no assignments to show. Claim your school from the Me tab.'}
        </Notice>
      </Page>
    );
  }
  if (access.status === 'error') {
    return (
      <Page blurb={BLURB}>
        <Notice alert>{access.message} Nothing has changed.</Notice>
        <button type="button" className="btn" onClick={access.retry}>Try again</button>
      </Page>
    );
  }
  const said = modeSentence(access.mode);
  if (access.mode.mode !== 'core' && !access.mode.frozen) {
    return (
      <Page blurb={BLURB}>
        <Notice>{said}</Notice>
        <button type="button" className="btn" onClick={toPlanner}>Open your courses</button>
      </Page>
    );
  }
  return (
    <Page blurb={BLURB}>
      {said && <Notice alert={access.mode.source === 'kill-switch'}>{said}</Notice>}
      <CourseChooser school={access.school} me={access.userId} writable={said === null} />
    </Page>
  );
}

function CourseChooser({ school, me, writable }: { school: string; me: string; writable: boolean }) {
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);
  const [reads, setReads] = useState(0);
  const [view, setView] = useState<View>('teaching');
  const [picked, setPicked] = useState('');

  useEffect(() => {
    let live = true;
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    return () => { live = false; };
  }, [reads]);

  if (grants === 'error') {
    return (
      <>
        <Notice alert>Could not read which courses you teach or take. Nothing has changed. Try again in a moment.</Notice>
        <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>Try again</button>
      </>
    );
  }
  if (grants === null) return <p role="status">Reading which courses you teach and take…</p>;

  const teaching = taughtCourses(grants, school);
  const taking = enrolledCourses(grants, school);
  if (teaching.length === 0 && taking.length === 0) {
    return (
      <Notice>
        Your account is not an instructor or a student on any course in your school’s assignments, so there is nothing to show.
        Your school assigns course roles; ask your department office or registrar if one is missing.
      </Notice>
    );
  }

  const both = teaching.length > 0 && taking.length > 0;
  const showing: View = both ? view : teaching.length > 0 ? 'teaching' : 'mine';
  const offerings: Offering[] = showing === 'teaching' ? teaching : taking;
  const now = termOf(new Date());
  const chosen = offerings.find((o) => offeringKey(o) === picked) ?? offerings.find((o) => o.term === now) ?? offerings[0];
  const key = offeringKey(chosen);
  const caps = teaching.find((c) => offeringKey(c) === key)?.capabilities ?? [];

  return (
    <>
      {both && (
        <TabList
          label="Assignment views"
          value={view}
          onChange={setView}
          tabs={[
            { id: 'teaching', label: 'Courses you teach' },
            { id: 'mine', label: 'Your assignments' },
          ]}
        />
      )}
      <Row end>
        <Field label="Course and term" hint="Each course in each term your school has given you a role in.">
          {(ids) => (
            <select id={ids.id} aria-describedby={ids.hint} className="input" value={key} onChange={(e) => setPicked(e.target.value)}>
              {offerings.map((o) => (
                <option key={offeringKey(o)} value={offeringKey(o)}>{o.course} · {o.term}</option>
              ))}
            </select>
          )}
        </Field>
      </Row>
      {showing === 'teaching' ? (
        <InstructorAssignments key={key} course={chosen.course} term={chosen.term} caps={caps} writable={writable} />
      ) : (
        <StudentAssignments key={key} course={chosen.course} term={chosen.term} me={me} writable={writable} />
      )}
    </>
  );
}
