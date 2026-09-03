import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { EmptyState, SectionLabel, Segmented, TickBox } from '../components/ui';
import { ChevronRight, Plus } from '../components/Icons';
import { addFile, deleteFile, formatBytes, listFiles, openFile, type FileMeta } from '../lib/files';
import { dateToIso, isoToDate, longLabel } from '../lib/date';
import type { CourseId } from '../lib/types';

/**
 * Everything you added yourself.
 *
 * Deliberately its own tab rather than mixed into Courses: the app's whole
 * premise is that the syllabus content is trustworthy because it came out of a
 * PDF with a citation attached. Your own tasks and notes are a different kind
 * of thing, so they live in a different place — and surface on Today and the
 * calendar clearly marked as yours.
 */

/** Course picker used by every add form. */
function CoursePicker({
  value,
  onChange,
}: {
  value: CourseId | null;
  onChange: (id: CourseId | null) => void;
}) {
  const { catalog } = useStore();
  return (
    <div className="chiprow" style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[{ id: null, label: 'Personal' }, ...catalog.courses.map((c) => ({ id: c.id, label: c.code }))].map(
          (o) => {
            const on = value === o.id;
            return (
              <button
                key={o.label}
                type="button"
                className="btn"
                onClick={() => onChange(o.id as CourseId | null)}
                aria-pressed={on}
                style={{
                  flex: 'none',
                  padding: '5px 11px',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: on ? 'var(--chrome)' : 'transparent',
                  color: on ? '#0a0b0e' : 'var(--app-fg)',
                  borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                  fontWeight: on ? 600 : 400,
                }}
              >
                {o.label}
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}

const inputStyle = { height: 40, fontSize: 14, marginTop: 8 } as const;

function Tasks() {
  const { state, dispatch, now, catalog } = useStore();
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
  const groups: { label: string; tasks: typeof state.tasks }[] = [
    { label: 'Today', tasks: state.tasks.filter((t) => t.date === today) },
    {
      label: 'Coming up',
      tasks: state.tasks
        .filter((t) => t.date && t.date > today)
        .sort((a, b) => (a.date! < b.date! ? -1 : 1)),
    },
    { label: 'Someday', tasks: state.tasks.filter((t) => !t.date) },
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
            placeholder="What needs doing?"
            style={{ height: 42, fontSize: 15 }}
            aria-label="Task"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8 }}>
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
              placeholder="6:30 PM"
              style={{ ...inputStyle, flex: 1 }}
              aria-label="Time"
            />
          </div>
          <CoursePicker value={courseId} onChange={setCourseId} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => setOpen(true)}
          style={{ height: 46, textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          + New task
        </button>
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
            <SectionLabel>{g.label}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.tasks.map((t) => (
                <Blueprint
                  key={t.id}
                  style={{
                    display: 'flex',
                    gap: 12,
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
                    style={{ width: 20, flex: 'none', marginTop: 2 }}
                  >
                    <TickBox on={t.done} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0, opacity: t.done ? 0.42 : 1 }}>
                    <div
                      style={{
                        fontSize: 15,
                        lineHeight: 1.3,
                        textDecoration: t.done ? 'line-through' : 'none',
                      }}
                    >
                      {t.title}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 3 }}>
                      <span className="tag tag-neutral" style={{ marginRight: 6 }}>
                        {t.courseId ? catalog.byId[t.courseId]?.code : 'Personal'}
                      </span>
                      {t.date ? longLabel(isoToDate(t.date)) : 'No date'}
                      {t.time ? ` · ${t.time}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => dispatch({ type: 'deleteTask', id: t.id })}
                    aria-label={`Delete ${t.title}`}
                    style={{ flex: 'none', fontSize: 10, letterSpacing: '0.12em', padding: '4px 6px' }}
                  >
                    Del
                  </button>
                </Blueprint>
              ))}
            </div>
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

  const add = () => {
    if (!title.trim()) return;
    const { at, time } = clockFromInput(when);
    dispatch({
      type: 'addAppointment',
      appointment: { title: title.trim(), date, at, time, where: where.trim(), note: '' },
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
            placeholder="Dentist, advisor meeting, shift…"
            style={{ height: 42, fontSize: 15 }}
            aria-label="Appointment"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8 }}>
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
            placeholder="Where?"
            style={inputStyle}
            aria-label="Place"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => setOpen(true)}
          style={{ height: 46, textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          + New appointment
        </button>
      )}

      {upcoming.length === 0 && !open && (
        <EmptyState
          title="No appointments."
          body="Anything you add here lands on the day’s rail next to your classes."
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {upcoming.map((a) => (
          <Blueprint key={a.id} style={{ display: 'flex', gap: 13, padding: '12px 14px' }}>
            <div
              style={{
                width: 52,
                flex: 'none',
                fontFamily: 'var(--font-heading)',
                lineHeight: 1.1,
              }}
            >
              <div style={{ fontSize: 16 }}>{a.time}</div>
              <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: '0.1em' }}>
                {longLabel(isoToDate(a.date)).replace(/^\w+ /, '')}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, lineHeight: 1.25 }}>{a.title}</div>
              {a.where && (
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{a.where}</div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => dispatch({ type: 'deleteAppointment', id: a.id })}
              aria-label={`Delete ${a.title}`}
              style={{ flex: 'none', fontSize: 10, letterSpacing: '0.12em', padding: '4px 6px' }}
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

function Notes() {
  const { state, dispatch, catalog } = useStore();
  const notes = [...state.notes].sort((a, b) => b.updated - a.updated);

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => dispatch({ type: 'newNote', courseId: null })}
        style={{ height: 46, textTransform: 'uppercase', letterSpacing: '0.1em' }}
      >
        + New note
      </button>

      {notes.length === 0 ? (
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
                gap: 12,
                alignItems: 'center',
                padding: '13px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, lineHeight: 1.25 }}>
                  {n.title || 'Untitled note'}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    opacity: 0.55,
                    marginTop: 3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {n.courseId ? `${catalog.byId[n.courseId]?.code} · ` : ''}
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

function Files() {
  const { state } = useStore();
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const refresh = () => void listFiles().then(setFiles);
  useEffect(refresh, []);

  const onPick = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    for (const f of Array.from(list)) await addFile(f, null);
    setBusy(false);
    refresh();
  };

  const total = files.reduce((n, f) => n + f.size, 0);

  return (
    <div>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void onPick(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => input.current?.click()}
        disabled={busy}
        style={{ height: 46, textTransform: 'uppercase', letterSpacing: '0.1em' }}
      >
        {busy ? 'Adding…' : '+ Add files'}
      </button>

      {files.length === 0 ? (
        <EmptyState
          title="No files."
          body="Slides, readings, a photo of the whiteboard. They stay on this device — nothing is uploaded."
        />
      ) : (
        <>
          <SectionLabel>
            {files.length} {files.length === 1 ? 'file' : 'files'} · {formatBytes(total)}
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {files.map((f) => {
              const usedBy = state.notes.filter((n) => n.fileIds.includes(f.id)).length;
              return (
                <Blueprint key={f.id} style={{ display: 'flex', gap: 12, padding: '12px 14px' }}>
                  <button
                    type="button"
                    className="bare"
                    onClick={() => void openFile(f.id)}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <span
                      style={{
                        display: 'block',
                        fontSize: 14,
                        lineHeight: 1.25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.name}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 11,
                        opacity: 0.55,
                        marginTop: 2,
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {formatBytes(f.size)}
                      {usedBy > 0 ? ` · attached to ${usedBy} note` : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void deleteFile(f.id).then(refresh)}
                    aria-label={`Delete ${f.name}`}
                    style={{ flex: 'none', fontSize: 10, letterSpacing: '0.12em', padding: '4px 6px' }}
                  >
                    Del
                  </button>
                </Blueprint>
              );
            })}
          </div>
        </>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}

export function Mine() {
  const { state, dispatch } = useStore();

  return (
    <div style={{ padding: 18 }}>
      <Segmented
        options={[
          { id: 'tasks', label: 'Tasks' },
          { id: 'appointments', label: 'Events' },
          { id: 'notes', label: 'Notes' },
          { id: 'files', label: 'Files' },
        ]}
        value={state.mineTab}
        onChange={(tab) => dispatch({ type: 'setMineTab', tab })}
        style={{ marginBottom: 16 }}
      />
      {state.mineTab === 'tasks' && <Tasks />}
      {state.mineTab === 'appointments' && <Appointments />}
      {state.mineTab === 'notes' && <Notes />}
      {state.mineTab === 'files' && <Files />}
    </div>
  );
}

/** The note editor. Saves as you type — there is no save button on purpose. */
export function NoteEditor() {
  const { state, dispatch } = useStore();
  const note = state.notes.find((n) => n.id === state.noteId);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listFiles().then(setFiles);
  }, [note?.fileIds.length]);

  if (!note) {
    return <div style={{ padding: 18, fontSize: 14, opacity: 0.6 }}>Note not found.</div>;
  }

  const attached = files.filter((f) => note.fileIds.includes(f.id));

  const attach = async (list: FileList | null) => {
    if (!list?.length) return;
    for (const f of Array.from(list)) {
      const meta = await addFile(f, note.courseId);
      dispatch({ type: 'attachFile', noteId: note.id, fileId: meta.id });
    }
    void listFiles().then(setFiles);
  };

  return (
    <div style={{ padding: 18 }}>
      <input
        className="input"
        value={note.title}
        onChange={(e) => dispatch({ type: 'updateNote', id: note.id, patch: { title: e.target.value } })}
        placeholder="Title"
        style={{ height: 46, fontSize: 17, fontFamily: 'var(--font-heading)' }}
        aria-label="Note title"
      />

      <CoursePicker
        value={note.courseId}
        onChange={(courseId) => dispatch({ type: 'updateNote', id: note.id, patch: { courseId } })}
      />

      <textarea
        className="input"
        value={note.body}
        onChange={(e) => dispatch({ type: 'updateNote', id: note.id, patch: { body: e.target.value } })}
        placeholder="Write anything."
        style={{ minHeight: 260, fontSize: 14, lineHeight: 1.55, marginTop: 12 }}
        aria-label="Note body"
      />

      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void attach(e.target.files);
          e.target.value = '';
        }}
      />

      <SectionLabel>Attachments</SectionLabel>
      {attached.length === 0 && (
        <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 10 }}>
          Nothing attached yet.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {attached.map((f) => (
          <Blueprint key={f.id} style={{ display: 'flex', gap: 12, padding: '11px 13px' }}>
            <button
              type="button"
              className="bare"
              onClick={() => void openFile(f.id)}
              style={{ flex: 1, minWidth: 0 }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: 14,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.name}
              </span>
              <span style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>
                {formatBytes(f.size)}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => dispatch({ type: 'detachFile', noteId: note.id, fileId: f.id })}
              style={{ flex: 'none', fontSize: 10, letterSpacing: '0.12em', padding: '4px 6px' }}
            >
              Detach
            </button>
          </Blueprint>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => input.current?.click()}
        style={{ height: 44, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 12 }}
      >
        <Plus size={15} /> Attach a file
      </button>

      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={() => {
          dispatch({ type: 'deleteNote', id: note.id });
          dispatch({ type: 'back' });
        }}
        style={{
          height: 40,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginTop: 18,
          opacity: 0.7,
        }}
      >
        Delete note
      </button>
      <div style={{ height: 22 }} />
    </div>
  );
}
