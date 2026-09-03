import { useState } from 'react';
import { useStore } from '../state/store';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { DateRow, SectionLabel, Segmented } from '../components/ui';
import { Grades } from './Grades';
import { appleMapsUrl, directionsUrl, fromRoom, prefersApple } from '../lib/maps';
import { upcomingItems, datedItems } from '../lib/select';
import type { Course } from '../lib/types';

/** The one switcher, so the three views cannot drift apart. */
function CoursesTabs({
  value,
  onChange,
}: {
  value: 'courses' | 'due' | 'grades';
  onChange: (t: 'courses' | 'due' | 'grades') => void;
}) {
  return (
    <Segmented
      options={[
        { id: 'courses', label: 'Courses' },
        { id: 'due', label: 'Coming up' },
        { id: 'grades', label: 'Grades' },
      ]}
      value={value}
      onChange={onChange}
      style={{ marginBottom: 16 }}
    />
  );
}

/**
 * Courses, in the shape Calendar and Mine use.
 *
 * Three views of the same four courses: the courses themselves, everything
 * they are asking of you as one list, and what any of it is worth. The middle
 * one did not exist anywhere — the calendar shows deadlines by date, which
 * answers "what is on the 14th" and not "what is coming", and those are
 * different questions.
 */
export function Courses() {
  const { state, dispatch, now, catalog } = useStore();
  const ahead = upcomingItems(catalog, now);
  if (catalog.empty) return <FirstRun where="in your courses" />;
  const tab = state.coursesTab;

  if (tab === 'grades') {
    return (
      <div style={{ padding: '18px 18px 0' }}>
        <CoursesTabs value={tab} onChange={(t) => dispatch({ type: 'setCoursesTab', tab: t })} />
        <Grades bare />
      </div>
    );
  }

  if (tab === 'due') {
    return (
      <div style={{ padding: 18 }}>
        <CoursesTabs value={tab} onChange={(t) => dispatch({ type: 'setCoursesTab', tab: t })} />
        <div style={{ fontSize: 12.5, opacity: 0.6, lineHeight: 1.5, marginBottom: 4 }}>
          Everything still ahead of you, nearest first, across every course.
        </div>
        {ahead.length === 0 && (
          <div style={{ padding: '22px 0', fontSize: 14, opacity: 0.55 }}>
            Nothing left this semester.
          </div>
        )}
        {ahead.map((i) => (
          <button
            key={i.id}
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'openItem', id: i.id })}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: '13px 0',
              borderBottom: '1px solid var(--app-line)',
              textAlign: 'left',
            }}
          >
            <span className="tag tag-accent" style={{ flex: 'none' }}>
              {catalog.byId[i.c]?.code}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, lineHeight: 1.3 }}>{i.title}</span>
              <span style={{ display: 'block', fontSize: 11, opacity: 0.55, marginTop: 2 }}>
                {i.dueShort} · {i.kind}
                {i.weight ? ` · ${i.weight}` : ''}
              </span>
            </span>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 11,
                opacity: 0.45,
                flex: 'none',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {i.daysAway === 0 ? 'today' : `${i.daysAway}d`}
            </span>
          </button>
        ))}
        <div style={{ height: 22 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CoursesTabs value={tab} onChange={(t) => dispatch({ type: 'setCoursesTab', tab: t })} />
      {catalog.courses.map((c) => {
        const next = ahead.find((i) => i.c === c.id);
        return (
          <Blueprint
            key={c.id}
            onClick={() => dispatch({ type: 'openCourse', id: c.id })}
            style={{ padding: '15px 16px', display: 'block' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div className="chrome-text" style={{ fontSize: 22 }}>
                {c.code}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  opacity: 0.55,
                }}
              >
                {c.meets}
              </div>
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.3, marginTop: 2 }}>{c.name}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{c.prof}</div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginTop: 12,
                paddingTop: 11,
                borderTop: '1px solid var(--app-line)',
              }}
            >
              <span className="tag tag-accent">{next ? next.dueShort : 'Clear'}</span>
              <span
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {next ? next.title : 'Nothing scheduled'}
              </span>
            </div>
          </Blueprint>
        );
      })}

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'go', screen: 'import' })}
        style={{
          height: 46,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 6,
        }}
      >
        + Add a course from a syllabus
      </button>
      <div style={{ height: 12 }} />
    </div>
  );
}

/**
 * The course's shell in Brightspace, one tap away.
 *
 * D2L has an API — Valence — but its keys are issued to the institution, not to
 * a student, so an app a student installs cannot read their grades or their
 * submissions no matter how it asks. What it can do is stop making them hunt
 * for the tab: the deadlines here already carry "Brightspace" as their where,
 * and this makes that a place you can go.
 *
 * The address is remembered per course, so it survives a re-import.
 */
