import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { extractText, type Extracted } from '../lib/extract';
import { generateCourse, type GenerationResult } from '../lib/generate';
import { configured } from '../lib/claude';
import { SEMESTER_YEAR } from '../lib/date';

/**
 * Upload a syllabus, get a course.
 *
 * The prototype faked this screen — a progress bar and a canned list of dates.
 * This is the real thing: the files are read in the browser, sent once to
 * Claude, and what comes back is checked before it is shown. Nothing is saved
 * until the student has seen what was found and what was thrown away.
 *
 * Readings are worth uploading alongside the syllabus. A syllabus alone gives
 * deadlines and a topic list; the readings are where the cards come from.
 */
export function Import() {
  const { dispatch } = useStore();
  const [files, setFiles] = useState<Extracted[]>([]);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setError('');
    for (const file of Array.from(list)) {
      setBusy(`Reading ${file.name}…`);
      try {
        const extracted = await extractText(file);
        setFiles((f) => [...f.filter((x) => x.name !== extracted.name), extracted]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    setBusy('');
  };

  const build = async () => {
    if (files.length === 0) return;
    setError('');
    setResult(null);
    setBusy('Reading the syllabus…');
    abort.current = new AbortController();
    try {
      const built = await generateCourse(
        { documents: files, hint, year: SEMESTER_YEAR },
        abort.current.signal,
      );
      setResult(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const save = () => {
    if (!result) return;
    dispatch({ type: 'addCourse', module: result.module });
    dispatch({ type: 'openCourse', id: result.module.course.id });
  };

  const words = files.reduce((n, f) => n + f.words, 0);

  return (
    <div style={{ padding: 18 }}>
      <div className="chrome-text" style={{ fontSize: 28, lineHeight: 1.08 }}>
        Upload it. Walk away.
      </div>
      <div style={{ fontSize: 14, opacity: 0.72, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>
        The syllabus gives the dates and how the grade is built. Add the readings and you get the
        study guide too — cards, terms and a self-test made from what they actually argue.
      </div>

      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md,.csv,.html,text/*,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => void add(e.target.files)}
      />
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => input.current?.click()}
        disabled={busy !== ''}
        style={{ height: 46, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 16 }}
      >
        {busy.startsWith('Reading ') ? busy : 'Choose files — PDF, Word or text'}
      </button>

      {files.map((f) => (
        <div
          key={f.name}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'baseline',
            padding: '11px 0',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {f.name}
          </span>
          <span style={{ fontSize: 11, opacity: 0.5, flex: 'none' }}>
            {f.words.toLocaleString()} words
          </span>
          <button
            type="button"
            className="bare"
            onClick={() => setFiles((list) => list.filter((x) => x.name !== f.name))}
            style={{ fontSize: 11, opacity: 0.5, letterSpacing: '0.1em', flex: 'none', width: 'auto' }}
          >
            REMOVE
          </button>
        </div>
      ))}

      {files.length > 0 && (
        <>
          <SectionLabel>Anything it should know</SectionLabel>
          <input
            className="input"
            placeholder="Optional — “the midterm moved to Oct 8”, “skip chapter 4”"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            style={{ fontSize: 13.5 }}
          />

          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy !== ''}
            onClick={() => void build()}
            style={{
              height: 50,
              fontSize: 15,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 14,
            }}
          >
            {busy && !busy.startsWith('Reading ') ? busy : `Build the course from ${words.toLocaleString()} words`}
          </button>

          {busy && !busy.startsWith('Reading ') && (
            <button
              type="button"
              className="bare"
              onClick={() => abort.current?.abort()}
              style={{ fontSize: 11, opacity: 0.55, letterSpacing: '0.1em', marginTop: 10 }}
            >
              STOP
            </button>
          )}
        </>
      )}

      {!configured() && (
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 12, lineHeight: 1.5, textWrap: 'pretty' }}>
          Building a course asks Claude to read the documents, which needs a key. Set one under{' '}
          <strong>Ask Claude → Settings</strong>, or sign in and use the shared one.
        </div>
      )}

      {error && (
        <div style={{ fontSize: 13, color: 'var(--app-accent)', marginTop: 14, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {result && <Preview result={result} onSave={save} />}
      <div style={{ height: 22 }} />
    </div>
  );
}

/** What was found, what was dropped, and the chance to say no. */
function Preview({ result, onSave }: { result: GenerationResult; onSave: () => void }) {
  const { module: m, notes } = result;
  const [summary, ...warnings] = notes;

  return (
    <>
      <SectionLabel>What came back</SectionLabel>
      <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
        <div className="chrome-text" style={{ fontSize: 24, lineHeight: 1.1 }}>
          {m.course.code}
        </div>
        <div style={{ fontSize: 14, marginTop: 3 }}>{m.course.name}</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6, lineHeight: 1.5 }}>
          {[m.course.prof, m.course.meets, m.course.room, m.course.credits]
            .filter(Boolean)
            .join(' · ')}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 11.5,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.7,
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid var(--app-line)',
          }}
        >
          {summary}
        </div>
      </Blueprint>

      {warnings.length > 0 && (
        <>
          <SectionLabel>Worth knowing</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {warnings.map((w) => (
              <div key={w} style={{ fontSize: 12.5, opacity: 0.75, lineHeight: 1.45, textWrap: 'pretty' }}>
                · {w}
              </div>
            ))}
          </div>
        </>
      )}

      <SectionLabel>The dates it found</SectionLabel>
      {m.items.slice(0, 8).map((i) => (
        <div key={i.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--app-line)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 12,
                opacity: 0.55,
                width: 54,
                flex: 'none',
              }}
            >
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i.month]} {i.day}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.3 }}>{i.title}</span>
          </div>
          {i.quote && (
            <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 4, lineHeight: 1.45, paddingLeft: 64 }}>
              “{i.quote}”
            </div>
          )}
        </div>
      ))}
      {m.items.length > 8 && (
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>
          and {m.items.length - 8} more
        </div>
      )}

      <SectionLabel>The first unit</SectionLabel>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>{m.guide.units[0]?.name}</div>
      {(m.guide.units[0]?.cards ?? []).slice(0, 2).map((c) => (
        <div key={c.q} style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{c.q}</div>
          <div style={{ fontSize: 13.5, opacity: 0.78, lineHeight: 1.5, marginTop: 2 }}>{c.a}</div>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={onSave}
        style={{
          height: 50,
          fontSize: 15,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 18,
        }}
      >
        Add {m.course.code} to my semester
      </button>
      <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 10, lineHeight: 1.5 }}>
        You can add readings to it later, and everything you add flows into the cards, the quiz and
        the slides at once.
      </div>
    </>
  );
}
