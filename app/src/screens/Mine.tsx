import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle } from '../components/shell/useShell';
import { Blueprint } from '../components/Blueprint';
import { CoursePicker } from '../components/CoursePicker';
import { DeadlinePicker } from '../components/DeadlinePicker';
import { forLine } from '../lib/forwork';
import { datedItems } from '../lib/select';
import { ActionButton, EmptyState, FilePick, SectionLabel, Segmented, TickBox } from '../components/ui';
import { ChevronRight, Plus } from '../components/Icons';
import { addFile, formatBytes, listFiles, openFile, type FileMeta } from '../lib/files';
import { Drive } from './mine/Drive';
import { dateToIso, isoToDate, longLabel } from '../lib/date';
import type { CourseId, Note, PersonalTask } from '../lib/types';
import { EVENT_KINDS, kindOf, type EventKindId } from '../lib/kinds';
import { CheckIt } from '../components/CheckIt';
import { Dictate } from '../components/Dictate';
import { RecordButton } from '../components/RecordButton';
import { PrintButton } from '../components/PrintButton';
import { Folding } from '../components/Fold';

/**
 * Everything you added yourself.
 *
 * Deliberately its own tab rather than mixed into Courses: the app's whole
 * premise is that the syllabus content is trustworthy because it came out of a
 * PDF with a citation attached. Your own tasks and notes are a different kind
 * of thing, so they live in a different place — and surface on Today and the
 * calendar clearly marked as yours.
 */

const inputStyle = { height: 40, fontSize: 'var(--type-md)', marginTop: 'var(--sp-4)' } as const;

/**
 * Enter finishes a one-line add.
 *
 * Both boxes below open with the cursor already in a single-line field — they
 * autofocus it, which is an invitation to type — and then ignored the key that
 * ends typing. On a phone that is the keyboard's own return key doing nothing;
 * on a laptop it is a reach for the mouse to finish a sentence.
 *
 * Only on the free-text fields. A date or time input has its own picker and
 * its own idea of what Enter means, and taking that key off it would be
 * trading one surprise for another.
 *
 * Escape closes the box, for the same reason: it is already how the *edit*
 * row a few lines down behaves, and having Enter and Escape work on a task
 * you are changing but not on the one you are writing is the same screen
 * answering the same key two ways.
 *
 * `components/QuickAdd.tsx` has always worked this way too. These are the
 * same action reached through a form rather than through one line of prose,
 * so the key that commits it should not depend on which door was used.
 */
const submitOnEnter =
  (add: () => void, close: () => void) =>
  (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
      return;
    }
    if (e.key === 'Escape') close();
  };

/**
 * One task, and the way to change it.
 *
 * A task could be added, ticked and deleted, and nothing else. So a date typed
 * wrong, a paper that moved a week, or a step in a plan that needs to land on
 * a different evening all had the same remedy — delete it and type it again,
 * throwing away whether it was done and when it was made. Every other thing
 * this app holds has been editable since it existed. This was the exception,
 * and it was the one people touch most.
 *
 * Editing is behind a press rather than always on, and saved explicitly. A
 * list of tasks that is also a page of live inputs is a page where a stray tap
 * lands in a field and a stray keystroke changes something, and the tick box —
 * the thing this screen is mostly for — becomes harder to hit.
 */
