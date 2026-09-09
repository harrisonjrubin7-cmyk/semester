import { useState } from 'react';
import { useStore } from '../state/store';
import { nameFor, renamed } from '../lib/yours';
import { HowLong } from '../components/HowLong';
import { Timer } from '../components/Timer';
import { ShareCourse } from '../components/ShareCourse';
import { Attendance } from '../components/Attendance';
import { DropBy } from '../components/DropBy';
import { Page } from '../components/Page';
import { LightTile } from '../components/soft/Soft';
import { useSoft } from '../components/shell/useShell';
import { standing } from '../lib/grades';
import { TermSwitch } from '../components/TermSwitch';
import { OfficeHours } from '../components/OfficeHours';
import { FirstRun } from './FirstRun';
import { ReadingProgress } from '../components/ReadingProgress';
import { CameBack } from '../components/CameBack';
import { BreakItUp } from '../components/BreakItUp';
import { AskForTime } from '../components/AskForTime';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, SectionLabel, Segmented } from '../components/ui';
import { longLabel } from '../lib/date';
import { appleMapsUrl, directionsUrl, fromRoom, prefersApple, type Destination } from '../lib/maps';
import { upcomingItems, datedItems } from '../lib/select';
import { DeadlineRow } from '../components/DeadlineRow';
import { badge, overdueLine, split, standingOf } from '../lib/standing';
import { isUnderway, openLine, underway, underwayLine } from '../lib/underway';
import type { Course } from '../lib/types';
import { CourseTag } from '../components/CourseTag';
import { Folding } from '../components/Fold';

