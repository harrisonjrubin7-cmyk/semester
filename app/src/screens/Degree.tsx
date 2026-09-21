/**
 * The four-year view.
 *
 * The app is called Semester and it ends in December. This is the part that
 * does not: what is left of a major, what a course is counting towards, and
 * where the credit hours stand.
 *
 * ## It ships no requirements and never will
 *
 * Requirements are specific to a university, a college, a catalogue year and a
 * declaration date, and they change. A student reading a confidently wrong
 * list would find out in their final year, when nothing can be done about it.
 * So this screen holds *your* requirements, copied from your own audit, and
 * does the arithmetic — which is the tedious part and the part a person gets
 * wrong at midnight with a PDF open.
 *
 * The sentence saying so is on the screen rather than in a help page, because
 * the one thing that must not happen is somebody mistaking this for the
 * registrar's own audit.
 */

import { useState } from 'react';
import { DIMMED_ROW, secondLine } from '../lib/dim';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, PickChips, SectionLabel, Segmented } from '../components/ui';
import {
  countingIn,
  forProgramme,
  gpa,
  gpaLine,
  isCommon,
  hours,
  progressLine,
  programmes,
  readAccepts,
  rollup,
  rollupLine,
  spare,
  type Requirement,
  type Taken,
} from '../lib/degree';
import { Folding } from '../components/Fold';
import {
  fixFor,
  missingLine,
  moveLine,
  moves,
  sittings,
  systemsFor,
  termGpa,
  termLine,
  type TermInput,
} from '../lib/termgpa';

export function Degree() {
  const { state } = useStore();
  const [tab, setTab] = useState<'left' | 'taken' | 'rules'>('left');

  /*
   * The transcript, which is the one list here that gets long.
   *
   * Four years of courses is the whole point of the tab, and "did I already
   * take a stats course" is the question people come to it with. What is
   * left and Requirements are both short by construction — a degree has a
   * dozen requirements, not a hundred — so neither declares an adapter.
   */
  return (
    <Page>
      <>
      <Blueprint style={{ padding: '14px 15px' }}>
        <div className="kicker">Your arithmetic, not the registrar’s</div>
        <div
          style={{
            marginTop: 'var(--sp-3)',
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            lineHeight: 1.55,
            textWrap: 'pretty',
          }}
        >
          This app ships no degree requirements and never will — they differ by university, by
          college and by catalogue year, and a wrong one is found out in a final year. Put in
          what your own audit says and everything below is worked out from it. Check anything
          that matters against the real thing.
        </div>
      </Blueprint>

      <Segmented
        options={[
          { id: 'left', label: 'What is left' },
          { id: 'taken', label: `Taken${state.taken.length ? ` (${state.taken.length})` : ''}` },
          { id: 'rules', label: 'Requirements' },
        ]}
        value={tab}
        onChange={setTab}
        style={{ margin: '16px 0' }}
      />

      {tab === 'left' ? <WhatIsLeft /> : null}
      {tab === 'taken' ? <Transcript rows={state.taken} /> : null}
      {tab === 'rules' ? <Rules /> : null}
      </>
    </Page>
  );
}

