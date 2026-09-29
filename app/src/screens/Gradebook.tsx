import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Notice, TabList } from '../components/ui';
import { ModuleGateState } from '../components/ModuleGateState';
import { Field, Row } from '../components/academic/Form';
import { InstructorBook } from '../components/gradebook/InstructorBook';
import { StudentGrades } from '../components/gradebook/StudentGrades';
import { useModuleGate } from '../lib/modulegate';
import { loadMyCapabilities, type Grant } from '../lib/capabilities';
import { TERM, authoredCourses, gradedCourses, termOf } from '../lib/gradebook/client';

/**
 * The gradebook of record: an instructor's official grades for a course, and
 * a student's own released ones.
 *
 * `lib/gradebook/` and `20260929310000_gradebook.sql` built it — weighted
 * categories, append-only grade versions, moderation by a second person,
 * release, regrades, the registrar's export and passback — and this is the
 * screen that drives it. It is kept apart from `screens/Grades.tsx` on
 * purpose: that tab is a student's own arithmetic over numbers they typed,
 * and nothing it says is a record. The two link to each other.
 *
 * It sits behind `writeback.lms_grade_passback`, read the way the database
 * reads it (`lib/modulegate.ts`). Off at every school today, so the screen
 * says so in one sentence and stops. Who sees which half comes from the
 * caller's own course-scope grants (`my_capabilities`): authors of a course's
 * grades get the instructor view, students holding `grades:receive` get
 * their own, and somebody holding both on different courses gets both.
 */

export const BLURB = 'Your course’s official grades: set the scheme, enter and release scores, and answer regrade requests — or read your own released grades.';

const OFF =
  'Your school has not turned on the gradebook in Semester, so grades are still entered and released in your school’s own system — your own grade arithmetic on the Grades tab is unaffected.';

const FLAG = 'writeback.lms_grade_passback';

type View = 'teaching' | 'mine';

export function Gradebook() {
  const gate = useModuleGate(FLAG);
  const { dispatch } = useStore();
  if (gate.status !== 'on') {
    return (
      <Page blurb={BLURB}>
        <ModuleGateState gate={gate} what="the gradebook" off={OFF} />
        {gate.status === 'off' && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              dispatch({ type: 'setCoursesTab', tab: 'grades' });
              dispatch({ type: 'go', screen: 'courses' });
            }}
          >
            Work out your own grades
          </button>
        )}
      </Page>
    );
  }
  return (
    <Page blurb={BLURB}>
      <Book school={gate.school} me={gate.userId} />
    </Page>
  );
}

function Book({ school, me }: { school: string; me: string }) {
  const { dispatch } = useStore();
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);
  const [reads, setReads] = useState(0);
  const [view, setView] = useState<View>('teaching');
  const [course, setCourse] = useState('');
  const [term, setTerm] = useState(() => termOf(new Date()));
  const [termField, setTermField] = useState(term);

  useEffect(() => {
    let live = true;
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    return () => { live = false; };
  }, [reads]);

  if (grants === 'error') {
    return (
      <>
        <Notice alert>Could not read which courses you teach or take. Nothing has changed. Try again in a moment.</Notice>
        <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>
          Try again
        </button>
      </>
    );
  }
  if (grants === null) return <p role="status">Reading which courses you teach and take…</p>;

  const teaching = authoredCourses(grants, school);
  const taking = gradedCourses(grants, school);
  if (teaching.length === 0 && taking.length === 0) {
    return (
      <>
        <Notice>
          Your account is not an instructor or a student on any course in your school’s gradebook, so there is nothing to show.
          Your school assigns course roles; ask your department office or registrar if one is missing.
        </Notice>
        <button
          type="button"
          className="btn"
          onClick={() => {
            dispatch({ type: 'setCoursesTab', tab: 'grades' });
            dispatch({ type: 'go', screen: 'courses' });
          }}
        >
          Work out your own grades
        </button>
      </>
    );
  }

  const both = teaching.length > 0 && taking.length > 0;
  const showing: View = both ? view : teaching.length > 0 ? 'teaching' : 'mine';
  const courses = showing === 'teaching' ? teaching.map((c) => c.course) : taking;
  const chosen = courses.includes(course) ? course : courses[0];
  const caps = teaching.find((c) => c.course === chosen)?.capabilities ?? [];

  return (
    <>
      {both && (
        <TabList
          label="Gradebook views"
          value={view}
          onChange={setView}
          tabs={[
            { id: 'teaching', label: 'Courses you teach' },
            { id: 'mine', label: 'Your grades' },
          ]}
        />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const next = termField.trim().toUpperCase();
          if (TERM.test(next)) setTerm(next);
        }}
      >
        <Row end>
          <Field label="Course">
            {(ids) => (
              <select id={ids.id} aria-describedby={ids.hint} className="input" value={chosen} onChange={(e) => setCourse(e.target.value)}>
                {courses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Term" hint="As 2026FA.">
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.hint} className="input" value={termField} onChange={(e) => setTermField(e.target.value)} pattern="[0-9]{4}(FA|SP|SU|fa|sp|su)" />
            )}
          </Field>
          <button type="submit" className="btn" disabled={termField.trim().toUpperCase() === term}>
            Show this term
          </button>
        </Row>
      </form>
      {showing === 'teaching' ? (
        <InstructorBook key={`${chosen}/${term}`} course={chosen} term={term} caps={caps} me={me} />
      ) : (
        <StudentGrades key={`${chosen}/${term}`} course={chosen} term={term} me={me} />
      )}
    </>
  );
}
