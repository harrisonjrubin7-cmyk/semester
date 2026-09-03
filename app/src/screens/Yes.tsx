import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, TickBox } from '../components/ui';
import { ChevronRight } from '../components/Icons';
import { byCourse, clock, idFor, meetsLine, readSchedule } from '../lib/yes';
import type { CourseId, CourseModule } from '../lib/types';

const LINKS = [
  {
    id: 'landing',
    name: 'Student Landing',
    // The address these were copied from carried ?studentId=C… and
    // ?commodoreIdToLoad=… — one specific student's number. This app is used
    // by more than one person, and YES resolves the signed-in student from the
    // session, so the parameters are both unsafe to ship and unnecessary.
    url: 'https://landing.app.vanderbilt.edu/landing/student-landing',
    blurb: 'Enrolment, holds, your advisor, the official schedule.',
  },
  {
    id: 'classes',
    name: 'Search Classes',
    url: 'https://more.app.vanderbilt.edu/more/SearchClasses!input.action',
    blurb: 'What is offered, when it meets, what is still open.',
  },
  {
    id: 'yes',
    name: 'YES home',
    url: 'https://yes.vanderbilt.edu',
    blurb: 'Registration, transcripts, everything else.',
  },
];

/**
 * Registration, and the road back from it.
 *
 * The links are the easy half. The useful half is the second section: YES has
 * no API a student can use — its pages are behind single sign-on and no
 * browser will let this app read a tab it does not own, correctly — so the
 * bridge is the clipboard. Select your classes in YES, copy, paste, and the
 * app reads the block into courses with their real meeting times and rooms.
 *
 * What it will not do is invent deadlines. YES knows when your classes meet
 * and nothing whatever about when your essays are due. A course built here
 * arrives with a timetable and an empty deadline list, and says so, until a
 * syllabus fills it in.
 */