/** The one switcher, so the three views cannot drift apart. */
function CoursesTabs({
  value,
  onChange,
}: {
  value: 'courses' | 'due';
  onChange: (t: 'courses' | 'due') => void;
}) {
  return (
    <Segmented
      options={[
        { id: 'courses', label: 'Courses' },
        { id: 'due', label: 'Coming up' },
      ]}
      value={value}
      onChange={onChange}
      style={{ marginBottom: 'var(--sp-7)' }}
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
  const { state, dispatch, now, catalog, tint } = useStore();
  const soft = useSoft();
  const ahead = upcomingItems(catalog, now);
  if (catalog.empty) return <FirstRun where="in your courses" />;
  const tab = state.coursesTab;

  if (tab === 'due') {
    return (
      <Page>
        <CoursesTabs value={tab} onChange={(t) => dispatch({ type: 'setCoursesTab', tab: t })} />
        <ComingUp />
      </Page>
    );
  }

  return (
    /*
      Two returns, two shells.

      A "screen" in the registry is not always one component: this one has a
      branch per tab. There was a third, and it rendered the Grades screen
      bare — the same table the Grades destination is, reached a second way.
      Grades kept its own screen and this lost the copy.
    */
    <Page
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}
    >
        <>
          <CoursesTabs value={tab} onChange={(t) => dispatch({ type: 'setCoursesTab', tab: t })} />
          {/* Absent until there is more than one term. See `components/TermSwitch`. */}
          <TermSwitch />
          {/*
            The soft layout shows the same courses as a grid of tiles.

            The handoff asks for "light tiles per course with grade", and the
            grade is the half that was missing rather than the tiles: a card
            here has never carried one, so the answer to "how am I doing in
            this course" was a different screen. A tile is small enough that
            the grade is the second thing on it rather than the ninth.

            What the card has and the tile does not is the professor, the
            meeting pattern and the full course name. None of those is lost —
            they are on the course itself, one tap away, which is where the
            card was taking you anyway.
          */}
          {soft ? (
            <div className="soft-tiles">
              {catalog.courses.map((c) => {
                const next = ahead.find((i) => i.c === c.id);
                const mark = standing(c, state.grades, {
                  pieces: state.pieces,
                  drops: state.drops,
                }).current;
                return (
                  <LightTile
                    key={c.id}
                    label={c.code}
                    tint={tint(c.id).fill}
                    // A course with nothing entered has no grade, and a dash
                    // is not a grade. It says so instead.
                    figure={mark === null ? undefined : `${Math.round(mark)}%`}
                    sub={
                      mark === null
                        ? `No scores yet · ${next ? next.dueShort : 'nothing due'}`
                        : next
                          ? `Next ${next.dueShort}`
                          : 'Nothing scheduled'
                    }
                    onClick={() => dispatch({ type: 'openCourse', id: c.id })}
                  />
                );
              })}
            </div>
          ) : (
          catalog.courses.map((c) => {
            const next = ahead.find((i) => i.c === c.id);
            return (
              <Blueprint
                plain
                key={c.id}
                onClick={() => dispatch({ type: 'openCourse', id: c.id })}
                style={{
                  padding: '15px 16px',
                  display: 'block',
                  // The colour is a stripe down the edge rather than a tint on the
                  // whole card: four tinted cards is a dashboard, and the whole point
                  // of the look is that it is not one. Every course has one now —
                  // the stripe used to appear only for a course somebody had
                  // coloured by hand, which is to say almost never.
                  borderLeft: `3px solid ${tint(c.id).edge}`,
                  paddingLeft: 13,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 'var(--sp-5)',
                  }}
                >
                  <div className="chrome-text" style={{ fontSize: 'calc(22px * var(--text-scale, 1))' }}>
                    {c.code}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'var(--type-xs)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      opacity: 0.55,
                    }}
                  >
                    {c.meets}
                  </div>
                </div>
                <div style={{ fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-tight)', marginTop: 'var(--sp-1)' }}>
                  {nameFor(c, state.yours)}
                </div>
                <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginTop: 'var(--sp-1)' }}>{c.prof}</div>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--sp-4)',
                    alignItems: 'center',
                    marginTop: 'var(--sp-6)',
                    paddingTop: 11,
                    borderTop: '1px solid var(--app-line)',
                  }}
                >
                  <span className="tag tag-accent">{next ? next.dueShort : 'Clear'}</span>
                  <span
                    style={{
                      fontSize: 'var(--type-sm)',
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
          })
          )}

          {/*
            One quiet way to add a course, at the end of the courses.

            Not the full-width uppercase button this used to be: that read as
            the screen's main action when it is the rarest thing you do here —
            four times a semester against a list you open weekly. And not
            nothing either, which is what it was briefly: the + in the header
            captures a deadline, so with no link here the courses screen was
            the one place that talked about courses and could not add one,
            leaving `n` and search as the only routes on a phone.

            `tap-x`: it is the last item in a vertical list, so the room is
            beside it — reaching up would claim the last card's own tap area.
          */}
          <button
            type="button"
            className="bare tap-x"
            onClick={() => dispatch({ type: 'go', screen: 'import' })}
            style={{
              width: 'auto',
              // Longhand and on the scale: `padding` as a shorthand puts two
              // raw pixel values past the style budget. 16 + 16 either side of
              // a --type-sm line is already a fingertip tall, so the tap
              // overlay adds nothing vertically and cannot reach the card.
              paddingTop: 'var(--sp-7)',
              paddingBottom: 'var(--sp-7)',
              paddingLeft: 'var(--sp-1)',
              paddingRight: 'var(--sp-1)',
              marginTop: 'var(--sp-1)',
              textAlign: 'left',
              fontSize: 'var(--type-sm)',
              opacity: 0.6,
              textDecoration: 'underline dotted',
              textUnderlineOffset: 3,
              textDecorationColor: 'currentColor',
            }}
          >
            Add a course from a syllabus
          </button>
          <div style={{ height: 12 }} />
        </>
    </Page>
  );
}


/**
 * Coming up, overdue, done.
 *
 * Deadlines used to vanish at midnight — `upcomingItems` drops anything in the
 * past, so a missed paper stopped being shown rather than being shown as a
 * problem. These are the same deadlines under three headings, and the middle
 * one is the one that was missing.
 */
