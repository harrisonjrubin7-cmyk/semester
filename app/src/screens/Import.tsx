import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { gather } from '../lib/bundle';
import { extractText, type Extracted } from '../lib/extract';
import { generateCourse, type GenerationResult } from '../lib/generate';
import { configured, provider } from '../lib/claude';
import { readTerm } from '../lib/term';
import {
  diff,
  keepIds,
  movedLine,
  summary as rediffSummary,
  ticksKept,
  type Diff,
} from '../lib/rediff';

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
  const { state, dispatch } = useStore();
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
    setBusy('Opening what you picked…');

    // A zip is unpacked rather than refused: nobody has one syllabus, they
    // have a download folder and whatever the professor posted.
    const got = await gather(Array.from(list));
    if (got.skipped.length > 0) {
      setError(
        `Left out: ${got.skipped.map((sk) => `${sk.name} (${sk.why})`).join('; ')}.`,
      );
    }

    for (const piece of got.files) {
      setBusy(`Reading ${piece.name}…`);
      try {
        const extracted = await extractText(piece.file);
        setFiles((f) => [...f.filter((x) => x.name !== extracted.name), extracted]);
      } catch (e) {
        // One unreadable file should not abandon the other nine.
        setError((prior) =>
          [prior, `${piece.name}: ${e instanceof Error ? e.message : String(e)}`]
            .filter(Boolean)
            .join(' '),
        );
      }
    }
    setBusy('');
  };

  // The term a new course lands in. Defaults to the one the app is showing,
  // which is what somebody importing in September means, and is changeable
  // before it is saved because August imports of a spring course happen.
  const term = readTerm(state.term);

  const build = async () => {
    if (files.length === 0) return;
    setError('');
    setResult(null);
    setBusy('Reading the syllabus…');
    abort.current = new AbortController();
    try {
      const built = await generateCourse(
        { documents: files, hint, year: term.year },
        abort.current.signal,
      );
      setResult(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  /**
   * The course you already have that this import looks like a new copy of.
   *
   * Matched on the course code, which is the one thing that does not get
   * re-worded between two printings of the same syllabus. Only your own
   * courses — the four samples are compiled in and cannot be replaced.
   */
  const existing = result
    ? state.courses.find(
        (c: (typeof state.courses)[number]) =>
          c.course.code.trim().toLowerCase() === result.module.course.code.trim().toLowerCase(),
      )
    : undefined;

  const changes = useMemo(
    () => (existing && result ? diff(existing, result.module, term.year) : null),
    [existing, result, term.year],
  );

  const save = () => {
    if (!result) return;
    // Replacing rather than adding, when it is the same course, and with the
    // surviving items keeping the ids their ticks are filed under — otherwise
    // a re-import silently un-ticks everything already done.
    if (existing) {
      const merged = keepIds(existing, result.module);
      dispatch({ type: 'replaceCourse', module: merged });
      dispatch({ type: 'openCourse', id: merged.course.id });
      return;
    }
    // Stamped with the term it was imported into, so its dates resolve to the
    // right year and it does not follow you into next semester.
    const filed = {
      ...result.module,
      course: { ...result.module.course, term: result.module.course.term ?? term.id },
    };
    dispatch({ type: 'addCourse', module: filed });
    dispatch({ type: 'openCourse', id: filed.course.id });
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
        accept=".pdf,.docx,.txt,.md,.csv,.html,.zip,text/*,application/pdf,application/zip"
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
        {busy ? busy : 'Choose files — PDF, Word, text, or a zip of them'}
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
          Building a course asks {provider()} to read the documents, which needs a key. Set one under{' '}
          <strong>Ask Claude → Settings</strong>, or sign in and use the shared one.
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--app-accent)',
            marginTop: 14,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}

      {result && changes && existing ? (
        <Rediff
          changes={changes}
          kept={ticksKept(existing, result.module, state.done)}
          code={result.module.course.code}
        />
      ) : null}
      {result && <Preview result={result} onSave={save} replacing={Boolean(existing)} />}
      <div style={{ height: 22 }} />
    </div>
  );
}