export function Yes() {
  const { state, dispatch, catalog } = useStore();
  const [text, setText] = useState('');
  const [take, setTake] = useState<Record<string, boolean>>({});
  const [added, setAdded] = useState('');

  const found = useMemo(() => byCourse(readSchedule(text)), [text]);
  const already = new Set(state.courses.map((c) => c.course.code.replace(/\s+/g, ' ')));

  const create = () => {
    const chosen = found.filter((c) => take[c.code] ?? !already.has(c.code));
    if (chosen.length === 0) return;
    for (const course of chosen) {
      dispatch({ type: 'addCourse', module: moduleFrom(course) });
    }
    setAdded(
      `${chosen.length} course${chosen.length === 1 ? '' : 's'} added with their timetable. ` +
        'Upload each syllabus under Add a course to fill in the deadlines.',
    );
    setText('');
    setTake({});
  };

  return (
    <div style={{ padding: 18 }}>
      <SectionLabel>Go there</SectionLabel>
      {LINKS.map((l) => (
        <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="bare">
          <Blueprint
            style={{
              padding: '14px 15px',
              marginBottom: 9,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15 }}>{l.name}</span>
              <span style={{ display: 'block', fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>
                {l.blurb}
              </span>
            </span>
            <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
          </Blueprint>
        </a>
      ))}
      <div style={{ fontSize: 11.5, opacity: 0.5, lineHeight: 1.45, marginTop: 4 }}>
        These open signed out and YES asks who you are — the app holds no student number, and the
        links carry none, because one student's id in a shared app would be sent by everybody.
      </div>

      <SectionLabel>Bring your schedule back</SectionLabel>
      <div style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.5, marginBottom: 10 }}>
        Open your enrolled classes in YES, select them, copy, and paste here. Nothing is read from
        the page — a browser will not let this app see a tab it does not own, and it should not.
      </div>
      <textarea
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'ECON 1020-01  Principles of Macroeconomics  MWF  9:10am-10:00am  Buttrick 101'}
        style={{ width: '100%', minHeight: 130, resize: 'vertical', lineHeight: 1.5, fontSize: 13 }}
      />

      {text.trim() && found.length === 0 && (
        <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 10, lineHeight: 1.45 }}>
          Nothing in there looks like a class. A line has to carry a course number, the days it
          meets and a time — anything else is dropped rather than guessed at.
        </div>
      )}

      {found.length > 0 && (
        <>
          <SectionLabel>Found {found.length}</SectionLabel>
          {found.map((c) => {
            const on = take[c.code] ?? !already.has(c.code);
            return (
              <div
                key={c.code}
                style={{
                  display: 'flex',
                  gap: 11,
                  alignItems: 'flex-start',
                  borderBottom: '1px solid var(--app-line)',
                }}
              >
                <button
                  type="button"
                  className="bare tappable"
                  onClick={() => setTake((t) => ({ ...t, [c.code]: !on }))}
                  aria-label={`${on ? 'Leave out' : 'Add'} ${c.code}`}
                  style={{ flex: 'none', width: 30, padding: '13px 2px 13px 0' }}
                >
                  <TickBox on={on} />
                </button>
                <div style={{ flex: 1, minWidth: 0, padding: '12px 0' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 15 }}>{c.code}</span>
                    {already.has(c.code) && (
                      <span className="tag tag-neutral" style={{ flex: 'none' }}>
                        already here
                      </span>
                    )}
                  </div>
                  {c.title ? (
                    <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 2 }}>{c.title}</div>
                  ) : null}
                  {c.lines.map((line) => (
                    <div
                      key={`${line.at}-${line.days.join('')}`}
                      style={{ fontSize: 11.5, opacity: 0.55, marginTop: 3 }}
                    >
                      {meetsLine(line)}
                      {line.room ? ` · ${line.room}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={create}
            style={{
              height: 46,
              marginTop: 14,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Add them to the semester
          </button>
          <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 9, lineHeight: 1.45 }}>
            They arrive with their timetable and no deadlines. YES knows when your classes meet and
            nothing about when your essays are due — that comes from the syllabus.
          </div>
        </>
      )}

      {added ? (
        <div style={{ fontSize: 13, marginTop: 14, lineHeight: 1.5, opacity: 0.85 }}>{added}</div>
      ) : null}

      <SectionLabel>The other way</SectionLabel>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'go', screen: 'export' })}
        style={{ height: 44 }}
      >
        Take this semester out as a calendar
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'go', screen: 'import' })}
        style={{ height: 44, marginTop: 8 }}
      >
        Add a course from its syllabus
      </button>
      {catalog.courses.length > 0 && (
        <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 10, lineHeight: 1.45 }}>
          {catalog.courses.length} course{catalog.courses.length === 1 ? '' : 's'} loaded.
        </div>
      )}
      <div style={{ height: 26 }} />
    </div>
  );
}

/**
 * A course from a timetable line.
 *
 * Every field the app cannot know is left empty rather than filled with a
 * plausible-looking placeholder: no professor, no email, no grading breakdown,
 * no deadlines. An empty field asks to be filled; an invented one gets
 * believed, and a made-up grade weighting is the kind of thing somebody plans
 * a semester around.
 */
function moduleFrom(found: { code: string; title: string; lines: ReturnType<typeof readSchedule> }): CourseModule {
  const first = found.lines[0];
  return {
    course: {
      id: idFor(found.code) as CourseId,
      code: found.code,
      name: found.title || found.code,
      prof: '',
      email: '',
      meets: found.lines.map(meetsLine).join(' · '),
      room: first?.room ?? '',
      credits: '',
      source: 'Your YES schedule',
      grading: [],
    },
    items: [],
    schedule: found.lines.map((line) => ({
      days: line.days,
      at: line.at,
      time: clock(line.at),
      title: found.title || found.code,
      meta: line.room || '',
    })),
    guide: {
      code: found.code,
      name: found.title || found.code,
      blurb: 'Added from your YES schedule. Upload the syllabus to fill this in.',
      source: 'Your YES schedule',
      mastery: 0,
      audio: false,
      units: [],
      terms: [],
    },
    // No cards yet, so no honest time-box for a study session, and nothing to
    // label a list of exam frames that does not exist.
    planMinutes: '—',
    frameLabel: `${found.code} · from your schedule`,
  };
}
