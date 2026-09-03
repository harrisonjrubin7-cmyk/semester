import { useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { SEMESTER_YEAR } from '../lib/date';
import {
  DAYS,
  KINDS,
  addItem,
  blankItem,
  dropItem,
  fromInputDate,
  gaps,
  patchItem,
  toInputDate,
  weightNote,
  withCourse,
  withGrading,
  withSchedule,
} from '../lib/edit';
import type { CourseModule } from '../lib/types';

/**
 * Changing a course after it exists.
 *
 * A syllabus is a first draft. A paper moves a week, a weighting is corrected
 * in the second lecture, a room changes, a professor turns out to go by
 * something other than what the PDF said. Before this, the first thing that
 * changed made the whole course slightly wrong and the only remedy was to
 * delete and re-import — throwing away everything ticked off and every card
 * drilled along with the mistake.
 *
 * Saving is explicit rather than as-you-type, which is the opposite of the
 * note editor and deliberately so: a note is yours and a keystroke is cheap,
 * but a half-typed date on a deadline would flow straight into the calendar,
 * the study plan and the overdue count while you were still typing it.
 */
export function EditCourse() {
  const { state, dispatch } = useStore();
  const owned = state.courses.find((c) => c.course.id === state.courseId);
  const [draft, setDraft] = useState<CourseModule | null>(owned ?? null);
  const [saved, setSaved] = useState(false);

  if (!owned || !draft) {
    return (
      <div style={{ padding: 18 }}>
        <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
          <div className="kicker">Not editable</div>
          <div style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5, opacity: 0.8 }}>
            This is one of the four sample courses, which are built into the app rather than held
            in your account. Your own courses — anything imported from a syllabus or added from
            your YES schedule — can be changed here freely.
          </div>
        </Blueprint>
      </div>
    );
  }

  const change = (next: CourseModule) => {
    setDraft(next);
    setSaved(false);
  };
  const field = (patch: Partial<CourseModule['course']>) => change(withCourse(draft, patch));

  const save = () => {
    dispatch({ type: 'replaceCourse', module: draft });
    setSaved(true);
  };

  const dirty = draft !== owned;
  const missing = gaps(draft);
  const note = weightNote(draft.course.grading);

  const text = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder = '',
  ) => (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: 11.5, opacity: 0.55, marginBottom: 4 }}>
        {label}
      </span>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%' }}
      />
    </label>
  );

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 13, opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        Everything a syllabus states, changeable. Dates move, weightings get corrected, rooms
        change — none of that should mean re-importing the course and losing what you have drilled.
      </div>

      {missing.length > 0 && (
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 10, lineHeight: 1.5 }}>
          Currently: {missing.join(', ')}.
        </div>
      )}

      <SectionLabel>The course</SectionLabel>
      {text('Code', draft.course.code, (v) => field({ code: v }), 'ECON 1020')}
      {text('Name', draft.course.name, (v) => field({ name: v }))}
      {text('Professor', draft.course.prof, (v) => field({ prof: v }), 'Dr. …')}
      {text('Their email', draft.course.email, (v) => field({ email: v }))}
      {text('Meets', draft.course.meets, (v) => field({ meets: v }), 'MWF · 9:10–10:00a')}
      {text('Room', draft.course.room, (v) => field({ room: v }), 'Buttrick 101')}
      {text('Credits', draft.course.credits, (v) => field({ credits: v }), '3')}

      <SectionLabel>How the grade is built</SectionLabel>
      {draft.course.grading.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            className="input"
            value={row.what}
            placeholder="Exams"
            onChange={(e) =>
              change(
                withGrading(
                  draft,
                  draft.course.grading.map((g, n) =>
                    n === i ? { ...g, what: e.target.value } : g,
                  ),
                ),
              )
            }
            style={{ flex: 1, minWidth: 0 }}
          />
          <input
            className="input"
            value={row.pct}
            placeholder="40%"
            onChange={(e) =>
              change(
                withGrading(
                  draft,
                  draft.course.grading.map((g, n) => (n === i ? { ...g, pct: e.target.value } : g)),
                ),
              )
            }
            style={{ width: 84, flex: 'none' }}
          />
          <button
            type="button"
            className="bare"
            onClick={() =>
              change(withGrading(draft, draft.course.grading.filter((_, n) => n !== i)))
            }
            aria-label={`Remove ${row.what || 'this row'}`}
            style={{ width: 30, flex: 'none', opacity: 0.5, fontSize: 15 }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => change(withGrading(draft, [...draft.course.grading, { what: '', pct: '' }]))}
        style={{ height: 40, fontSize: 12 }}
      >
        + Add a grading row
      </button>
      {note ? (
        <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 8 }}>{note}</div>
      ) : null}

      <SectionLabel>When it meets</SectionLabel>
      {draft.schedule.map((block, i) => (
        <Blueprint key={i} style={{ padding: '12px 13px', marginBottom: 9 }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
            {DAYS.map((d) => {
              const on = block.days.includes(d.day);
              return (
                <button
                  key={d.day}
                  type="button"
                  className="btn"
                  aria-pressed={on}
                  aria-label={d.label}
                  onClick={() =>
                    change(
                      withSchedule(
                        draft,
                        draft.schedule.map((b, n) =>
                          n === i
                            ? {
                                ...b,
                                days: on
                                  ? b.days.filter((x) => x !== d.day)
                                  : [...b.days, d.day].sort((x, y) => x - y),
                              }
                            : b,
                        ),
                      ),
                    )
                  }
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: 11,
                    background: on ? 'var(--app-accent-wash)' : 'transparent',
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={block.time}
              placeholder="9:10a"
              onChange={(e) =>
                change(
                  withSchedule(
                    draft,
                    draft.schedule.map((b, n) => (n === i ? { ...b, time: e.target.value } : b)),
                  ),
                )
              }
              style={{ width: 92, flex: 'none' }}
            />
            <input
              className="input"
              value={block.title}
              placeholder="Lecture"
              onChange={(e) =>
                change(
                  withSchedule(
                    draft,
                    draft.schedule.map((b, n) => (n === i ? { ...b, title: e.target.value } : b)),
                  ),
                )
              }
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              className="bare"
              onClick={() => change(withSchedule(draft, draft.schedule.filter((_, n) => n !== i)))}
              aria-label="Remove this meeting"
              style={{ width: 30, flex: 'none', opacity: 0.5, fontSize: 15 }}
            >
              ×
            </button>
          </div>
        </Blueprint>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() =>
          change(
            withSchedule(draft, [
              ...draft.schedule,
              { days: [1, 3, 5], at: 540, time: '9:00a', title: 'Lecture', meta: draft.course.room },
            ]),
          )
        }
        style={{ height: 40, fontSize: 12 }}
      >
        + Add a meeting
      </button>
      <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
        The time is written as it appears on screen. The hour grid places a class by it, so
        "9:10a" is understood and "morning" is not.
      </div>

      <SectionLabel>Deadlines</SectionLabel>
      {draft.items.map((i) => (
        <Blueprint key={i.id} style={{ padding: '12px 13px', marginBottom: 9 }}>
          <input
            className="input"
            value={i.title}
            placeholder="What is due"
            onChange={(e) => change(patchItem(draft, i.id, { title: e.target.value }))}
            style={{ width: '100%', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="input"
              type="date"
              value={toInputDate(i.month, i.day, SEMESTER_YEAR)}
              onChange={(e) => {
                const on = fromInputDate(e.target.value);
                if (on) change(patchItem(draft, i.id, on));
              }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <input
              className="input"
              value={i.dueTime}
              placeholder="11:59p"
              onChange={(e) => change(patchItem(draft, i.id, { dueTime: e.target.value }))}
              style={{ width: 92, flex: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              className="input"
              value={KINDS.includes(i.kind) ? i.kind : KINDS[0]}
              onChange={(e) => change(patchItem(draft, i.id, { kind: e.target.value }))}
              style={{ flex: 1, minWidth: 0 }}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              className="input"
              value={i.weight}
              placeholder="15%"
              onChange={(e) => change(patchItem(draft, i.id, { weight: e.target.value }))}
              style={{ width: 84, flex: 'none' }}
            />
            <button
              type="button"
              className="bare"
              onClick={() => change(dropItem(draft, i.id))}
              aria-label={`Remove ${i.title || 'this deadline'}`}
              style={{ width: 30, flex: 'none', opacity: 0.5, fontSize: 15 }}
            >
              ×
            </button>
          </div>
        </Blueprint>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => change(addItem(draft, blankItem(draft.course.id, draft.items)))}
        style={{ height: 40, fontSize: 12 }}
      >
        + Add a deadline
      </button>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={save}
        disabled={!dirty}
        style={{ height: 46, marginTop: 18, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {dirty ? 'Save the changes' : saved ? 'Saved' : 'Nothing changed'}
      </button>
      {dirty ? (
        <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 8, lineHeight: 1.45 }}>
          Nothing is saved until you press that. A half-typed date would otherwise flow straight
          into the calendar and the overdue count while you were still typing it.
        </div>
      ) : null}
      {saved ? (
        <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 10, lineHeight: 1.45 }}>
          Saved. The calendar, Grades, Today and every study mode are using it already. What you
          have ticked off and drilled is untouched.
        </div>
      ) : null}
      <div style={{ height: 26 }} />
    </div>
  );
}