/**
 * What a re-import would change, before it changes it.
 *
 * Importing a syllabus twice used to replace the course wholesale and say
 * nothing, so the safe thing to do with a corrected syllabus was nothing —
 * and a course updated mid-term stayed wrong on purpose. Removals are listed
 * first because they are what a person actually loses.
 */
function Rediff({
  changes,
  kept,
  code,
}: {
  changes: Diff;
  kept: { kept: number; lost: number };
  code: string;
}) {
  const line = (label: string, right: string) => (
    <div
      key={`${label}-${right}`}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'baseline',
        padding: '9px 0',
        borderBottom: '1px solid var(--app-line-soft)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.35 }}>{label}</span>
      <span style={{ flex: 'none', fontSize: 11.5, opacity: 0.6 }}>{right}</span>
    </div>
  );

  return (
    <>
      <SectionLabel>You already have {code}</SectionLabel>
      <Blueprint style={{ padding: '14px 15px' }}>
        <div className="chrome-text" style={{ fontSize: 20, lineHeight: 1.2, textWrap: 'pretty' }}>
          {rediffSummary(changes)}
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 7, lineHeight: 1.5 }}>
          {changes.same} unchanged. Saving replaces the course you have rather than adding a second
          copy of it.
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6, lineHeight: 1.5 }}>
          {kept.lost === 0
            ? `Everything you have ticked off stays ticked${kept.kept > 0 ? ` — all ${kept.kept} of them` : ''}.`
            : `${kept.kept} of your ticks carry over; ${kept.lost} ${kept.lost === 1 ? 'belongs' : 'belong'} to a deadline this syllabus no longer has.`}
          {' '}Cards and drill history are keyed to the question text and are untouched.
        </div>
      </Blueprint>

      {changes.removed.length > 0 && (
        <>
          <SectionLabel>Gone from the new syllabus</SectionLabel>
          {changes.removed.map((i) => line(i.title, `${i.month + 1}/${i.day}`))}
        </>
      )}

      {changes.moved.length > 0 && (
        <>
          <SectionLabel>Moved</SectionLabel>
          {changes.moved.map((m) =>
            line(m.after.title, `${m.before.month + 1}/${m.before.day} → ${m.after.month + 1}/${m.after.day} · ${movedLine(m)}`),
          )}
        </>
      )}

      {changes.added.length > 0 && (
        <>
          <SectionLabel>New</SectionLabel>
          {changes.added.map((i) => line(i.title, `${i.month + 1}/${i.day}`))}
        </>
      )}

      {changes.renamed.length > 0 && (
        <>
          <SectionLabel>Reworded, same date</SectionLabel>
          {changes.renamed.map((r) => line(r.after.title, 'was ' + r.before.title))}
        </>
      )}

      {(changes.reweighted.length > 0 ||
        changes.gradingAdded.length > 0 ||
        changes.gradingRemoved.length > 0) && (
        <>
          <SectionLabel>How the grade is built</SectionLabel>
          {changes.reweighted.map((r) => line(r.what, `${r.before} → ${r.after}`))}
          {changes.gradingRemoved.map((r) => line(r.what, `${r.pct} · gone`))}
          {changes.gradingAdded.map((r) => line(r.what, `${r.pct} · new`))}
        </>
      )}

      {changes.fields.length > 0 && (
        <>
          <SectionLabel>The course itself</SectionLabel>
          {changes.fields.map((f) => line(f.field, `${f.before || '—'} → ${f.after || '—'}`))}
        </>
      )}
    </>
  );
}

/** What was found, what was dropped, and the chance to say no. */
function Preview({
  result,
  onSave,
  replacing = false,
}: {
  result: GenerationResult;
  onSave: () => void;
  replacing?: boolean;
}) {
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
        {replacing ? `Replace ${m.course.code}` : `Add ${m.course.code} to my semester`}
      </button>
      <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 10, lineHeight: 1.5 }}>
        {replacing
          ? 'The changes above are what this replaces. Your ticks and your drill history stay where they are.'
          : 'You can add readings to it later, and everything you add flows into the cards, the quiz and the slides at once.'}
      </div>
    </>
  );
}
