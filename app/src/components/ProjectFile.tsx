import { useMemo, useRef, useState } from 'react';
import { Blueprint } from './Blueprint';
import { SectionLabel } from './ui';
import { PrintButton } from './PrintButton';
import { ask } from '../lib/claude';
import { download } from '../lib/deliver';
import { useStore } from '../state/store';
import {
  SHAPES,
  SYSTEM,
  blanks,
  brief,
  fileName,
  header,
  runway,
  schedule,
  shape as shapeById,
} from '../lib/project';
import type { CourseId } from '../lib/types';
import { asLines, forCourse } from '../lib/sources';

/**
 * The document you write the essay in.
 *
 * Not the essay. The distinction is the whole feature and the screen says it
 * once: what comes back is headings, the question each section has to answer,
 * a source table holding your sources, the rubric as a checklist, and blanks
 * where your claims go. The blanks are the point — a file that arrived already
 * filled in would be an essay with extra steps.
 *
 * That is not a consolation prize either. Marks go to a thesis that is a topic
 * rather than an argument, to paragraphs that summarise a source instead of
 * using it, and to a bibliography assembled at 2am. None of those are fixed by
 * having better sentences written for you.
 *
 * The schedule is arithmetic done in `lib/project.ts` rather than by the
 * model, and handed over as fixed text — a model asked for "three weeks before
 * the 14th" will sometimes say the 21st.
 */
