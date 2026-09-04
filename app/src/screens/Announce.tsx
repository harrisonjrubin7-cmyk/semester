import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { ask, configured, provider } from '../lib/claude';
import {
  SYSTEM,
  apply,
  brief,
  describe,
  readChanges,
  summary,
  type Change,
} from '../lib/announce';

/**
 * "The midterm has moved to the 8th."
 *
 * The calendar feed carries dates; the thing that changes a date is an
 * announcement, and it arrives as prose in an inbox. So the app was
 * confidently a week out of date about a course and nothing said so.
 *
 * Paste it. Every proposed change quotes the sentence it rests on, nothing is
 * applied until it is ticked, and the machinery underneath is the same
 * comparison that already handles a re-imported syllabus — so a moved
 * deadline keeps its id, and the box you ticked stays ticked.
 */
export function Announce() {
  const { state, dispatch, catalog } = useStore();

  const [courseId, setCourseId] = useState(state.courseId || catalog.courses[0]?.id || '');
  const [text, setText] = useState('');
  const [found, setFound] = useState<Change[] | null>(null);
  const [taken, setTaken] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const trouble = useTrouble();
  const [done, setDone] = useState('');
  const abort = useRef<AbortController | null>(null);

  const module_ = state.courses.find((c) => c.course.id === courseId);
  const shown = catalog.moduleById[courseId];

  const read = async () => {
    if (!shown || busy) return;
    setBusy(true);
    trouble.clear();
    setFound(null);
    setDone('');
    abort.current = new AbortController();
    let sofar = '';
    try {
      await ask({
        signal: abort.current.signal,
        maxTokens: 2000,
        system: SYSTEM,
        messages: [{ role: 'user', content: brief(shown, text) }],
        onText: (chunk) => {
          sofar += chunk;
        },
      });
      const changes = readChanges(sofar, shown);
      setFound(changes);
      setTaken(Object.fromEntries(changes.map((_, i) => [i, true])));
    } catch (e) {
      trouble.failed(e, () => void read());
    } finally {
      setBusy(false);
    }
  };

  const keep = () => {
    if (!module_ || !found) return;
    const accepted = found.filter((_, i) => taken[i]);
    if (accepted.length === 0) return;
    dispatch({ type: 'replaceCourse', module: apply(module_, accepted) });
    setDone(summary(accepted));
    setFound(null);
    setText('');
  };

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        A calendar feed carries dates. The email that <em>changes</em> a date never reaches the app,
        so the app can be a week out and say nothing. Paste it here instead.
      </div>

      <SectionLabel>Which course</SectionLabel>
      <select
        className="input"
        value={courseId}
        aria-label="Which course"
        onChange={(e) => {
          setCourseId(e.target.value);
          setFound(null);
          setDone('');
        }}
        style={{ width: '100%' }}
      >
        {catalog.courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.name}
          </option>
        ))}
      </select>
      {!module_ && shown ? (
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 6, lineHeight: 1.45 }}>
          This is one of the sample courses, which are built into the app. Changes can be read out
          of an announcement but not saved against it.
        </div>
      ) : null}

      <SectionLabel>The announcement</SectionLabel>
      <textarea
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Paste the email or the course-page post.\n\n“Midterm 2 has been moved to Wednesday October 8, in class. Problem Set 5 is cancelled.”'}
        style={{ width: '100%', minHeight: 150, resize: 'vertical', lineHeight: 1.5 }}
      />

      {configured() ? (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => void read()}
          disabled={busy || !text.trim()}
          style={{ height: 46, marginTop: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          {busy ? 'Reading it…' : 'What does this change?'}
        </button>
      ) : (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 12, lineHeight: 1.5 }}>
          Needs a key first — set one under Ask Claude → Settings.
        </div>
      )}

      <Trouble said={trouble.said} onRetry={trouble.again} />

      {done ? (
        <Blueprint style={{ padding: '13px 14px', marginTop: 14 }}>
          <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.4 }}>Applied: {done}.</div>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => dispatch({ type: 'openCourse', id: courseId })}
            style={{ height: 38, marginTop: 9, fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
          >
            See the course
          </button>
        </Blueprint>
      ) : null}

      {found && (
        <>
          <SectionLabel>
            {found.length === 0 ? 'Nothing changed' : `${found.length} proposed`}
          </SectionLabel>
          {found.length === 0 ? (
            <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5 }}>
              Nothing in that changes a deadline — which is a perfectly ordinary answer for an
              announcement about a room, a reading or a reminder.
            </div>
          ) : (
            <>
              {found.map((c, i) => (
                <button
                  key={`${c.op}-${c.itemId}-${c.quote.slice(0, 24)}`}
                  type="button"
                  className="bare tappable"
                  aria-pressed={taken[i] ?? false}
                  onClick={() => setTaken((was) => ({ ...was, [i]: !was[i] }))}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '11px 12px',
                    marginBottom: 7,
                    borderRadius: 'var(--r-md)',
                    border: `1px solid ${taken[i] ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                    background: taken[i] ? 'var(--app-accent-wash)' : 'transparent',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.35 }}>
                    {shown ? describe(c, shown) : ''}
                  </span>
                  {/* The sentence it rests on. This is the whole safety of it —
                      a change you cannot check is a change you should not take. */}
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'calc(12px * var(--text-scale, 1))',
                      opacity: 0.6,
                      marginTop: 6,
                      paddingLeft: 9,
                      borderLeft: '2px solid var(--app-line)',
                      lineHeight: 1.45,
                    }}
                  >
                    “{c.quote}”
                  </span>
                </button>
              ))}

              {module_ ? (
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={keep}
                  disabled={Object.values(taken).every((v) => !v)}
                  style={{ height: 46, marginTop: 10 }}
                >
                  Apply the {Object.values(taken).filter(Boolean).length} ticked
                </button>
              ) : (
                <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 10, lineHeight: 1.45 }}>
                  Nothing to apply them to — this is a sample course.
                </div>
              )}
            </>
          )}
        </>
      )}

      <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 14, lineHeight: 1.45 }}>
        {provider()} may only propose a date the announcement states, and every row quotes the
        sentence it came from — anything it cannot quote is dropped before you see it. A moved
        deadline keeps its id, so a box you already ticked stays ticked.
      </div>
      <div style={{ height: 26 }} />
    </div>
  );
}
