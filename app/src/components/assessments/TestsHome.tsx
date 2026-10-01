import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { loadMyCapabilities, type Grant } from '../../lib/capabilities';
import { moduleModes, resolveModuleMode, SOURCE_TEXT, type ModuleModeRow } from '../../lib/modulemode';
import { termOf } from '../../lib/gradebook/client';
import { offeringKey, testOfferings } from '../../lib/assessments/client';
import { Notice, TabList } from '../ui';
import { Field, Row } from '../academic/Form';
import { InstructorTests } from './InstructorTests';
import { StudentTests } from './StudentTests';

type View = 'writing' | 'taking';

/**
 * Tests, for whoever the database says writes or takes them in a school that
 * runs `lms_assessments` in Core. In Connect it says the school's own system
 * holds tests and stops. A term is offered only where the person holds a grant
 * for it.
 */
export function TestsHome() {
  const { school, account } = useStore();
  const me = account?.id ?? '';
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null | undefined>(undefined);
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);
  const [view, setView] = useState<View>('writing');
  const [picked, setPicked] = useState('');

  useEffect(() => {
    let live = true;
    void moduleModes(school.id).then((r) => { if (live) setRows(r); });
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    return () => { live = false; };
  }, [school.id]);

  if (!me || !school.id) return <Notice>Sign in with your school account to see tests. They are your school’s records, so Semester needs to know who you are first.</Notice>;
  if (rows === undefined || grants === null) return <p role="status">Checking whether your school runs tests in Semester…</p>;
  const mode = resolveModuleMode('lms_assessments', rows);
  if (mode.mode !== 'core') {
    return <Notice>Your school’s own learning system holds tests, so there is nothing to take here. Semester shows them here only when your school switches tests to Core. {SOURCE_TEXT[mode.source]}.</Notice>;
  }
  if (grants === 'error') return <Notice alert>Could not read which courses you teach or take. Nothing has changed. Try again in a moment.</Notice>;
  const { writing, taking } = testOfferings(grants, school.id);
  if (writing.length === 0 && taking.length === 0) return <Notice>Your account is not an instructor or a student on any course with tests. Your school assigns course roles; ask your department office if one is missing.</Notice>;

  const both = writing.length > 0 && taking.length > 0;
  const showing: View = both ? view : writing.length > 0 ? 'writing' : 'taking';
  const offerings = showing === 'writing' ? writing : taking;
  const now = termOf(new Date());
  const chosen = offerings.find((o) => offeringKey(o) === picked) ?? offerings.find((o) => o.term === now) ?? offerings[0];
  const key = offeringKey(chosen);

  return (
    <>
      {both && <TabList label="Test views" value={view} onChange={setView} tabs={[{ id: 'writing', label: 'Courses you teach' }, { id: 'taking', label: 'Your tests' }]} />}
      <Row end>
        <Field label="Course and term" hint="Each course in each term your school has given you a role in.">
          {(ids) => (
            <select id={ids.id} aria-describedby={ids.hint} className="input" value={key} onChange={(e) => setPicked(e.target.value)}>
              {offerings.map((o) => <option key={offeringKey(o)} value={offeringKey(o)}>{o.course} · {o.term}</option>)}
            </select>
          )}
        </Field>
      </Row>
      {showing === 'writing'
        ? <InstructorTests key={key} school={school.id} course={chosen.course} term={chosen.term} />
        : <StudentTests key={key} school={school.id} course={chosen.course} term={chosen.term} />}
    </>
  );
}
