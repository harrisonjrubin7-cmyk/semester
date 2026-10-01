import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { loadMyCapabilities, type Grant } from '../../lib/capabilities';
import { moduleModes, resolveModuleMode, SOURCE_TEXT, type ModuleModeRow } from '../../lib/modulemode';
import { assignmentOfferings, loadTimezone, offeringKey } from '../../lib/assignments/client';
import { termOf } from '../../lib/gradebook/client';
import { Notice, TabList } from '../ui';
import { Field, Row } from '../academic/Form';
import { InstructorAssignments } from './InstructorAssignments';
import { StudentAssignments } from './StudentAssignments';


type View = 'teaching' | 'mine';

/**
 * Assignments, for whoever the database says teaches or takes a course in
 * this school's Core. It says first what it can say plainly: in Connect the
 * school's own learning system holds assignments, and Semester shows nothing
 * to hand in. Only when the school has switched `lms_assignments` to Core does
 * it list courses from the person's own grants (a term is offered only where
 * they hold one) and show the instructor's or the student's half.
 */
export function AssignmentsHome() {
  const { school, account } = useStore();
  const me = account?.id ?? '';
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null | undefined>(undefined);
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);
  const [zone, setZone] = useState('UTC');
  const [view, setView] = useState<View>('teaching');
  const [picked, setPicked] = useState('');

  useEffect(() => {
    let live = true;
    void moduleModes(school.id).then((r) => { if (live) setRows(r); });
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    void loadTimezone(school.id).then((z) => { if (live) setZone(z); });
    return () => { live = false; };
  }, [school.id]);

  if (!me || !school.id) {
    return <Notice>Sign in with your school account to see assignments. They are your school’s records, so Semester needs to know who you are first.</Notice>;
  }
  if (rows === undefined || grants === null) return <p role="status">Checking whether your school runs assignments in Semester…</p>;

  const mode = resolveModuleMode('lms_assignments', rows);
  if (mode.mode !== 'core') {
    return (
      <Notice>
        Your school’s own learning system holds assignments, so there is nothing to hand in here. Semester shows them here only when your
        school switches assignments to Core. {SOURCE_TEXT[mode.source]}.
      </Notice>
    );
  }
  if (grants === 'error') return <Notice alert>Could not read which courses you teach or take. Nothing has changed. Try again in a moment.</Notice>;

  const { teaching, taking } = assignmentOfferings(grants, school.id);
  if (teaching.length === 0 && taking.length === 0) {
    return <Notice>Your account is not an instructor or a student on any course with assignments. Your school assigns course roles; ask your department office if one is missing.</Notice>;
  }
  const both = teaching.length > 0 && taking.length > 0;
  const showing: View = both ? view : teaching.length > 0 ? 'teaching' : 'mine';
  const offerings = showing === 'teaching' ? teaching : taking;
  const now = termOf(new Date());
  const chosen = offerings.find((o) => offeringKey(o) === picked) ?? offerings.find((o) => o.term === now) ?? offerings[0];
  const key = offeringKey(chosen);

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
        <InstructorAssignments key={key} school={school.id} course={chosen.course} term={chosen.term} timeZone={zone} />
      ) : (
        <StudentAssignments key={key} school={school.id} course={chosen.course} term={chosen.term} me={me} timeZone={zone} />
      )}
    </>
  );
}