function TaskRow({ task: t }: { task: PersonalTask }) {
  const { dispatch, courseCode } = useStore();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [date, setDate] = useState(t.date ?? '');
  const [time, setTime] = useState(t.time);

  const save = () => {
    if (!title.trim()) return;
    dispatch({
      type: 'editTask',
      id: t.id,
      // `date` is nullable on purpose: clearing the field moves a task to
      // Someday rather than leaving it stranded on an empty string, which no
      // group would have matched and which would have made it disappear.
      patch: { title: title.trim(), date: date || null, time: time.trim() },
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <Blueprint style={{ padding: '12px 14px', background: 'var(--app-panel)' }}>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label="What the task is"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          style={{ height: 40, fontSize: 'var(--type-md)', width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="The day it is for"
            style={{ flex: 1, minWidth: 0, height: 40, fontSize: 'var(--type-base)' }}
          />
          <input
            className="input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="6:30 PM"
            aria-label="What time, in your own words"
            style={{ flex: 1, minWidth: 0, height: 40, fontSize: 'var(--type-base)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={!title.trim()}
            style={{ width: 'auto', padding: '0 16px', height: 38, fontSize: 'var(--type-xs)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Save
          </button>
          <button
            type="button"
            className="bare"
            onClick={() => setEditing(false)}
            style={{ width: 'auto', padding: '0 8px', height: 38, fontSize: 'var(--type-sm)', opacity: 0.6 }}
          >
            Cancel
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="bare"
            onClick={() => dispatch({ type: 'deleteTask', id: t.id })}
            aria-label={`Delete ${t.title}`}
            style={{ width: 'auto', padding: '0 8px', height: 38, fontSize: 'var(--type-sm)', opacity: 0.5 }}
          >
            Delete
          </button>
        </div>
        {/* Where it came from, when something put it here. A step in a plan
            found three weeks later says what it is for. */}
        {t.note ? (
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
            {t.note}
          </div>
        ) : null}
      </Blueprint>
    );
  }

  return (
    <Blueprint
      style={{
        display: 'flex',
        gap: 'var(--sp-6)',
        padding: '12px 14px',
        alignItems: 'flex-start',
        background: t.done ? 'transparent' : 'var(--app-panel)',
      }}
    >
      <button
        type="button"
        className="bare"
        onClick={() => dispatch({ type: 'toggleTask', id: t.id })}
        aria-label={t.done ? `Mark ${t.title} not done` : `Mark ${t.title} done`}
        style={{ width: 20, flex: 'none', marginTop: 'var(--sp-1)' }}
      >
        <TickBox on={t.done} />
      </button>
      <button
        type="button"
        className="bare tappable"
        onClick={() => {
          // Re-seeded on open rather than kept in sync: the fields are a draft
          // of the task, and a draft that follows the task while you are
          // typing in it is a draft that fights you.
          setTitle(t.title);
          setDate(t.date ?? '');
          setTime(t.time);
          setEditing(true);
        }}
        aria-label={`Edit ${t.title}`}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', opacity: t.done ? 0.42 : 1, padding: 0 }}
      >
        <span
          style={{
            display: 'block',
            fontSize: 'var(--type-lg)',
            lineHeight: 'var(--leading-tight)',
            textDecoration: t.done ? 'line-through' : 'none',
          }}
        >
          {t.title}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.55, marginTop: 3 }}>
          <span className="tag tag-neutral" style={{ marginRight: 'var(--sp-3)' }}>
            {t.courseId ? courseCode(t.courseId) : 'Personal'}
          </span>
          {t.date ? longLabel(isoToDate(t.date)) : 'No date'}
          {t.time ? ` \u00b7 ${t.time}` : ''}
        </span>
      </button>
    </Blueprint>
  );
}

function Tasks({ rows }: { rows?: PersonalTask[] }) {
  const { state, dispatch, now } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dateToIso(now));
  const [time, setTime] = useState('');
  const [courseId, setCourseId] = useState<CourseId | null>(null);

  const add = () => {
    if (!title.trim()) return;
    dispatch({
      type: 'addTask',
      task: { title: title.trim(), date: date || null, time: time.trim(), note: '', courseId },
    });
    setTitle('');
    setTime('');
    setOpen(false);
  };

  const today = dateToIso(now);
  /*
   * The rows the box left, or all of them when there is no box.
   *
   * The grouping into Today / Coming up / Someday happens after the filter,
   * so a filtered list keeps its shape — three groups with fewer rows rather
   * than one flat list, which is what somebody scanning for a task expects
   * to still be looking at.
   */
  const mine = rows ?? state.tasks;
  const groups: { label: string; tasks: typeof state.tasks }[] = [
    { label: 'Today', tasks: mine.filter((t) => t.date === today) },
    {
      label: 'Coming up',
      tasks: mine
        .filter((t) => t.date && t.date > today)
        .sort((a, b) => (a.date! < b.date! ? -1 : 1)),
    },
    { label: 'Someday', tasks: mine.filter((t) => !t.date) },
    {
      label: 'Overdue',
      tasks: state.tasks.filter((t) => t.date && t.date < today && !t.done),
    },
  ];

  return (
    <div>
      {open ? (
        <Blueprint style={{ padding: 14, marginBottom: 14 }}>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={submitOnEnter(add, () => setOpen(false))}
            placeholder="What needs doing?"
            style={{ height: 42, fontSize: 'var(--type-lg)' }}
            aria-label="Task"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              aria-label="Date"
            />
            <input
              className="input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              onKeyDown={submitOnEnter(add, () => setOpen(false))}
              placeholder="6:30 PM"
              style={{ ...inputStyle, flex: 1 }}
              aria-label="Time"
            />
          </div>
          <CoursePicker value={courseId} onChange={setCourseId} />
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOpen(false)}
              style={{ flex: 1, height: 42, textTransform: 'uppercase', letterSpacing: '0.1em' }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={add}
              style={{ flex: 1, height: 42, textTransform: 'uppercase', letterSpacing: '0.1em' }}
            >
              Add task
            </button>
          </div>
        </Blueprint>
      ) : (
        <ActionButton
          onClick={() => setOpen(true)}
          tone="primary"
        >
          + New task
        </ActionButton>
      )}

      {state.tasks.length === 0 && !open && (
        <EmptyState
          title="Nothing of your own yet."
          body="Tasks you add here are yours — they sit alongside coursework on Today without pretending to be it."
        />
      )}

      {groups.map((g) =>
        g.tasks.length === 0 ? null : (
          <div key={g.label}>
            <Folding name="Tasks">
            <SectionLabel>{g.label}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {g.tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
            </Folding>
          </div>
        ),
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}

/** "6:30p" from a 24h "18:30" — the format the rail uses. */
function clockFromInput(value: string): { at: number; time: string } {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return { at: 12 * 60, time: '12:00p' };
  const at = h * 60 + (m || 0);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { at, time: `${hour}:${String(m || 0).padStart(2, '0')}${h < 12 ? 'a' : 'p'}` };
}

function Appointments() {
  const { state, dispatch, now } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dateToIso(now));
  const [when, setWhen] = useState('09:00');
  const [where, setWhere] = useState('');
  const [kind, setKind] = useState<EventKindId>('social');

  const add = () => {
    if (!title.trim()) return;
    const { at, time } = clockFromInput(when);
    dispatch({
      type: 'addAppointment',
      appointment: { title: title.trim(), date, at, time, where: where.trim(), note: '', kind },
    });
    setTitle('');
    setWhere('');
    setOpen(false);
  };

  const upcoming = [...state.appointments].sort((a, b) =>
    a.date === b.date ? a.at - b.at : a.date < b.date ? -1 : 1,
  );

  return (
    <div>
      {open ? (
        <Blueprint style={{ padding: 14, marginBottom: 14 }}>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={submitOnEnter(add, () => setOpen(false))}
            placeholder="Dentist, advisor meeting, shift…"
            style={{ height: 42, fontSize: 'var(--type-lg)' }}
            aria-label="Appointment"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              aria-label="Date"
            />
            <input
              className="input"
              type="time"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              aria-label="Time"
            />
          </div>
          <input
            className="input"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            onKeyDown={submitOnEnter(add, () => setOpen(false))}
            placeholder="Where?"
            style={inputStyle}
            aria-label="Place"
          />

          {/* What it is for, so the hour grid can colour it and a glance at the
              day tells you what kind of day it is. */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--sp-3)',
              marginTop: 'var(--sp-5)',
            }}
          >
            {EVENT_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className="btn"
                onClick={() => setKind(k.id)}
                aria-pressed={kind === k.id}
                style={{
                  flex: 'none',
                  padding: '5px 10px',
                  fontSize: 'var(--type-xs)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: kind === k.id ? 'var(--app-hero)' : 'transparent',
                  borderColor: kind === k.id ? k.tint : 'var(--app-line)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-3)',
                }}
              >
                <span style={{ width: 3, height: 10, background: k.tint, flex: 'none' }} />
                {k.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOpen(false)}
              style={{ flex: 1, height: 42, textTransform: 'uppercase', letterSpacing: '0.1em' }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={add}
              style={{ flex: 1, height: 42, textTransform: 'uppercase', letterSpacing: '0.1em' }}
            >
              Add
            </button>
          </div>
        </Blueprint>
      ) : (
        <ActionButton
          onClick={() => setOpen(true)}
          tone="primary"
        >
          + New appointment
        </ActionButton>
      )}

      {upcoming.length === 0 && !open && (
        <EmptyState
          title="No appointments."
          body="Anything you add here lands on the day’s rail next to your classes."
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 14 }}>
        {upcoming.map((a) => (
          <Blueprint
            key={a.id}
            plain
            style={{
              display: 'flex',
              gap: 13,
              padding: '12px 14px',
              // The same tint the hour grid uses, so a row and its block on the
              // day are recognisably the same thing.
              borderLeft: `2px solid ${kindOf(a.kind).tint}`,
            }}
          >
            <div
              style={{
                width: 52,
                flex: 'none',
                fontFamily: 'var(--font-heading)',
                lineHeight: 1.1,
              }}
            >
              <div style={{ fontSize: 'calc(16px * var(--text-scale, 1))' }}>{a.time}</div>
              <div style={{ fontSize: 'calc(10px * var(--text-scale, 1))', opacity: 0.5, letterSpacing: '0.1em' }}>
                {longLabel(isoToDate(a.date)).replace(/^\w+ /, '')}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--type-lg)', lineHeight: 1.25 }}>{a.title}</div>
              <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginTop: 'var(--sp-1)' }}>
                {[kindOf(a.kind).label, a.where].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => dispatch({ type: 'deleteAppointment', id: a.id })}
              aria-label={`Delete ${a.title}`}
              style={{ flex: 'none', fontSize: 'calc(10px * var(--text-scale, 1))', letterSpacing: '0.12em', padding: '4px 6px' }}
            >
              Del
            </button>
          </Blueprint>
        ))}
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}

function Notes({ rows }: { rows?: Note[] }) {
  const { state, dispatch, courseCode, catalog, now } = useStore();
  const rowThirteen = useRowStyle(13);
  /* One list for the whole tab — see the same note in `screens/Write.tsx`. */
  const items = useMemo(() => datedItems(catalog, now), [catalog, now]);
  const all = [...state.notes].sort((a, b) => b.updated - a.updated);
  /*
   * The filtered rows when the box has something in it, all of them when it
   * does not — and `all` either way for the empty state, so filtering to
   * nothing says "nothing matches" rather than "no notes yet". Those are
   * different facts and the second one is alarming when it is not true.
   */
  const notes = rows ?? all;

  return (
    <div>
      <ActionButton
        onClick={() => dispatch({ type: 'newNote', courseId: null })}
        tone="primary"
      >
        + New note
      </ActionButton>

      {all.length === 0 ? (
        <EmptyState
          title="No notes yet."
          body="Write anything — a lecture summary, a question for office hours — and attach files to it."
        />
      ) : (
        <div style={{ marginTop: 14 }}>
          {notes.map((n) => (
            <button
              key={n.id}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'openNote', id: n.id })}
              style={{
                display: 'flex',
                gap: 'var(--sp-6)',
                alignItems: 'center',
                ...rowThirteen,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--type-lg)', lineHeight: 1.25 }}>
                  {n.title || 'Untitled note'}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--type-xs)',
                    opacity: 0.55,
                    marginTop: 3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {n.courseId ? `${courseCode(n.courseId)} · ` : ''}
                  {/* What it is for, where it is for something — the same
                      phrase the drive and the three shelves use. */}
                  {forLine(items, n.itemId) && `${forLine(items, n.itemId)} · `}
                  {n.fileIds.length > 0 ? `${n.fileIds.length} file · ` : ''}
                  {n.body.slice(0, 60) || 'Empty'}
                </span>
              </span>
              <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
            </button>
          ))}
        </div>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}

/**
 * The files tab, which is now a drive.
 *
 * The list, the folders, the bin and the search live in
 * `screens/mine/Drive.tsx` — this stayed a wrapper so the fold and the heading
 * above it read the same as the three tabs beside it.
 */
function Files() {
  return (
    <div>
      <Folding name="Files">
        <Drive />
      </Folding>
    </div>
  );
}

export function Mine() {
  const { state, dispatch } = useStore();

  /*
   * Tasks and notes are the two lists here that grow without limit — a term's
   * worth of either is a scroll — and each had a filter on this screen. Both
   * went with every other in-screen filter: the header's search reaches tasks
   * and notes by name, and a note's body is searched there too.
   */
  const notes = useMemo(
    () => [...state.notes].sort((a, b) => b.updated - a.updated),
    [state.notes],
  );

  return (
    <Page>
      <>
      <Segmented
        options={[
          { id: 'tasks', label: 'Tasks' },
          { id: 'appointments', label: 'Events' },
          { id: 'notes', label: 'Notes' },
          { id: 'files', label: 'Files' },
        ]}
        value={state.mineTab}
        onChange={(tab) => dispatch({ type: 'setMineTab', tab })}
        style={{ marginBottom: 'var(--sp-7)' }}
      />
      {state.mineTab === 'tasks' && <Tasks rows={state.tasks} />}
      {state.mineTab === 'appointments' && <Appointments />}
      {state.mineTab === 'notes' && <Notes rows={notes} />}
      {state.mineTab === 'files' && <Files />}
      </>
    </Page>
  );
}

/** The note editor. Saves as you type — there is no save button on purpose. */
export function NoteEditor() {
  const { state, dispatch } = useStore();
  const note = state.notes.find((n) => n.id === state.noteId);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [allDeadlines, setAllDeadlines] = useState(false);

  useEffect(() => {
    void listFiles().then(setFiles);
  }, [note?.fileIds.length]);

  /*
   * A note that is gone, rather than a screen that is broken.
   *
   * `#/note/<id>` is a real address — it is what the app writes when a note
   * opens — so it outlives the note: deleted here and reopened from history,
   * bookmarked, or restored from a backup taken before it was written. Every
   * other named screen falls back to something (see `lib/route.ts`), and this
   * one used to be a grey line of text with nothing on it to press.
   */
  if (!note) {
    return (
      <EmptyState
        title="That note is gone"
        body="It was deleted, or it was written on another device. Everything you have written is in Notes."
        action={{
          label: 'Open Notes',
          onClick: () => {
            // The notes tab specifically — landing on Tasks after asking for a
            // note is the second half of the same wrong turn.
            dispatch({ type: 'setMineTab', tab: 'notes' });
            dispatch({ type: 'go', screen: 'mine' });
          },
        }}
      />
    );
  }

  const attached = files.filter((f) => note.fileIds.includes(f.id));

  const attach = async (list: File[]) => {
    if (list.length === 0) return;
    for (const f of list) {
      /* The note's deadline as well as its course. A reading attached to
         notes for Friday's paper is a file for Friday's paper, and asking
         somebody to say so twice is how one of the two ends up wrong. */
      const meta = await addFile(f, note.courseId, null, '', note.itemId ?? null);
      dispatch({ type: 'attachFile', noteId: note.id, fileId: meta.id });
    }
    void listFiles().then(setFiles);
  };

  return (
    <Page>
      <input
        className="input"
        value={note.title}
        onChange={(e) => dispatch({ type: 'updateNote', id: note.id, patch: { title: e.target.value } })}
        placeholder="Title"
        style={{ height: 46, fontSize: 'calc(17px * var(--text-scale, 1))', fontFamily: 'var(--font-heading)' }}
        aria-label="Note title"
      />

      <CoursePicker
        value={note.courseId}
        onChange={(courseId) => dispatch({ type: 'updateNote', id: note.id, patch: { courseId } })}
      />
      {/* Reading notes for a seminar are notes for the response paper that
          seminar is assessed by, and this is what puts them there. */}
      <DeadlinePicker
        courseId={note.courseId}
        value={note.itemId}
        onChange={(itemId) => dispatch({ type: 'updateNote', id: note.id, patch: { itemId } })}
        showAll={allDeadlines}
        onShowAll={() => setAllDeadlines(true)}
      />

      <textarea
        className="input"
        value={note.body}
        onChange={(e) => dispatch({ type: 'updateNote', id: note.id, patch: { body: e.target.value } })}
        placeholder="Write anything."
        spellCheck
        style={{ minHeight: 260, fontSize: 'var(--type-md)', lineHeight: 1.55, marginTop: 'var(--sp-6)' }}
        aria-label="Note body"
      />

      <CheckIt
        text={note.body}
        onChange={(body) => dispatch({ type: 'updateNote', id: note.id, patch: { body } })}
      />

      <Dictate
        onText={(text) =>
          dispatch({ type: 'updateNote', id: note.id, patch: { body: text } })
        }
        current={note.body}
      />

      <PrintButton label="Print this note" style={{ marginTop: 'var(--sp-5)' }} />

      {/* Dictation is for talking to the page; this is for keeping the audio
          too — a seminar, a meeting with a TA, a thought on the walk home.
          Both write text; only this one leaves you a recording. */}
      <div style={{ marginTop: 'var(--sp-5)' }}>
        <RecordButton
          courseId={note.courseId ?? null}
          label={note.title || 'note'}
          onSaved={(meta, _seconds, transcript) => {
            dispatch({ type: 'attachFile', noteId: note.id, fileId: meta.id });
            void listFiles().then(setFiles);
            if (!transcript) return;
            const body = note.body.trim()
              ? `${note.body.replace(/\s+$/, '')}\n\n${transcript}`
              : transcript;
            dispatch({ type: 'updateNote', id: note.id, patch: { body } });
          }}
        />
      </div>

      <SectionLabel>Attachments</SectionLabel>
      {attached.length === 0 && (
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.55, marginBottom: 'var(--sp-5)' }}>
          Nothing attached yet.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {attached.map((f) => (
          <Blueprint plain key={f.id} style={{ display: 'flex', gap: 'var(--sp-6)', padding: '11px 13px' }}>
            <button
              type="button"
              className="bare"
              onClick={() => void openFile(f.id)}
              style={{ flex: 1, minWidth: 0 }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--type-md)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.name}
              </span>
              <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.55 }}>
                {formatBytes(f.size)}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => dispatch({ type: 'detachFile', noteId: note.id, fileId: f.id })}
              style={{ flex: 'none', fontSize: 'calc(10px * var(--text-scale, 1))', letterSpacing: '0.12em', padding: '4px 6px' }}
            >
              Detach
            </button>
          </Blueprint>
        ))}
      </div>

      <FilePick onPick={(picked) => void attach(picked)} style={{ marginTop: 'var(--sp-6)' }}>
        <Plus size={15} /> Attach a file
      </FilePick>

      <ActionButton
        onClick={() => {
        dispatch({ type: 'deleteNote', id: note.id });
        dispatch({ type: 'back' });
        }}
        tone="ghost" spacing="0.12em"
        style={{ marginTop: 18, opacity: 0.7 }}
      >
        Delete note
      </ActionButton>
    </Page>
  );
}