function LmsLink({ course }: { course: Course }) {
  const { state, dispatch } = useStore();
  const key = `lms:${course.id}`;
  const url = state.linkUrls[key] ?? course.lms ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{
              flex: 1,
              height: 42,
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              display: 'grid',
              placeItems: 'center',
              textDecoration: 'none',
            }}
          >
            Open in Brightspace
          </a>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setDraft(url);
            setEditing(!editing);
          }}
          style={{
            flex: url ? 'none' : 1,
            height: 42,
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {editing ? 'Cancel' : url ? 'Edit' : 'Link its Brightspace page'}
        </button>
      </div>

      {editing && (
        <>
          <input
            className="input"
            value={draft}
            placeholder="https://brightspace.vanderbilt.edu/d2l/home/123456"
            onChange={(e) => setDraft(e.target.value)}
            style={{ fontSize: 12.5, marginTop: 9 }}
            aria-label={`${course.code} Brightspace address`}
          />
          <div style={{ fontSize: 11.5, opacity: 0.6, lineHeight: 1.45, marginTop: 7 }}>
            Open the course in Brightspace and copy the address from the bar. Grades and
            submissions need D2L’s Valence API, which only Vanderbilt can issue a key for — so
            this is a link, and the dates come from the calendar feed under Connect.
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const next = draft.trim();
              dispatch({
                type: 'setLinkUrl',
                id: key,
                url: next && !/^https?:\/\//i.test(next) ? `https://${next}` : next,
              });
              setEditing(false);
            }}
            style={{ marginTop: 9, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}
          >
            Save
          </button>
        </>
      )}
    </div>
  );
}

export function CourseDetail() {
  const { state, dispatch, now, catalog } = useStore();
  const course = catalog.byId[state.courseId];
  const items = datedItems(catalog, now).filter((i) => i.c === course.id);

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 15, lineHeight: 1.3 }}>{course.name}</div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 3 }}>
        {course.prof} · {course.email}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
        <span className="tag tag-outline">{course.meets}</span>
        {/* The room is the one detail here you might need to act on, so it is
            a link to directions rather than a label to read and retype. */}
        {course.room ? (
          <a
            href={
              prefersApple()
                ? appleMapsUrl(fromRoom(course.room))
                : directionsUrl(fromRoom(course.room))
            }
            target="_blank"
            rel="noreferrer"
            className="tag tag-neutral"
            style={{ textDecoration: 'none' }}
          >
            {course.room} →
          </a>
        ) : null}
        <span className="tag tag-neutral">{course.credits}</span>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => dispatch({ type: 'openGuide', id: course.id })}
        style={{
          height: 46,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 16,
        }}
      >
        Study this course
      </button>

      <LmsLink course={course} />

      <SectionLabel style={{ margin: '24px 0 6px' }}>How the grade is built</SectionLabel>
      <table className="table">
        <tbody>
          {course.grading.map((g) => (
            <tr key={g.what}>
              <td style={{ fontSize: 13 }}>{g.what}</td>
              <td
                style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 15,
                  width: 74,
                }}
              >
                {g.pct}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionLabel style={{ margin: '24px 0 6px' }}>Everything ahead</SectionLabel>
      {items.map((i) => (
        <DateRow
          key={i.id}
          top={i.mon}
          bottom={String(i.day)}
          title={i.title}
          meta={`${i.kind} · ${i.weight}`}
          onClick={() => dispatch({ type: 'openItem', id: i.id })}
        />
      ))}

      <div
        style={{
          fontSize: 11,
          opacity: 0.45,
          marginTop: 14,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.08em',
        }}
      >
        Imported from {course.source}
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}

export function ItemDetail() {
  const { state, dispatch, now, catalog } = useStore();
  const all = datedItems(catalog, now);
  const item = all.find((i) => i.id === state.itemId) ?? all[0];
  if (!item) return null;
  const done = !!state.done[item.id];

  return (
    <div style={{ padding: 18 }}>
      <Blueprint style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <span className="tag tag-accent">{catalog.byId[item.c].code}</span>
          <span
            style={{
              fontSize: 11,
              opacity: 0.55,
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {item.kind}
          </span>
        </div>
        <div
          className="chrome-text"
          style={{
            fontSize: 27,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            margin: '10px 0 12px',
            textWrap: 'pretty',
          }}
        >
          {item.title}
        </div>
        <div style={{ display: 'flex', borderTop: '1px solid var(--app-line)' }}>
          <div style={{ flex: 1, padding: '11px 0' }}>
            <div className="kicker" style={{ fontSize: 10 }}>
              Due
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{item.dueShort}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{item.dueTime}</div>
          </div>
          <div style={{ width: 1, background: 'var(--app-line)' }} />
          <div style={{ flex: 1, padding: '11px 0 11px 14px' }}>
            <div className="kicker" style={{ fontSize: 10 }}>
              Weight
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{item.weight}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{item.where}</div>
          </div>
        </div>
      </Blueprint>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          marginTop: 18,
          opacity: 0.85,
          textWrap: 'pretty',
        }}
      >
        {item.detail}
      </div>

      <SectionLabel style={{ margin: '22px 0 8px' }}>Straight from the syllabus</SectionLabel>
      <div
        style={{
          borderLeft: '2px solid var(--app-accent)',
          padding: '2px 0 2px 14px',
          fontSize: 13,
          lineHeight: 1.5,
          opacity: 0.75,
          fontStyle: 'italic',
        }}
      >
        {item.quote}
      </div>
      <div
        style={{
          fontSize: 11,
          opacity: 0.45,
          marginTop: 8,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.08em',
        }}
      >
        {item.source}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'toggleDone', id: item.id })}
          style={{ flex: 1, height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          {done ? 'Mark not done' : 'Mark done'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => dispatch({ type: 'openGuide', id: item.c })}
          style={{ height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Study
        </button>
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}