function ComingUp() {
  const { state, dispatch, now, catalog } = useStore();
  const all = datedItems(catalog, now);
  const { ahead, overdue, done } = split(all, state.done);
  const tab = state.dueTab;
  /*
   * Working is a filter over the same deadlines, not a fourth bucket.
   *
   * A paper started and now overdue is both started and overdue, and moving it
   * out of Overdue to make the partition tidy would hide a miss. So it can
   * appear here and there at once — two true things about one paper. See
   * `lib/underway.ts`.
   */
  const open = underway(all, state.started, state.done);
  const list =
    tab === 'overdue' ? overdue : tab === 'done' ? done : tab === 'working' ? open : ahead;

  const blurb =
    tab === 'overdue'
      ? overdueLine(overdue, (i) => catalog.byId[i.c]?.code ?? '', state.tone)
      : tab === 'done'
        ? `${done.length} finished this semester. Tick one again to undo it.`
        : tab === 'working'
          ? underwayLine(all, state.started, state.done, now.getTime())
          : 'Everything still ahead of you, nearest first, across every course.';

  return (
    <>
      <Segmented
        options={[
          { id: 'ahead', label: `Ahead${badge(ahead.length)}` },
          { id: 'working', label: `Working${badge(open.length)}` },
          { id: 'overdue', label: `Overdue${badge(overdue.length)}` },
          { id: 'done', label: `Done${badge(done.length)}` },
        ]}
        value={tab}
        onChange={(t) => dispatch({ type: 'setDueTab', tab: t })}
        style={{ marginBottom: 'var(--sp-6)' }}
      />
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--sp-2)' }}>{blurb}</div>
      {list.length === 0 && (
        <div style={{ padding: '22px 0', fontSize: 'var(--type-md)', opacity: 0.55 }}>
          {tab === 'overdue'
            ? 'Nothing has gone by unticked.'
            : tab === 'done'
              ? 'Nothing ticked off yet. The box on any row does it.'
              : tab === 'working'
                ? 'Nothing marked as started yet. Open a deadline and mark it, and it stays here until you tick it off.'
                : 'Nothing left this semester.'}
        </div>
      )}
      {list.map((i) => (
        <DeadlineRow
          key={i.id}
          item={i}
          // On the Working tab a row's tone is whatever it actually is —
          // an overdue thing shown here is still overdue, and colouring it
          // as "ahead" would be the app telling a comfortable lie.
          tone={tab === 'working' ? standingOf(i, state.done) : tab}
        />
      ))}
      <div style={{ height: 22 }} />
    </>
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
    <div style={{ marginTop: 'var(--sp-5)' }}>
      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{
              flex: 1,
              height: 42,
              fontSize: 'var(--type-xs)',
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
            fontSize: 'var(--type-xs)',
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
            style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', marginTop: 9 }}
            aria-label={`${course.code} Brightspace address`}
          />
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 'var(--leading-normal)', marginTop: 7 }}>
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
            style={{ marginTop: 9, fontSize: 'var(--type-xs)', letterSpacing: '0.12em', textTransform: 'uppercase' }}
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
  // The store settles this pointer after a term switch, but there is one
  // render in between where it is still aimed at last semester.
  if (!course) return null;
  const ours = datedItems(catalog, now).filter((i) => i.c === course.id);
  const mine = split(ours, state.done);
  const mineOpen = underway(ours, state.started, state.done);

  return (
    <div style={{ padding: 18 }}>
      <Folding name="CourseDetail">
      <div style={{ fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-tight)' }}>{nameFor(course, state.yours)}</div>
      {/* The syllabus name stays visible under a nickname. This screen is
          where somebody checks what a course actually is — dropping the real
          name here would make the rename a way to lose information. */}
      {renamed(course, state.yours) ? (
        <div style={{ fontSize: 'var(--type-sm)', opacity: 0.45, marginTop: 'var(--sp-1)' }}>{course.name}</div>
      ) : null}
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.6, marginTop: 3 }}>
        {course.prof} · {course.email}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 'var(--sp-6)' }}>
        <span className="tag tag-outline">{course.meets}</span>
        {/* The room is the one detail here you might need to act on, so it is
            a link to directions rather than a label to read and retype. */}
        {course.room && fromRoom(course.room) ? (
          <a
            href={
              prefersApple()
                ? appleMapsUrl(fromRoom(course.room) as Destination)
                : directionsUrl(fromRoom(course.room) as Destination)
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

      <ActionButton
        onClick={() => dispatch({ type: 'openGuide', id: course.id })}
        tone="primary"
        style={{ marginTop: 'var(--sp-7)' }}
      >
        Study this course
      </ActionButton>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'openUpdate', courseId: course.id, unit: null })}
        style={{ height: 44, marginTop: 'var(--sp-4)' }}
      >
        Add a reading to this course
      </button>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'go', screen: 'announce' })}
        style={{ height: 44, marginTop: 'var(--sp-4)' }}
      >
        Fold in an announcement
      </button>

      {state.courses.some((c) => c.course.id === course.id) && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'edit' })}
          style={{ height: 44, marginTop: 'var(--sp-4)' }}
        >
          Edit this course
        </button>
      )}

      {course.email ? (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() =>
            dispatch({ type: 'writeMail', purposeId: 'question', courseId: course.id })
          }
          style={{ height: 44, marginTop: 'var(--sp-4)' }}
        >
          Email {course.prof || 'the professor'}
        </button>
      ) : null}

      <LmsLink course={course} />

      {/* Renders nothing for a sample course: everybody with the app already
          has those four. */}
      <ShareCourse courseId={course.id} />

      {/* Silent unless the app has a reason. See `lib/officehours.ts`. */}
      <DropBy courseId={course.id} />

      <OfficeHours courseId={course.id} />

      {/* Next to the grade, because that is what it changes. */}
      <Attendance courseId={course.id} />

      <SectionLabel style={{ margin: '24px 0 6px' }}>How the grade is built</SectionLabel>
      <table className="table">
        <tbody>
          {course.grading.map((g) => (
            <tr key={g.what}>
              <td style={{ fontSize: 'var(--type-base)' }}>{g.what}</td>
              <td
                style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'var(--type-lg)',
                  width: 74,
                }}
              >
                {g.pct}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/*
        * Above Still ahead, because it is the shorter list and the one that
        * answers "what am I in the middle of for this course". The same
        * deadlines still appear below in whichever section they belong to —
        * this is a filter over them, not a fourth section they move into.
        */}
      {mineOpen.length > 0 && (
        <>
          <SectionLabel style={{ margin: '24px 0 6px' }}>In progress</SectionLabel>
          {mineOpen.map((i) => (
            <DeadlineRow key={i.id} item={i} tone={standingOf(i, state.done)} />
          ))}
        </>
      )}

      <SectionLabel style={{ margin: '24px 0 6px' }}>Still ahead</SectionLabel>
      {mine.ahead.length === 0 && (
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.5, padding: '8px 0' }}>
          Nothing left in this course.
        </div>
      )}
      {mine.ahead.map((i) => (
        <DeadlineRow key={i.id} item={i} tone="ahead" />
      ))}

      {mine.overdue.length > 0 && (
        <>
          <SectionLabel style={{ margin: '24px 0 6px' }}>Went by</SectionLabel>
          {mine.overdue.map((i) => (
            <DeadlineRow key={i.id} item={i} tone="overdue" />
          ))}
        </>
      )}

      {mine.done.length > 0 && (
        <>
          <SectionLabel style={{ margin: '24px 0 6px' }}>Done</SectionLabel>
          {mine.done.map((i) => (
            <DeadlineRow key={i.id} item={i} tone="done" />
          ))}
        </>
      )}

      <div
        style={{
          fontSize: 'var(--type-xs)',
          opacity: 0.45,
          marginTop: 14,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.08em',
        }}
      >
        Imported from {course.source}
      </div>
      <div style={{ height: 22 }} />
      </Folding>
    </div>
  );
}

