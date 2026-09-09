import { useState } from 'react';
import { useStore } from '../state/store';
import { has } from '../lib/search';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { STANCES, stanceLine } from '../lib/essay';
import { readClock } from '../lib/officehours';
import { SEASONS, readTerm, termId, yearFor } from '../lib/term';
import { MONTHS } from '../lib/date';
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
  const { state, dispatch, adopt } = useStore();
  const owned = state.courses.find((c) => c.course.id === state.courseId);
  const [draft, setDraft] = useState<CourseModule | null>(owned ?? null);
  const [saved, setSaved] = useState(false);
  /**
   * Which course the draft above is a draft *of*.
   *
   * The initialiser runs once, on the first render of this screen, which was
   * fine while the only way to arrive was with the course already in hand.
   * Two things now change the course underneath a mounted editor: taking the
   * shipped semester on from the button below, and opening a second course
   * without the screen unmounting in between. Both left the editor holding a
   * stale draft — in the first case a permanently null one, so the screen went
   * on refusing to edit a course the person had just adopted.
   *
   * Re-seeding during render rather than in an effect: an effect would paint
   * one frame of the wrong course first, and this is the pattern React
   * documents for state that has to follow something outside it.
   */
  const [draftOf, setDraftOf] = useState<string | undefined>(owned?.course.id);
  if (owned && owned.course.id !== draftOf) {
    setDraftOf(owned.course.id);
    setDraft(owned);
    setSaved(false);
  }

  /*
   * A shipped course is compiled in, so there is nothing here to edit — but
   * that is a fact about where it is stored, not a refusal, and the screen
   * used to read as one. For the person the app was built for these four are
   * their real semester, and "not editable" told them their own courses were
   * off limits with no way out.
   *
   * One button is the way out. Taking the shipped semester on copies all four
   * into the account as ordinary courses, keeping their ids — so every tick,
   * grade and card already filed against them stays filed — and this screen
   * is then editing the course the person asked to edit.
   */
  if (!owned || !draft) {
    return (
      <Page>
        <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
          <div className="kicker">Shipped with the app</div>
          <div style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)', opacity: 0.8 }}>
            This course is built into the app rather than held in your account, which is why there
            is nothing to change yet. Take the semester on and all four become yours — editable,
            shareable, and keeping everything you have already ticked off.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            /*
             * No navigation. This *is* the edit screen: `adopt()` makes the
             * course an owned one, `owned` becomes truthy on the next render
             * and the editor below draws. Going to `edit` from `edit` pushed a
             * history entry, so Back landed somebody back on the screen they
             * had just pressed Back from.
             */
            onClick={adopt}
            style={{
              height: 46,
              marginTop: 14,
              fontSize: 'var(--type-sm)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Make these mine
          </button>
        </Blueprint>
      </Page>
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
    <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
      <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginBottom: 'var(--sp-2)' }}>
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
    <Page
      bottom={26}
      /*
       * The deadline list is the long part of this screen — a semester's
       * syllabus is twenty-odd rows, each an editable form — and the reason
       * anybody opens it is usually one of them: the date that moved, the
       * essay whose weighting is wrong. Scrolling twenty forms to find it is
       * the errand, not the edit.
       */
      search={{
        placeholder: 'Find a deadline to change',
        select: () => draft.items,
        // The month and day as they are written on the row, so "oct" and
        // "14" find the same deadline the row shows — an `Item` keeps them as
        // numbers, not as a date string.
        match: (i, q) =>
          has(q, i.title, i.kind, MONTHS[i.month] ?? '', String(i.day), i.dueTime, i.where, i.weight),
        empty: (q) => `No deadline on this syllabus matches “${q}”. The rest of the screen is below.`,
      }}
    >
      {(shownItems, query) => (
    <>
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        Everything a syllabus states, changeable. Dates move, weightings get corrected, rooms
        change — none of that should mean re-importing the course and losing what you have drilled.
      </div>

      {missing.length > 0 && (
        <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-relaxed)' }}>
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

      <SectionLabel>Which term</SectionLabel>
      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        <input
          className="input"
          type="number"
          aria-label="Year"
          value={readTerm(draft.course.term).year}
          onChange={(e) =>
            field({ term: termId(Number(e.target.value), readTerm(draft.course.term).id.slice(4)) })
          }
          style={{ width: 96, flex: 'none' }}
        />
        <select
          className="input"
          aria-label="Season"
          value={readTerm(draft.course.term).id.slice(4)}
          onChange={(e) => field({ term: termId(readTerm(draft.course.term).year, e.target.value) })}
          style={{ flex: 1, minWidth: 0 }}
        >
          {SEASONS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
        The term decides which year this course's dates fall in, and keeps last semester out of
        Today without deleting it. Courses added before this existed are filed under Fall 2026,
        which is what their dates are.
      </div>

      <SectionLabel>What the syllabus says about AI</SectionLabel>
      <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--sp-5)' }}>
        Recorded here, and read by the drafting tool, which will not write for a course unless
        this says plainly that it may. Nothing recorded counts as no.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 'var(--sp-5)' }}>
        {STANCES.map((option) => {
          const on = (draft.course.ai?.stance ?? 'unstated') === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className="bare tappable"
              aria-pressed={on}
              onClick={() =>
                field({ ai: { stance: option.id, note: draft.course.ai?.note ?? '' } })
              }
              style={{
                textAlign: 'left',
                padding: '9px 12px',
                borderRadius: 'var(--r-md)',
                border: `1px solid ${on ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                background: on ? 'var(--app-accent-wash)' : 'transparent',
              }}
            >
              <span style={{ display: 'block', fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>{option.label}</span>
              <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-1)' }}>
                {stanceLine(option.id)}
              </span>
            </button>
          );
        })}
      </div>
      <textarea
        className="input"
        value={draft.course.ai?.note ?? ''}
        placeholder="The rule in the syllabus’s own words, so you can check it later."
        onChange={(e) =>
          field({ ai: { stance: draft.course.ai?.stance ?? 'unstated', note: e.target.value } })
        }
        style={{ width: '100%', minHeight: 70, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
      />

      <SectionLabel>How the grade is built</SectionLabel>
      {draft.course.grading.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
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
            style={{ width: 30, flex: 'none', opacity: 0.5, fontSize: 'var(--type-lg)' }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => change(withGrading(draft, [...draft.course.grading, { what: '', pct: '' }]))}
        style={{ height: 40, fontSize: 'var(--type-sm)' }}
      >
        + Add a grading row
      </button>
      {note ? (
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 'var(--sp-4)' }}>{note}</div>
      ) : null}

      <SectionLabel>When it meets</SectionLabel>
      {draft.schedule.map((block, i) => (
        <Blueprint plain key={i} style={{ padding: '12px 13px', marginBottom: 9 }}>
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
                    fontSize: 'var(--type-xs)',
                    background: on ? 'var(--app-accent-wash)' : 'transparent',
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <input
              className="input"
              value={block.time}
              placeholder="9:10a"
              aria-label="Start time"
              onChange={(e) =>
                change(
                  withSchedule(
                    draft,
                    draft.schedule.map((b, n) => {
                      if (n !== i) return b;
                      // The grid places a block by `at`, not by `time`. Retyping
                      // the time used to leave `at` on whatever it was, so every
                      // block added by hand sat at 9am however it was labelled.
                      // A time the parser cannot read leaves `at` alone rather
                      // than moving the block to midnight mid-keystroke.
                      const at = readClock(e.target.value);
                      return { ...b, time: e.target.value, at: at ?? b.at };
                    }),
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
              style={{ width: 30, flex: 'none', opacity: 0.5, fontSize: 'var(--type-lg)' }}
            >
              ×
            </button>
          </div>
        </Blueprint>
      ))}
      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            change(
              withSchedule(draft, [
                ...draft.schedule,
                { days: [1, 3, 5], at: 540, time: '9:00a', title: 'Lecture', meta: draft.course.room },
              ]),
            )
          }
          style={{ flex: 1, height: 40, fontSize: 'var(--type-sm)' }}
        >
          + Add a meeting
        </button>
        {/*
          Office hours are on every syllabus and were on none of the courses,
          because putting them in meant knowing that a schedule block with
          `optional` set is what the app calls them. This is that, as a button.
        */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            change(
              withSchedule(draft, [
                ...draft.schedule,
                {
                  days: [2],
                  at: 14 * 60,
                  time: '2:00p',
                  title: `${draft.course.prof || 'Office'} office hours`.trim(),
                  meta: draft.course.room,
                  optional: true,
                },
              ]),
            )
          }
          style={{ flex: 1, height: 40, fontSize: 'var(--type-sm)' }}
        >
          + Office hours
        </button>
      </div>
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
        The time is written as it appears on screen, and the hour grid places a block by it — so
        "9:10a" and "2:45p" are understood and "morning" is not. Office hours sit dimmer on the
        rail than a class, and are what the app watches when it notices a course going badly.
      </div>

      <SectionLabel>
        Deadlines{query && shownItems.length !== draft.items.length ? ` · ${shownItems.length} of ${draft.items.length}` : ''}
      </SectionLabel>
      {shownItems.map((i) => (
        <Blueprint plain key={i.id} style={{ padding: '12px 13px', marginBottom: 9 }}>
          <input
            className="input"
            value={i.title}
            placeholder="What is due"
            onChange={(e) => change(patchItem(draft, i.id, { title: e.target.value }))}
            style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
          />
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
            <input
              className="input"
              type="date"
              value={toInputDate(i.month, i.day, yearFor(readTerm(draft.course.term), i.month))}
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
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
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
              style={{ width: 30, flex: 'none', opacity: 0.5, fontSize: 'var(--type-lg)' }}
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
        style={{ height: 40, fontSize: 'var(--type-sm)' }}
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
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
          Nothing is saved until you press that. A half-typed date would otherwise flow straight
          into the calendar and the overdue count while you were still typing it.
        </div>
      ) : null}
      {saved ? (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.75, marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
          Saved. The calendar, Grades, Today and every study mode are using it already. What you
          have ticked off and drilled is untouched.
        </div>
      ) : null}
    </>
      )}
    </Page>
  );
}
