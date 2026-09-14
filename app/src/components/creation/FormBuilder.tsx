import { useState } from 'react';
import { useStore } from '../../state/store';
import { ActionButton, SectionLabel, Segmented } from '../ui';
import { secondLine } from '../../lib/dim';
import { download } from '../../lib/deliver';
import { fromRows, toCsv } from '../../lib/sheet';
import {
  QUESTION_TYPES,
  formResponse,
  newQuestion,
  responseRows,
  visibleQuestions,
  type CreativeProject,
  type FormData,
  type Question,
} from '../../lib/creations';

/**
 * A form, filled in on the same device that built it.
 *
 * Which is the limitation to be honest about first: there is no link to send
 * anybody. Responses come from whoever is holding this phone, and the notice
 * says so. What it is genuinely good for is the thing a student does need —
 * a practice quiz over their own material, or a set of questions to work
 * through — and for that, "on this device" is not a compromise at all.
 *
 * ## Questions lock once anybody has answered
 *
 * Editing a question after a response exists silently changes what that
 * response means: an option removed, a mark key altered, and the recorded
 * answers now refer to a form that no longer exists. So the question editor
 * disables itself and offers a duplicate instead, which is the one operation
 * that keeps both the old data and the new intention intact.
 *
 * ## The linked sheet is managed
 *
 * Creating a response sheet makes a real spreadsheet in the app's own
 * library, and linking it means this form rewrites its cells on every new
 * response. That is why the note says to analyse a *copy*: edits to the
 * linked sheet are overwritten, by design, because it is a view of the
 * responses rather than a document.
 *
 * Every value that reaches a cell goes through `sheetText` in
 * `lib/creations.ts` — response text is typed by other people, and a cell
 * beginning `=` is a formula.
 */

const TABS = [
  { id: 'questions' as const, label: 'Build' },
  { id: 'preview' as const, label: 'Fill' },
  { id: 'responses' as const, label: 'Answers' },
  { id: 'settings' as const, label: 'Settings' },
];

type Tab = (typeof TABS)[number]['id'];

const CHOICE_TYPES = ['Multiple choice', 'Dropdown', 'Rating'];
const OPTION_TYPES = ['Multiple choice', 'Checkboxes', 'Dropdown'];