function WhatIsLeft() {
  const { state } = useStore();
  const list = programmes(state.requirements);
  const g = gpa(state.taken, state.scale);
  const h = hours(state.taken);
  const loose = spare(state.requirements, state.taken);

  if (list.length === 0) {
    return (
      <Folding name="WhatIsLeft">
        <p style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-dim)', lineHeight: 1.55, textWrap: 'pretty' }}>
          Nothing recorded yet. Add your requirements under Requirements — one row per line of
          your audit — and the courses you have taken under Taken.
        </p>
        {/*
          The cumulative figure still shows.

          Requirements are one thing and a transcript is another: somebody who
          has closed out two terms has a real GPA across them, and hiding it
          behind an audit they have not typed yet meant the whole point of
          closing a term was invisible. See `lib/rollover.ts`.
        */}
        {h.done > 0 ? (
          <>
            <SectionLabel style={{ margin: '24px 0 8px' }}>Hours and grades</SectionLabel>
            <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
              {h.done} hours finished
              {h.withThisTerm !== h.done ? `, ${h.withThisTerm} with this term` : ''}. {gpaLine(g, isCommon(state.scale))}
            </div>
          </>
        ) : null}
        <ThisTerm />
      </Folding>
    );
  }

  return (
    <Folding name="WhatIsLeft">
      {list.map((p) => {
        const r = rollup(state.requirements, state.taken, p);
        return (
          <div key={p} style={{ marginBottom: 'calc(20px * var(--density, 1))' }}>
            <Folding name="WhatIsLeft">
            <SectionLabel style={{ margin: '0 0 6px' }}>{p}</SectionLabel>
            <div
              style={{
                fontSize: 'var(--type-base)',
                marginBottom: 'calc(9px * var(--density, 1))',
                textWrap: 'pretty',
              }}
            >
              {rollupLine(r)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(7px * var(--density, 1))' }}>
              {forProgramme(state.requirements, state.taken, p).map((prog) => (
                <div
                  key={prog.req.id}
                  style={{
                    padding: '10px 13px',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--app-line)',
                    opacity: prog.met ? DIMMED_ROW : 1,
                  }}
                >
                  <div style={{ fontSize: 'var(--type-base)', lineHeight: 1.35, textWrap: 'pretty' }}>
                    {prog.req.name || 'Unnamed requirement'}
                  </div>
                  <div
                    style={{
                      fontSize: 'calc(11.5px * var(--text-scale, 1))',
                      color: 'var(--app-dim)',
                      marginTop: 'calc(3px * var(--density, 1))',
                      textWrap: 'pretty',
                    }}
                  >
                    {progressLine(prog)}
                  </div>
                  {/* Which courses it is counting, so a rule against double
                      counting is visible and fixable rather than silently
                      applied or silently ignored. */}
                  {prog.done.length + prog.doing.length > 0 ? (
                    <div
                      style={{
                        fontSize: 'calc(11.5px * var(--text-scale, 1))',
                        color: 'var(--app-dim)',
                        marginTop: 'var(--sp-2)',
                        textWrap: 'pretty',
                      }}
                    >
                      {[...prog.done.map((c) => c.code), ...prog.doing.map((c) => `${c.code} (now)`)].join(', ')}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            </Folding>
          </div>
        );
      })}

      <SectionLabel style={{ margin: '24px 0 8px' }}>Hours and grades</SectionLabel>
      <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        {h.done} hours finished
        {h.withThisTerm !== h.done ? `, ${h.withThisTerm} with this term` : ''}. {gpaLine(g, isCommon(state.scale))}
      </div>

      <ThisTerm />

      {loose.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '24px 0 8px' }}>Counting towards nothing</SectionLabel>
          {/* Either they really are free electives, or a requirement has not
              been entered yet. Both are worth knowing and the app does not
              guess which. */}
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
            {loose.map((c) => c.code).join(', ')}. Either these are free electives, or a
            requirement they satisfy has not been entered yet.
          </div>
        </>
      ) : null}
    </Folding>
  );
}


/**
 * The term in progress, folded into the record it is going to change.
 *
 * `gpa()` above counts finished courses and skips this term on purpose — a
 * course with no grade has no grade, and putting one on the transcript screen
 * would be a fiction. But the student is *in* a term, and the question they
 * have is what it is about to do to the number above. So it is answered here,
 * as a band, on the screen where the cumulative already lives rather than on a
 * screen of its own: one home per thing.
 *
 * Everything on the page above this line is typed in by hand. Everything below
 * it is computed from the syllabus weights and the scores already entered
 * under Courses → Grades, so nothing here is a second place to maintain.
 */
function ThisTerm() {
  const { state, dispatch, catalog, school } = useStore();

  const input: TermInput = {
    courses: catalog.courses,
    grades: state.grades,
    pieces: state.pieces,
    drops: state.drops,
    attendance: state.attendance,
    attendPolicy: state.attendPolicy,
    gradeSystems: state.gradeSystems,
    school,
  };

  const finished = gpa(state.taken, state.scale);
  const term = termGpa(
    sittings(input),
    finished ? { points: finished.points, hours: finished.hours } : null,
  );
  if (catalog.courses.length === 0) return null;

  const steps = moves(term, systemsFor(input)).slice(0, 3);
  const left = term.courses.filter((c) => c.missing !== '');

  return (
    <Folding name="ThisTerm">
      <SectionLabel style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-4)' }}>
        This term, projected
      </SectionLabel>
      <div
        style={{
          fontSize: 'var(--type-base)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {termLine(term)}
      </div>

      {term.cumulative ? (
        <div
          style={{
            marginTop: 'var(--sp-4)',
            fontSize: 'var(--type-base)',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          {term.cumulative.before.toFixed(3)} now, and{' '}
          {term.cumulative.after.low.toFixed(3)} to {term.cumulative.after.high.toFixed(3)} once
          this term is in — across {term.cumulative.hours} hours.
        </div>
      ) : null}

      {term.counted.length > 0 ? (
        <div style={{ marginTop: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {term.counted.map((c) => (
            <div
              key={c.courseId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 'var(--sp-5)',
                fontSize: 'var(--type-base)',
                lineHeight: 'var(--leading-relaxed)',
              }}
            >
              <span>
                {c.code}
                <span style={{ color: 'var(--app-dim)' }}> · {c.hours} hrs</span>
              </span>
              {/* The letter band, not one letter: the middle alone would be
                  the same over-confident number this whole file avoids. */}
              <span style={secondLine()}>
                {c.band!.low.letter === c.band!.high.letter
                  ? c.band!.mid.letter
                  : `${c.band!.low.letter} to ${c.band!.high.letter}`}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {steps.length > 0 ? (
        <>
          <SectionLabel style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-4)' }}>
            What would move it
          </SectionLabel>
          <div
            style={{
              fontSize: 'var(--type-xs)',
              color: 'var(--app-dim)',
              marginBottom: 'var(--sp-4)',
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
            }}
          >
            One grade step in each course, by what the step is worth to the term. A step out of
            reach is shown as out of reach rather than left off — knowing a grade has gone is
            what stops the hours going after it.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {steps.map((m) => (
              <div
                key={m.courseId}
                style={{
                  fontSize: 'var(--type-base)',
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                  ...secondLine(m.reach !== 'unreachable'),
                }}
              >
                {moveLine(m)}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {left.length > 0 ? (
        <div style={{ marginTop: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {/* Named one at a time with the fix, rather than "3 courses were
              excluded" — a GPA quietly computed over some of your courses is
              worse than no GPA.

              One row each rather than one paragraph, because the fix is now a
              tap. The sentence has always said where to go; saying it is not
              the same as going there, and a student reading "Edit the course
              to add them" on this screen had to work out for themselves that
              credit hours live under Edit the course and grade points under
              Grades. `fixFor` decides which, and `ungraded` gets no button
              because the only fix for it is sitting the assessment. */}
          {left.map((c) => {
            const where = fixFor(c);
            return (
              <div
                key={c.courseId}
                style={{
                  fontSize: 'var(--type-xs)',
                  color: 'var(--app-dim)',
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                }}
              >
                {missingLine(c)}
                {where && (
                  <button
                    type="button"
                    className="bare tappable"
                    onClick={() => {
                      /*
                       * The course first, then the screen.
                       *
                       * `EditCourse` reads `state.courseId`, which `go` does
                       * not set — `go`'s own `courseId` sets `guideId`, which
                       * is the study selection and a different thing.
                       *
                       * Grade points are not a screen: Grades is the third tab
                       * of Courses (`lib/nav.ts` says so, having folded the
                       * destination into it), so the tab is set as well or the
                       * tap lands on the course list with nothing to do.
                       */
                      dispatch({ type: 'openCourse', id: c.courseId });
                      if (where === 'edit') {
                        dispatch({ type: 'go', screen: 'edit' });
                      } else {
                        dispatch({ type: 'setCoursesTab', tab: 'grades' });
                        dispatch({ type: 'go', screen: 'courses' });
                      }
                    }}
                    style={{
                      width: 'auto',
                      display: 'block',
                      marginTop: 'var(--sp-3)',
                      paddingBlock: 6,
                      paddingInline: 10,
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--app-line)',
                      fontSize: 'var(--type-xs)',
                      fontFamily: 'var(--font-heading)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--app-fg)',
                    }}
                  >
                    {where === 'edit' ? `Add hours for ${c.code}` : `Price the scale for ${c.code}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </Folding>
  );
}

function Transcript({ rows }: { rows?: Taken[] }) {
  const { state, dispatch } = useStore();
  // Filtered when the box has something in it. `state.taken` stays the
  // source for the empty state, so filtering to nothing does not read as
  // "you have taken no courses".
  const taken = rows ?? state.taken;
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [term, setTerm] = useState('');
  const [creditHours, setCreditHours] = useState('3');
  const [grade, setGrade] = useState('');
  const [current, setCurrent] = useState(false);

  const add = () => {
    if (!code.trim()) return;
    dispatch({
      type: 'addTaken',
      patch: { code, title, term, hours: Number(creditHours) || 0, grade, current },
    });
    setCode('');
    setTitle('');
    setGrade('');
  };

  return (
    <Folding name="Transcript">
      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ECON 1020"
          aria-label="Course code"
          style={{ width: 130, height: 42 }}
        />
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — optional"
          aria-label="Course title"
          style={{ flex: 1, height: 42 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <input
          className="input"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Fall 2026"
          aria-label="Term"
          style={{ width: 120, height: 40 }}
        />
        <input
          className="input"
          inputMode="numeric"
          value={creditHours}
          onChange={(e) => setCreditHours(e.target.value)}
          aria-label="Credit hours"
          style={{ width: 64, height: 40, textAlign: 'center' }}
        />
        <input
          className="input"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="A-"
          aria-label="Grade"
          disabled={current}
          style={{ width: 64, height: 40, textAlign: 'center' }}
        />
        <button
          type="button"
          className="bare tappable"
          aria-pressed={current}
          onClick={() => setCurrent(!current)}
          style={{
            width: 'auto',
            padding: '9px 13px',
            borderRadius: 'var(--r-sm)',
            border: `1px solid ${current ? 'var(--app-accent)' : 'var(--app-line)'}`,
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
          }}
        >
          Taking it now
        </button>
      </div>
      {/* Off until there is a code to record. `add` opens with
          `if (!code.trim()) return`, which left this pressable and silent —
          the same `disabled` Mine and Maps already put on their own. */}
      <ActionButton
        onClick={add}
        disabled={!code.trim()}
        title={code.trim() ? undefined : 'Enter the course code first'}
        spacing="0.09em"
        style={{ marginTop: 'var(--sp-6)' }}
      >
        Add the course
      </ActionButton>

      {state.taken.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '24px 0 8px' }}>Recorded</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(7px * var(--density, 1))' }}>
            {taken.map((c) => (
              <TakenRow key={c.id} course={c} />
            ))}
          </div>
        </>
      ) : null}
    </Folding>
  );
}

function Rules() {
  const { state, dispatch } = useStore();
  const [programme, setProgramme] = useState('');
  const [name, setName] = useState('');
  const [count, setCount] = useState('1');
  const [need, setNeed] = useState<'courses' | 'hours'>('courses');
  const [list, setList] = useState('');

  const add = () => {
    if (!programme.trim() || !name.trim()) return;
    dispatch({
      type: 'addRequirement',
      patch: {
        programme,
        name,
        need,
        count: Number(count) || 1,
        accepts: readAccepts(list),
      },
    });
    setName('');
    setList('');
  };

  return (
    <Folding name="Rules">
      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        <input
          className="input"
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
          placeholder="Economics major"
          aria-label="Which programme"
          style={{ flex: 1, height: 42 }}
        />
      </div>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Intermediate theory"
        aria-label="What the requirement is called"
        style={{ width: '100%', height: 42, marginTop: 'var(--sp-4)' }}
      />
      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          inputMode="numeric"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          aria-label="How many"
          style={{ width: 64, height: 40, textAlign: 'center' }}
        />
        <PickChips options={['courses', 'hours'] as const} value={need} onChange={setNeed} />
      </div>
      <textarea
        className="input"
        value={list}
        onChange={(e) => setList(e.target.value)}
        placeholder="ECON 3010, ECON 3012 — or just ECON for any course in it. Blank means anything."
        aria-label="Which courses satisfy it"
        style={{
          width: '100%',
          minHeight: 64,
          marginTop: 'var(--sp-4)',
          resize: 'vertical',
          fontSize: 'var(--type-base)',
          lineHeight: 'var(--leading-relaxed)',
        }}
      />
      {/* And the same, for the two this one guards on. */}
      <ActionButton
        onClick={add}
        disabled={!programme.trim() || !name.trim()}
        title={
          programme.trim() && name.trim() ? undefined : 'Name the programme and the requirement first'
        }
        spacing="0.09em"
        style={{ marginTop: 'var(--sp-5)' }}
      >
        Add the requirement
      </ActionButton>

      {state.requirements.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '24px 0 8px' }}>Recorded</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(7px * var(--density, 1))' }}>
            {state.requirements.map((r) => (
              <RequirementRow key={r.id} requirement={r} />
            ))}
          </div>
        </>
      ) : null}
    </Folding>
  );
}

/**
 * One course on the transcript, and the way to correct it.
 *
 * Correcting one was not possible at all. `addTaken` and `dropTaken` were the
 * whole of it, and `patchTaken` sat in the reducer with nothing dispatching
 * it — so a mistyped grade, a term entered as "Fall 26", or a course whose
 * hours turned out to be four meant deleting the row and typing all six fields
 * again. On the screen whose entire job is an audit you keep by hand, and
 * whose GPA is arithmetic over exactly these numbers.
 *
 * Editing behind a press rather than always on, and saved explicitly, for the
 * reason `Mine.tsx`'s `AppointmentRow` gives at length: a list that is also a
 * page of live inputs is a page where a stray tap lands in a field. The draft
 * is re-seeded when the editor opens rather than kept in sync, for the same
 * reason it is there — a draft that follows the thing while you are typing in
 * it is a draft that fights you.
 *
 * Remove stays on the row rather than moving inside the editor. On an
 * appointment it moved because it had been a two-letter button beside Join;
 * here it is already a worded control at the end of a row, which is not the
 * accident that rule exists to prevent.
 */
function TakenRow({ course: c }: { course: Taken }) {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(c.code);
  const [title, setTitle] = useState(c.title);
  const [term, setTerm] = useState(c.term);
  const [creditHours, setCreditHours] = useState(String(c.hours));
  const [grade, setGrade] = useState(c.grade);
  const [current, setCurrent] = useState(c.current);

  const save = () => {
    if (!code.trim()) return;
    dispatch({
      type: 'patchTaken',
      id: c.id,
      patch: {
        code: code.trim(),
        title: title.trim(),
        term: term.trim(),
        hours: Number(creditHours) || 0,
        // A course in progress has no grade yet, and leaving a stale letter on
        // one would put it back into the GPA the moment it was ticked.
        grade: current ? '' : grade.trim(),
        current,
      },
    });
    setEditing(false);
  };

  const open = () => {
    setCode(c.code);
    setTitle(c.title);
    setTerm(c.term);
    setCreditHours(String(c.hours));
    setGrade(c.grade);
    setCurrent(c.current);
    setEditing(true);
  };

  if (editing) {
    return (
      <Blueprint style={{ padding: 'var(--sp-6)', background: 'var(--app-panel)' }}>
        <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            aria-label="Course code"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            style={{ width: 130, height: 40 }}
          />
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            placeholder="Title — optional"
            aria-label="Course title"
            style={{ flex: 1, minWidth: 0, height: 40 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <input
            className="input"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Fall 2026"
            aria-label="Term"
            style={{ width: 120, height: 40 }}
          />
          <input
            className="input"
            inputMode="numeric"
            value={creditHours}
            onChange={(e) => setCreditHours(e.target.value)}
            aria-label="Credit hours"
            style={{ width: 64, height: 40, textAlign: 'center' }}
          />
          <input
            className="input"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="A-"
            aria-label="Grade"
            disabled={current}
            style={{ width: 64, height: 40, textAlign: 'center' }}
          />
          <button
            type="button"
            className="bare tappable"
            aria-pressed={current}
            onClick={() => setCurrent(!current)}
            style={{
              width: 'auto',
              paddingBlock: 'var(--sp-4)',
              paddingInline: 'var(--sp-6)',
              borderRadius: 'var(--r-sm)',
              border: `1px solid ${current ? 'var(--app-accent)' : 'var(--app-line)'}`,
              fontSize: 'var(--type-xs)',
            }}
          >
            Taking it now
          </button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)', flexWrap: 'wrap' }}>
          <ActionButton tone="primary" onClick={save} disabled={!code.trim()}>
            Save
          </ActionButton>
          <ActionButton onClick={() => setEditing(false)}>Cancel</ActionButton>
        </div>
      </Blueprint>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-5)',
        alignItems: 'baseline',
        padding: '10px 13px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
      }}
    >
      <button
        type="button"
        className="bare tappable"
        onClick={open}
        aria-label={`Edit ${c.code}`}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: 0 }}
      >
        <span style={{ display: 'block', fontSize: 'var(--type-base)' }}>
          {c.code} {c.title ? `· ${c.title}` : ''}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            color: 'var(--app-dim)',
            marginTop: 'var(--sp-1)',
            textWrap: 'pretty',
          }}
        >
          {[c.term, `${c.hours} hrs`, c.current ? 'in progress' : c.grade]
            .filter(Boolean)
            .join(' · ')}
          {countingIn(state.requirements, c).length > 0
            ? ` · counts in ${[
                ...new Set(countingIn(state.requirements, c).map((r) => r.programme)),
              ].join(', ')}`
            : ''}
        </span>
      </button>
      <button
        type="button"
        className="bare"
        onClick={() => dispatch({ type: 'dropTaken', id: c.id })}
        aria-label={`Remove ${c.code}`}
        style={{ width: 'auto', fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}
      >
        Remove
      </button>
    </div>
  );
}

/**
 * One requirement, and the way to correct it.
 *
 * Same omission and same fix as `TakenRow` above — `addRequirement` and
 * `dropRequirement` shipped, `patchRequirement` sat unused — and it bites
 * harder here, because the list a requirement accepts is the field most likely
 * to be wrong and the most tedious to retype. "ECON 3010, ECON 3012, ECON
 * 3150" entered once and then found to be missing a fourth course meant
 * writing all four again along with the programme, the name and the count.
 *
 * `readAccepts` parses the list on the way in, the same call the form above
 * makes, so a row edited here and a row added there cannot end up holding two
 * different shapes of the same field.
 */
function RequirementRow({ requirement: r }: { requirement: Requirement }) {
  const { dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const [programme, setProgramme] = useState(r.programme);
  const [name, setName] = useState(r.name);
  const [count, setCount] = useState(String(r.count));
  const [need, setNeed] = useState<'courses' | 'hours'>(r.need);
  const [list, setList] = useState(r.accepts.join(', '));

  const save = () => {
    if (!programme.trim() || !name.trim()) return;
    dispatch({
      type: 'patchRequirement',
      id: r.id,
      patch: {
        programme: programme.trim(),
        name: name.trim(),
        need,
        count: Number(count) || 1,
        accepts: readAccepts(list),
      },
    });
    setEditing(false);
  };

  const open = () => {
    setProgramme(r.programme);
    setName(r.name);
    setCount(String(r.count));
    setNeed(r.need);
    setList(r.accepts.join(', '));
    setEditing(true);
  };

  if (editing) {
    return (
      <Blueprint style={{ padding: 'var(--sp-6)', background: 'var(--app-panel)' }}>
        <input
          className="input"
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
          }}
          placeholder="Economics major"
          aria-label="Which programme"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          style={{ width: '100%', height: 40 }}
        />
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
          }}
          placeholder="Intermediate theory"
          aria-label="What the requirement is called"
          style={{ width: '100%', height: 40, marginTop: 'var(--sp-4)' }}
        />
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input"
            inputMode="numeric"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            aria-label="How many"
            style={{ width: 64, height: 40, textAlign: 'center' }}
          />
          <PickChips options={['courses', 'hours'] as const} value={need} onChange={setNeed} />
        </div>
        <textarea
          className="input"
          value={list}
          onChange={(e) => setList(e.target.value)}
          placeholder="ECON 3010, ECON 3012 — or just ECON for any course in it. Blank means anything."
          aria-label="Which courses satisfy it"
          style={{
            width: '100%',
            minHeight: 64,
            marginTop: 'var(--sp-4)',
            resize: 'vertical',
            fontSize: 'var(--type-base)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        />
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)', flexWrap: 'wrap' }}>
          <ActionButton tone="primary" onClick={save} disabled={!programme.trim() || !name.trim()}>
            Save
          </ActionButton>
          <ActionButton onClick={() => setEditing(false)}>Cancel</ActionButton>
        </div>
      </Blueprint>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-5)',
        alignItems: 'baseline',
        padding: '10px 13px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
      }}
    >
      <button
        type="button"
        className="bare tappable"
        onClick={open}
        aria-label={`Edit ${r.name}`}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: 0 }}
      >
        <span style={{ display: 'block', fontSize: 'var(--type-base)', textWrap: 'pretty' }}>
          {r.programme} · {r.name}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            color: 'var(--app-dim)',
            marginTop: 'var(--sp-1)',
            textWrap: 'pretty',
          }}
        >
          {r.count} {r.need} · {r.accepts.length > 0 ? r.accepts.join(', ') : 'anything'}
        </span>
      </button>
      <button
        type="button"
        className="bare"
        onClick={() => dispatch({ type: 'dropRequirement', id: r.id })}
        aria-label={`Remove ${r.name}`}
        style={{ width: 'auto', fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}
      >
        Remove
      </button>
    </div>
  );
}