export function ItemDetail() {
  const { state, dispatch, now, catalog } = useStore();
  const all = datedItems(catalog, now);
  const item = all.find((i) => i.id === state.itemId) ?? all[0];
  if (!item) return null;
  const done = !!state.done[item.id];
  const going = isUnderway(item.id, state.started, state.done);

  return (
    <div style={{ padding: 18 }}>
      <Folding name="ItemDetail">
      <Blueprint style={{ padding: 'var(--sp-7)' }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <CourseTag id={item.c} />
          <span
            style={{
              fontSize: 'var(--type-xs)',
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
            fontSize: 'calc(27px * var(--text-scale, 1))',
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
            <div className="kicker" style={{ fontSize: 'calc(10px * var(--text-scale, 1))' }}>
              Due
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(18px * var(--text-scale, 1))' }}>{item.dueShort}</div>
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6 }}>{item.dueTime}</div>
          </div>
          <div style={{ width: 1, background: 'var(--app-line)' }} />
          <div style={{ flex: 1, padding: '11px 0 11px 14px' }}>
            <div className="kicker" style={{ fontSize: 'calc(10px * var(--text-scale, 1))' }}>
              Weight
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(18px * var(--text-scale, 1))' }}>{item.weight}</div>
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6 }}>{item.where}</div>
          </div>
        </div>
      </Blueprint>

      <div
        style={{
          fontSize: 'var(--type-md)',
          lineHeight: 1.55,
          marginTop: 18,
          opacity: 0.85,
          textWrap: 'pretty',
        }}
      >
        {item.detail}
      </div>

      {/* Only renders for a reading. A problem set is done or it is not, and
          a page number for one is a field nobody can fill in. */}
      <ReadingProgress item={item} />

      {/* The regrade clock starts when a professor hands something back, which
          is a fact only the student knows — so it is one tap here. */}
      <CameBack item={item} />

      {/* A ten-page paper is one row here and a fortnight of work. This is
          the only place the gap between those two facts is visible. */}
      <BreakItUp item={item} />

      {/* Only when there is time to ask about and something to ask about it
          for. See `canAskForTime`. */}
      <AskForTime item={item} />

      <SectionLabel style={{ margin: '22px 0 8px' }}>Straight from the syllabus</SectionLabel>
      <div
        style={{
          borderLeft: '2px solid var(--app-accent)',
          padding: '2px 0 2px 14px',
          fontSize: 'var(--type-base)',
          lineHeight: 'var(--leading-relaxed)',
          opacity: 0.75,
          fontStyle: 'italic',
        }}
      >
        {item.quote}
      </div>
      <div
        style={{
          fontSize: 'var(--type-xs)',
          opacity: 0.45,
          marginTop: 'var(--sp-4)',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.08em',
        }}
      >
        {item.source}
        {/* The page, where the API cited it. This is what turns "the app says
            the syllabus says this" into something you can check in ten
            seconds — see `lib/cite.ts`. Absent on a course imported before
            citations, and on one built from pasted text. */}
        {item.checked?.page ? ` · p. ${item.checked.page}` : ''}
      </div>

      {/*
        The date this used to be on, where somebody has moved it.

        Right under the quote, because that is where the disagreement is: the
        sentence says one day and the app is now showing another. A move that
        left no trace here would be the app quietly overwriting the document it
        is holding up as its evidence. See `moveItem` in
        `state/slices/library.ts`.
      */}
      {item.movedFrom && (
        <div
          style={{
            fontSize: 'var(--type-xs)',
            opacity: 0.6,
            marginTop: 'var(--sp-3)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          You moved this. The syllabus said{' '}
          {longLabel(new Date(item.movedFrom.year ?? item.year ?? now.getFullYear(), item.movedFrom.month, item.movedFrom.day))}.
        </div>
      )}

      {/*
        * The middle state, which is where most coursework actually lives.
        *
        * Above the Done row rather than beside it, because they are not two
        * halves of one choice: starting and finishing are independent, and a
        * three-way segmented control would make un-ticking a finished thing
        * lose that it was ever begun. Hidden once something is done — there is
        * nothing useful to say about when you started a paper you handed in.
        */}
      {!done && (
        <button
          type="button"
          className="btn btn-block"
          aria-pressed={going}
          onClick={() => dispatch({ type: 'toggleStarted', id: item.id })}
          style={{
            marginTop: 24,
            height: 46,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            borderColor: going ? 'var(--app-accent)' : undefined,
          }}
        >
          {going ? 'Not started after all' : 'I have started this'}
        </button>
      )}
      {going && !done && (
        <div
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            opacity: 0.6,
            marginTop: 'var(--sp-4)',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          {openLine(item.id, state.started, now.getTime())}. It shows under Working in Coming up,
          and carries a mark in every list until you tick it off.
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: going && !done ? 14 : 24 }}>
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
      {/* Before it is ticked, a clock you can start. After, the question you
          can answer in one tap. The same measurement either way, and neither
          appears once this piece of work has a time against it. */}
      {done ? (
        <HowLong id={item.id} courseId={item.c} kind={item.kind} />
      ) : (
        <Timer id={item.id} courseId={item.c} kind={item.kind} title={item.title} />
      )}
      <div style={{ height: 22 }} />
      </Folding>
    </div>
  );
}
