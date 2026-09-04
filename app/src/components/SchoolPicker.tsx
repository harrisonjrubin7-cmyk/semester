import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { everySchool } from '../data/schools';
import {
  ADDED_LINE,
  ASKS,
  SKIP_LINE,
  hintFor,
  nearDuplicates,
  schoolFrom,
  search,
} from '../lib/findschool';
import { schoolLine, type School } from '../lib/school';

/**
 * Three ways to answer "where do you study", and the third is not a trap.
 *
 * Find it, add it, or skip. The app knows one university properly and will
 * never know all of them, so the second path has to be as good as the first —
 * a school profile is a handful of names, links and yes/no answers, and the
 * person holding those answers is the student.
 *
 * Skipping is offered in a sentence that says what it costs, which is almost
 * nothing: everything that makes this app worth having works without it. A
 * setup step that makes skipping look like a mistake is lying about how much
 * it needs the answer.
 */
export function SchoolPicker() {
  const { state, dispatch, school, account } = useStore();
  const all = useMemo(() => everySchool(state.mySchools), [state.mySchools]);

  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // A hint, never a filter. The list below is the whole list either way.
  const hint = useMemo(() => hintFor(account?.email, all), [account?.email, all]);
  const found = useMemo(() => search(query, all), [query, all]);
  const dupes = useMemo(() => nearDuplicates(name, all), [name, all]);

  const set = (id: string, v: string) => setAnswers({ ...answers, [id]: v });

  const chip = (on: boolean) => ({
    width: 'auto' as const,
    padding: '7px 11px',
    borderRadius: 'var(--r-sm)',
    border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
    background: on ? 'var(--app-accent-wash)' : 'transparent',
    fontSize: 'calc(12px * var(--text-scale, 1))',
  });

  if (adding) {
    const made = schoolFrom(name, answers, all);
    return (
      <div>
        <input
          className="input"
          value={name}
          placeholder="The name of your university"
          aria-label="The name of your university"
          onChange={(e) => setName(e.target.value)}
          style={{ height: 42, fontSize: 'calc(14px * var(--text-scale, 1))' }}
        />

        {/* Offered before the form rather than after it. Without this you get
            eleven versions of Ohio State, and the eleventh is the empty one. */}
        {dupes.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, marginBottom: 6 }}>
              Already here — use one of these instead?
            </div>
            {dupes.map((s) => (
              <button
                key={s.id}
                type="button"
                className="bare tappable"
                onClick={() => {
                  dispatch({ type: 'setSchool', id: s.id });
                  setAdding(false);
                }}
                style={{ ...chip(false), marginRight: 6, marginBottom: 6 }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, margin: '12px 0 4px', lineHeight: 1.45, textWrap: 'pretty' }}>
          Every question below is optional. Anything left alone stays switched off, and nothing here
          is permanent.
        </div>

        {ASKS.map((a) => (
          <div key={a.id} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.4, textWrap: 'pretty' }}>
              {a.ask}
            </div>
            {a.note && (
              <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5, marginTop: 3, lineHeight: 1.4 }}>
                {a.note}
              </div>
            )}
            {a.kind === 'choice' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                {a.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="bare tappable"
                    onClick={() => set(a.id, answers[a.id] === o.id ? '' : o.id)}
                    style={chip(answers[a.id] === o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            {a.kind === 'yesno' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                {['yes', 'no'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="bare tappable"
                    onClick={() => set(a.id, answers[a.id] === v ? '' : v)}
                    style={chip(answers[a.id] === v)}
                  >
                    {v === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            )}
            {(a.kind === 'text' || a.kind === 'url') && (
              <input
                className="input"
                value={answers[a.id] ?? ''}
                placeholder={a.placeholder}
                aria-label={a.ask}
                inputMode={a.kind === 'url' ? 'url' : 'text'}
                onChange={(e) => set(a.id, e.target.value)}
                style={{ height: 38, marginTop: 7, fontSize: 'calc(13px * var(--text-scale, 1))' }}
              />
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAdding(false)}
            style={{ flex: 1, height: 44, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Back
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={made === null}
            onClick={() => {
              if (!made) return;
              dispatch({ type: 'addSchool', school: made });
              setAdding(false);
              setName('');
              setAnswers({});
            }}
            style={{
              flex: 1,
              height: 44,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: made === null ? 0.45 : 1,
            }}
          >
            {made === null ? 'Name it first' : 'Add it'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <input
        className="input"
        value={query}
        placeholder="Search for your school"
        aria-label="Search for your school"
        onChange={(e) => setQuery(e.target.value)}
        style={{ height: 42, fontSize: 'calc(14px * var(--text-scale, 1))' }}
      />

      {hint && hint.id !== state.schoolId && (
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 8, lineHeight: 1.45 }}>
          {/* Suggested from the address you signed in with. Never enforced —
              plenty of students sign in with a personal address, and plenty of
              people have one at a school they left. */}
          Your email suggests {hint.name}.{' '}
          <button
            type="button"
            className="bare"
            onClick={() => dispatch({ type: 'setSchool', id: hint.id })}
            style={{ width: 'auto', textDecoration: 'underline', fontSize: 'inherit' }}
          >
            Use it
          </button>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        {found.map((s: School) => (
          <Row
            key={s.id}
            school={s}
            on={state.schoolId === s.id}
            onPick={() => dispatch({ type: 'setSchool', id: s.id })}
            onForget={
              state.mySchools.some((m) => m.id === s.id)
                ? () => dispatch({ type: 'forgetSchool', id: s.id })
                : undefined
            }
          />
        ))}
        {found.length === 0 && (
          <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, padding: '6px 0', lineHeight: 1.45 }}>
            Nothing here by that name. Add it — it takes about a minute, and every question is
            optional.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="bare tappable"
          onClick={() => {
            setName(query);
            setAdding(true);
          }}
          style={{ ...chip(false), fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 'calc(11px * var(--text-scale, 1))' }}
        >
          Mine is not listed
        </button>
        {state.schoolId !== '' && (
          <button
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'setSchool', id: '' })}
            style={{ ...chip(false), fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.7 }}
          >
            Set no school
          </button>
        )}
      </div>

      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 10, lineHeight: 1.45, textWrap: 'pretty' }}>
        {state.schoolId === '' ? SKIP_LINE : schoolLine(school)}
      </div>
    </div>
  );
}

function Row({
  school,
  on,
  onPick,
  onForget,
}: {
  school: School;
  on: boolean;
  onPick: () => void;
  onForget?: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        className="bare tappable"
        onClick={onPick}
        aria-pressed={on}
        style={{
          flex: 1,
          textAlign: 'left',
          padding: '10px 11px',
          borderRadius: 'var(--r-sm)',
          border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
          background: on ? 'var(--app-accent-wash)' : 'transparent',
          marginBottom: 7,
        }}
      >
        <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>{school.name}</div>
        {!school.verified && (
          <div style={{ fontSize: 'calc(10.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 2 }}>
            {ADDED_LINE}
          </div>
        )}
      </button>
      {onForget && (
        <button
          type="button"
          className="bare tappable"
          onClick={onForget}
          aria-label={`Forget ${school.name}`}
          style={{
            width: 'auto',
            padding: '8px 10px',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--app-line)',
            fontSize: 'calc(11px * var(--text-scale, 1))',
            opacity: 0.6,
            marginBottom: 7,
          }}
        >
          Forget
        </button>
      )}
    </div>
  );
}
