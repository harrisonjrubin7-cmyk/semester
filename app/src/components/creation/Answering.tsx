import { visibleQuestions } from '../../lib/creations';
import type { FormData } from '../../lib/creations';
import { secondLine } from '../../lib/dim';

/**
 * The questions, as somebody answering them sees them.
 *
 * Lifted out of `FormBuilder` when forms became publishable, because there
 * are now two places a form is filled in — the author's preview and a
 * respondent's page, which is a different page on a different device and, for
 * a respondent with no account, the only part of this app they will ever
 * see. Two renderers would have drifted, and the one that drifted would have
 * been the one nobody on the project ever looks at.
 *
 * It renders questions and nothing else: no title, no submit button, no
 * notion of where the answers go. `visibleQuestions` decides what a branching
 * condition is currently showing, from the answers given so far, which is why
 * this is driven by the whole answer map rather than by one question at a
 * time.
 */
const CHOICE_TYPES = ['Multiple choice', 'Dropdown', 'Rating'];

export function Answering({
  form,
  answers,
  setAnswers,
}: {
  form: FormData;
  answers: Record<string, string>;
  setAnswers: (next: (a: Record<string, string>) => Record<string, string>) => void;
}) {
  const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' } as const;
  const panel = {
    border: '1px solid var(--app-line)',
    borderRadius: 'var(--r-md)',
    padding: 'var(--sp-5)',
    marginBlock: 'var(--sp-4)',
    minWidth: 0,
  } as const;

  return (
    <>
      {visibleQuestions(form, answers).map((q) => (
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
    </>
  );
}