export function ProjectFile({ courseId, course }: { courseId: CourseId; course: string }) {
  const { state, dispatch, now, catalog } = useStore();

  // The sources you have already kept for this course, so the refusal to
  // invent one stops meaning "retype the same six readings every session".
  const onFile = useMemo(() => forCourse(state.sources, courseId), [state.sources, courseId]);

  const [shapeId, setShapeId] = useState(SHAPES[0].id as string);
  const [instructions, setInstructions] = useState('');
  const [question, setQuestion] = useState('');
  const [sources, setSources] = useState('');
  const [due, setDue] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [kept, setKept] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const dueDate = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }, [due]);

  const milestones = useMemo(
    () => (dueDate ? schedule(dueDate, now) : []),
    [dueDate, now],
  );

  const s = shapeById(shapeId);
  const left = out ? blanks(out) : 0;

  const make = async () => {
    if (busy || !dueDate) return;
    setBusy(true);
    setError('');
    setOut('');
    setKept(false);
    abort.current = new AbortController();
    let sofar = '';
    try {
      await ask({
        signal: abort.current.signal,
        maxTokens: 4000,
        think: true,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: brief({
              shape: shapeId,
              instructions,
              question,
              sources,
              course,
              milestones,
              dueLabel: dueDate.toDateString(),
            }),
          },
        ],
        onText: (chunk) => {
          sofar += chunk;
          setOut(sofar);
        },
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const title = question.trim() || `${s.label} · ${course}`;
  const document = out ? header(title, course, dueDate?.toDateString() ?? '') + out : '';

  return (
    <>
      <div style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        A document to write the thing <em>in</em> — headings, the question each section has to
        answer, your sources with a column for what each is for, the rubric as a checklist, and
        blanks where your claims go. Not the essay: that is the part with your name on it.
      </div>

      <SectionLabel>What kind of thing</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {SHAPES.map((option) => {
          const on = option.id === shapeId;
          return (
            <button
              key={option.id}
              type="button"
              className="bare tappable"
              onClick={() => setShapeId(option.id)}
              aria-pressed={on}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 'var(--r-md)',
                border: `1px solid ${on ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                background: on ? 'var(--app-accent-wash)' : 'transparent',
              }}
            >
              <span style={{ display: 'block', fontSize: 14 }}>{option.label}</span>
              <span style={{ display: 'block', fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>
                {option.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <SectionLabel>When it is due</SectionLabel>
      <input
        className="input"
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        style={{ width: '100%' }}
      />
      {dueDate ? (
        <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 5 }}>{runway(dueDate, now)}</div>
      ) : null}
      {catalog.courses.length > 0 && (
        <div style={{ fontSize: 11.5, opacity: 0.45, marginTop: 5 }}>
          For {course}. Switch course from Study.
        </div>
      )}

      {milestones.length > 0 && (
        <Blueprint style={{ padding: '11px 13px', marginTop: 10 }}>
          <div className="kicker">Working back from it</div>
          {milestones.map((m) => (
            <div key={m.what} style={{ display: 'flex', gap: 10, padding: '5px 0' }}>
              <span
                style={{
                  flex: 'none',
                  width: 74,
                  fontSize: 11.5,
                  opacity: 0.55,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {m.date.slice(5)}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>{m.what}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, opacity: 0.45, marginTop: 8, lineHeight: 1.45 }}>
            Counted here rather than by Claude, because dates are arithmetic.
          </div>
        </Blueprint>
      )}

      <SectionLabel>The assignment instructions</SectionLabel>
      <textarea
        className="input"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="Paste them. The rubric especially — it becomes the checklist."
        style={{ width: '100%', minHeight: 100, resize: 'vertical', lineHeight: 1.5 }}
      />

      <SectionLabel>Your question, in your words</SectionLabel>
      <textarea
        className="input"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Even roughly. It becomes the top of the document, for you to sharpen."
        style={{ width: '100%', minHeight: 64, resize: 'vertical', lineHeight: 1.5 }}
      />

      <SectionLabel>Your sources</SectionLabel>
      <textarea
        className="input"
        value={sources}
        onChange={(e) => setSources(e.target.value)}
        placeholder="One per line, however you have them written."
        style={{ width: '100%', minHeight: 80, resize: 'vertical', lineHeight: 1.5 }}
      />
      {onFile.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSources((now) => (now.trim() ? `${now.trim()}\n${asLines(onFile)}` : asLines(onFile)))}
            style={{ flex: 1, height: 38, fontSize: 12.5 }}
          >
            Use my {onFile.length} kept {onFile.length === 1 ? 'source' : 'sources'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => dispatch({ type: 'go', screen: 'sources' })}
            style={{ flex: 'none', height: 38, fontSize: 12.5 }}
          >
            Manage
          </button>
        </div>
      )}
      <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 6, lineHeight: 1.45 }}>
        Yours only. Nothing here will invent an author, a title or a page number — a made-up
        citation looks exactly like a real one, and it goes in under your name.
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => void make()}
        disabled={busy || !dueDate}
        style={{ height: 46, marginTop: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {busy ? 'Building it…' : out ? 'Build it again' : 'Build the project file'}
      </button>
      {!dueDate ? (
        <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 8 }}>
          Needs a due date — the schedule is the half of this that saves you.
        </div>
      ) : null}

      {error ? (
        <div style={{ fontSize: 13, marginTop: 12, color: 'var(--app-warn)', lineHeight: 1.45 }}>
          {error}
        </div>
      ) : null}

      {out && (
        <>
          <SectionLabel>Your project file</SectionLabel>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              padding: 14,
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--app-line)',
              background: 'var(--app-panel)',
            }}
          >
            {document}
          </div>

          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 10, lineHeight: 1.5 }}>
            {left > 0
              ? `${left} blanks in square brackets — those are yours, and the file is not finished until none are left.`
              : 'No blanks left in it. Read it carefully: if it has written the argument rather than asking for it, that is not a file to hand in.'}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                download({
                  name: fileName(question, course),
                  body: document,
                  mime: 'text/markdown',
                })
              }
              style={{ flex: 1, height: 42 }}
            >
              Save the file
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                dispatch({ type: 'keepNote', title, body: document, courseId });
                setKept(true);
              }}
              style={{ flex: 1, height: 42 }}
            >
              {kept ? 'Kept' : 'Keep as note'}
            </button>
          </div>
          <PrintButton label="Print it" style={{ marginTop: 8 }} />
          <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 10, lineHeight: 1.45 }}>
            Kept as a note it is editable in the app and comes out in an export. Saved as .md it
            opens in Word, Google Docs, Notion or anything else.
          </div>
        </>
      )}
      <div style={{ height: 26 }} />
    </>
  );
}