export function FormBuilder({
  project,
  onChange,
}: {
  project: CreativeProject;
  onChange: (patch: Partial<CreativeProject>) => boolean;
}) {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<Tab>('questions');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  const f = project.form;
  /* One response is enough to freeze the questions. See above. */
  const locked = !!f.responses.length;

  const change = (patch: Partial<FormData>) => onChange({ form: { ...f, ...patch } });
  const patch = (id: string, p: Partial<Question>) =>
    change({ questions: f.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) });

  const submit = () => {
    try {
      const response = formResponse(f, answers);
      const next = { ...f, responses: [...f.responses, response] };
      if (!onChange({ form: next })) {
        throw new Error('That response could not be saved. Your answers are still here to try again.');
      }
      const sheet = state.sheets.find((s) => s.id === f.sheetId);
      if (sheet) {
        const built = fromRows(sheet.title, responseRows({ ...project, form: next }), sheet.courseId);
        dispatch({ type: 'updateSheet', id: sheet.id, patch: { cells: built.cells, rows: built.rows, cols: built.cols } });
      }
      setAnswers({});
      setNotice(
        `Recorded on this device.${
          f.quiz ? ` Marked ${response.score}/${response.possible} — questions with no answer key are not counted.` : ''
        }`,
      );
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const line = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
  const field = { display: 'block', marginBottom: 'var(--sp-5)' } as const;
  const input = { width: '100%', marginTop: 'var(--sp-2)' } as const;
  const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' } as const;
  const panel = {
    border: '1px solid var(--app-line)',
    borderRadius: 'var(--r-md)',
    padding: 'var(--sp-5)',
    marginBlock: 'var(--sp-4)',
    minWidth: 0,
  } as const;

  return (
    <div>
      <Segmented
        options={TABS.map((t) => ({
          id: t.id,
          label: t.id === 'responses' ? `${t.label} (${f.responses.length})` : t.label,
        }))}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setNotice('');
        }}
        style={{ marginBlock: 'var(--sp-5)' }}
      />
      <p style={{ ...line, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
        This form lives on this device, and so do its answers. Sending a link, knowing who replied, and
        anything that counts for a grade all need your school's own form service.
      </p>
      {notice && (
        <p role="status" style={{ ...body, ...panel, textWrap: 'pretty' }}>
          {notice}
        </p>
      )}

      {tab === 'questions' && (
        <>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Introduction</span>
            <textarea
              rows={3}
              maxLength={4000}
              value={f.description}
              onChange={(e) => change({ description: e.target.value })}
              style={input}
            />
          </label>

          {locked && (
            <p style={{ ...body, ...panel, textWrap: 'pretty' }}>
              The questions are locked, because answers have been recorded against them. Duplicate this
              project to build a revised form without changing what those answers meant.
            </p>
          )}

          {f.questions.map((q, index) => (
            <fieldset key={q.id} disabled={locked} style={{ ...panel, border: '1px solid var(--app-line)' }}>
              <SectionLabel style={{ marginBlock: '0 var(--sp-4)' }}>Question {index + 1}</SectionLabel>
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Ask</span>
                <input
                  value={q.title}
                  maxLength={300}
                  onChange={(e) => patch(q.id, { title: e.target.value })}
                  style={input}
                />
              </label>
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Answer type</span>
                <select
                  value={q.type}
                  // The key is cleared with the type: an answer for a dropdown
                  // is not an answer for a date.
                  onChange={(e) => patch(q.id, { type: e.target.value as Question['type'], answer: '' })}
                  style={input}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', ...body, marginBottom: 'var(--sp-5)' }}>
                <input type="checkbox" checked={q.required} onChange={(e) => patch(q.id, { required: e.target.checked })} />
                <span>Required</span>
              </label>

              {OPTION_TYPES.includes(q.type) && (
                <label style={field}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Options, one per line</span>
                  <textarea
                    rows={3}
                    value={q.options.join('\n')}
                    onChange={(e) =>
                      patch(q.id, {
                        options: e.target.value.split('\n').slice(0, 20).map((s) => s.slice(0, 200)),
                      })
                    }
                    style={input}
                  />
                </label>
              )}

              {f.quiz && (
                <>
                  <label style={field}>
                    <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Answer key</span>
                    <input
                      value={q.answer}
                      maxLength={1000}
                      onChange={(e) => patch(q.id, { answer: e.target.value })}
                      style={input}
                    />
                  </label>
                  <label style={field}>
                    <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Points</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={q.points}
                      onChange={(e) => patch(q.id, { points: Math.max(0, Math.min(100, Number(e.target.value))) })}
                      style={input}
                    />
                  </label>
                </>
              )}

              {index > 0 && (
                <details style={{ marginBottom: 'var(--sp-4)' }}>
                  <summary style={{ ...line, cursor: 'pointer' }}>Only show this sometimes</summary>
                  <label style={{ ...field, marginTop: 'var(--sp-4)' }}>
                    <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>When an earlier answer was</span>
                    <select
                      value={q.condition?.questionId || ''}
                      onChange={(e) =>
                        patch(q.id, { condition: e.target.value ? { questionId: e.target.value, equals: '' } : null })
                      }
                      style={input}
                    >
                      <option value="">Always show it</option>
                      {/* Earlier questions only — a condition on a later one
                          would be a cycle, which `readCreations` refuses. */}
                      {f.questions.slice(0, index).map((prev) => (
                        <option key={prev.id} value={prev.id}>
                          {prev.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {q.condition && (
                    <label style={field}>
                      <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Exactly</span>
                      <input
                        value={q.condition.equals}
                        maxLength={200}
                        onChange={(e) => patch(q.id, { condition: { ...q.condition!, equals: e.target.value } })}
                        style={input}
                      />
                    </label>
                  )}
                </details>
              )}

              <ActionButton
                onClick={() =>
                  change({
                    // Anything that depended on this question loses its
                    // condition rather than being left pointing at nothing.
                    questions: f.questions
                      .filter((x) => x.id !== q.id)
                      .map((x) => (x.condition?.questionId === q.id ? { ...x, condition: null } : x)),
                  })
                }
              >
                Remove
              </ActionButton>
            </fieldset>
          ))}

          <ActionButton
            tone="primary"
            disabled={locked || f.questions.length >= 20}
            onClick={() => change({ questions: [...f.questions, newQuestion()] })}
          >
            Add a question
          </ActionButton>
        </>
      )}

      {tab === 'preview' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <SectionLabel style={{ marginBlock: '0 var(--sp-4)' }}>{project.title}</SectionLabel>
          {f.description && <p style={{ ...body, marginBottom: 'var(--sp-5)' }}>{f.description}</p>}

          {visibleQuestions(f, answers).map((q) => (
            <fieldset key={q.id} style={panel}>
              <legend style={{ fontSize: 'var(--type-sm)', ...secondLine(), padding: '0 var(--sp-3)' }}>
                {q.title}
                {q.required ? ' *' : ''}
              </legend>
              {q.type === 'Paragraph' ? (
                <textarea
                  aria-label={q.title}
                  required={q.required}
                  rows={4}
                  maxLength={5000}
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  style={{ width: '100%' }}
                />
              ) : q.type === 'Checkboxes' ? (
                q.options.map((o, i) => (
                  <label
                    key={i}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', paddingBlock: 'var(--sp-2)', ...body }}
                  >
                    <input
                      type="checkbox"
                      checked={(answers[q.id] || '').split('\n').includes(o)}
                      onChange={(e) =>
                        setAnswers((a) => ({
                          ...a,
                          [q.id]: e.target.checked
                            ? [...(a[q.id] || '').split('\n').filter(Boolean), o].join('\n')
                            : (a[q.id] || '')
                                .split('\n')
                                .filter((x) => x !== o)
                                .join('\n'),
                        }))
                      }
                    />
                    <span>{o}</span>
                  </label>
                ))
              ) : CHOICE_TYPES.includes(q.type) ? (
                <select
                  aria-label={q.title}
                  required={q.required}
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <option value="">Choose…</option>
                  {(q.type === 'Rating' ? ['1', '2', '3', '4', '5'] : q.options).map((o, i) => (
                    <option key={i}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={q.title}
                  type={q.type === 'Date' ? 'date' : q.type === 'Time' ? 'time' : q.type === 'Number' ? 'number' : 'text'}
                  step="any"
                  required={q.required}
                  maxLength={5000}
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  style={{ width: '100%' }}
                />
              )}
            </fieldset>
          ))}

          <button type="submit" className="btn btn-primary btn-block" disabled={!f.questions.length}>
            Record this response
          </button>
        </form>
      )}

      {tab === 'responses' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <ActionButton
              disabled={!f.responses.length}
              onClick={() =>
                download({
                  name: `${project.title} responses.csv`,
                  body: toCsv(responseRows(project)),
                  mime: 'text/csv',
                })
              }
              style={{ flex: '1 1 auto' }}
            >
              Download CSV
            </ActionButton>
            <ActionButton
              disabled={!f.responses.length}
              onClick={() => {
                const sheet = fromRows(`${project.title} · Responses`, responseRows(project), project.courseId || null);
                dispatch({ type: 'makeSheet', sheet: { ...sheet, itemId: project.itemId || null } });
                setNotice('Sheet created. Link it below and this form will keep it up to date.');
              }}
              style={{ flex: '1 1 auto' }}
            >
              Make a sheet
            </ActionButton>
          </div>

          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Keep a sheet up to date</span>
            <select value={f.sheetId || ''} onChange={(e) => change({ sheetId: e.target.value || null })} style={input}>
              <option value="">No linked sheet</option>
              {state.sheets
                .filter((s) => s.title === `${project.title} · Responses` || s.id === f.sheetId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
            </select>
          </label>
          <p style={{ ...line, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
            A linked sheet is rewritten by this form on every response, so work on a copy if you want to
            change its cells.
          </p>

          {f.responses.length === 0 ? (
            <p style={{ ...body, ...secondLine() }}>Answers appear here once the form has been filled in.</p>
          ) : (
            f.questions.map((q) => (
              <section key={q.id} style={panel}>
                <SectionLabel style={{ marginBlock: 0 }}>{q.title}</SectionLabel>
                {CHOICE_TYPES.includes(q.type) ? (
                  (q.type === 'Rating' ? ['1', '2', '3', '4', '5'] : q.options).map((o, i) => {
                    const n = f.responses.filter((r) => r.answers[q.id] === o).length;
                    return (
                      <div
                        key={i}
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', paddingBlock: 'var(--sp-2)', ...body }}
                      >
                        <span style={{ flex: '0 0 30%', minWidth: 0 }}>{o}</span>
                        <meter
                          min={0}
                          max={Math.max(1, f.responses.length)}
                          value={n}
                          aria-label={`${o}: ${n} responses`}
                          style={{ flex: 1 }}
                        />
                        <span style={secondLine()}>{n}</span>
                      </div>
                    );
                  })
                ) : (
                  <ul style={{ margin: 'var(--sp-3) 0 0', paddingLeft: 'var(--sp-7)' }}>
                    {f.responses.map((r) => (
                      <li key={r.id} style={{ ...body, paddingBlock: 'var(--sp-2)' }}>
                        {r.answers[q.id] || <span style={secondLine()}>No answer</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </>
      )}

      {tab === 'settings' && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', ...body, marginBottom: 'var(--sp-5)' }}>
            <input type="checkbox" checked={f.accepting} onChange={(e) => change({ accepting: e.target.checked })} />
            <span>Accept responses</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', ...body, marginBottom: 'var(--sp-5)' }}>
            <input
              type="checkbox"
              checked={f.quiz}
              disabled={locked}
              onChange={(e) => change({ quiz: e.target.checked })}
            />
            <span>Mark it against an answer key</span>
          </label>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Opens</span>
            <input type="date" value={f.opens} onChange={(e) => change({ opens: e.target.value })} style={input} />
          </label>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Closes</span>
            <input type="date" value={f.closes} onChange={(e) => change({ closes: e.target.value })} style={input} />
          </label>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>At most</span>
            <input
              type="number"
              min={1}
              max={150}
              value={f.limit}
              onChange={(e) => change({ limit: Math.max(1, Math.min(150, Number(e.target.value) || 1)) })}
              style={input}
            />
          </label>
          <p style={{ ...line, textWrap: 'pretty' }}>
            Nothing here records who answered, because there is no identity to record — that is not the same
            as a verified anonymous survey, and it should not be relied on as one. The dates are this
            device's calendar days.
          </p>
        </>
      )}
    </div>
  );
}
