import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { ask, configured } from '../lib/claude';
import { MAX_SHOTS, toShots } from '../lib/shots';
import { APPROACHES, READ_SYSTEM, SYSTEM, approach as byId, brief } from '../lib/solve';

/**
 * Work the problem.
 *
 * The hard part of quantitative coursework is rarely the arithmetic. It is not
 * knowing which method a question is asking for, and — when the answer comes
 * out wrong — not being able to find the step where it went wrong. Both are
 * things a careful reader is good at and a tired student at 1am is not.
 *
 * So the screen offers those, and works a parallel problem rather than handing
 * over the answer to the one being marked. That line is stated once here and
 * nowhere else, because a tool that repeats its own scruples is exhausting.
 *
 * The camera is on it because a problem set is a piece of paper. Transcribing
 * a page of subscripts by hand is enough friction to stop somebody using the
 * thing at all — and the transcription is told to mark what it cannot read
 * rather than guess, since a guessed exponent quietly turns the problem into a
 * different one.
 */
export function Solve() {
  const { state, catalog } = useStore();
  const { guide } = useLive(state.guideId);

  const [aid, setAid] = useState(APPROACHES[0].id);
  const [problem, setProblem] = useState('');
  const [work, setWork] = useState('');
  const [expected, setExpected] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const a = byId(aid);

  const course = catalog.courses.length > 0 ? `${guide.code} — ${guide.name}` : '';

  const readPhoto = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    setBusy('Reading it…');
    try {
      const { shots, errors } = await toShots(Array.from(files).slice(0, MAX_SHOTS));
      if (errors.length) setError(errors.join(' '));
      if (shots.length === 0) return;
      abort.current = new AbortController();
      const text = await ask({
        signal: abort.current.signal,
        images: shots.map((sh) => sh.shot),
        think: true,
        maxTokens: 2000,
        system: READ_SYSTEM,
        messages: [{ role: 'user', content: 'Transcribe the problem in these.' }],
      });
      setProblem((prior) => (prior.trim() ? `${prior.trim()}\n\n${text.trim()}` : text.trim()));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy('');
    }
  };

  const run = async () => {
    if (busy || !problem.trim()) return;
    setBusy('Working…');
    setError('');
    setOut('');
    abort.current = new AbortController();
    let sofar = '';
    try {
      await ask({
        signal: abort.current.signal,
        maxTokens: 3000,
        think: true,
        system: SYSTEM,
        messages: [
          { role: 'user', content: brief({ approach: a, problem, work, expected, course }) },
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
      setBusy('');
    }
  };

  if (!configured()) {
    return (
      <div style={{ padding: 18 }}>
        <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
          <div className="kicker">Needs Claude</div>
          <div style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5, opacity: 0.8 }}>
            Sign in to use the shared key, or add your own under Ask Claude → Settings.
          </div>
        </Blueprint>
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 13, opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        Working on {guide.code}. It will not write the answer you are handing in — for a maths
        question the worked solution is the submitted work. It will teach the method on numbers
        that are not yours, and read your attempt and find the first step that is wrong.
      </div>

      <SectionLabel>What do you need</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {APPROACHES.map((option) => {
          const on = option.id === aid;
          return (
            <button
              key={option.id}
              type="button"
              className="bare tappable"
              onClick={() => setAid(option.id)}
              aria-pressed={on}
              style={{
                textAlign: 'left',
                padding: '11px 13px',
                borderRadius: 'var(--r-md)',
                border: `1px solid ${on ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                background: on ? 'var(--app-accent-wash)' : 'transparent',
              }}
            >
              <span style={{ display: 'block', fontSize: 14 }}>{option.label}</span>
              <span
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  opacity: 0.55,
                  marginTop: 2,
                  lineHeight: 1.4,
                }}
              >
                {option.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <SectionLabel>The problem</SectionLabel>
      <textarea
        className="input"
        value={problem}
        onChange={(e) => setProblem(e.target.value)}
        placeholder="Type it, or photograph it below."
        style={{ width: '100%', minHeight: 110, resize: 'vertical', lineHeight: 1.55 }}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          void readPhoto(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => camera.current?.click()}
        disabled={!!busy}
        style={{ height: 42, marginTop: 8, fontSize: 12, letterSpacing: '0.08em' }}
      >
        {busy === 'Reading it…' ? 'Reading it…' : 'Photograph the problem'}
      </button>
      <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
        Anything the photo cannot show clearly comes back as [?] rather than a guess — a guessed
        exponent turns it into a different problem without telling you.
      </div>

      {a.wantsWork && (
        <>
          <SectionLabel>What you did</SectionLabel>
          <textarea
            className="input"
            value={work}
            onChange={(e) => setWork(e.target.value)}
            placeholder="Your working, as far as you got. Rough is fine."
            style={{ width: '100%', minHeight: 110, resize: 'vertical', lineHeight: 1.55 }}
          />
        </>
      )}

      {a.id === 'wrong' && (
        <>
          <SectionLabel>The answer you expected</SectionLabel>
          <input
            className="input"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder="What the book or the key says."
            style={{ width: '100%' }}
          />
        </>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => void run()}
        disabled={!!busy || !problem.trim()}
        style={{ height: 46, marginTop: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {busy === 'Working…' ? 'Working…' : out ? 'Do it again' : a.label}
      </button>

      {error ? (
        <div style={{ fontSize: 13, marginTop: 12, color: 'var(--app-warn)', lineHeight: 1.45 }}>
          {error}
        </div>
      ) : null}

      {out && (
        <>
          <SectionLabel>{a.label}</SectionLabel>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              padding: 14,
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--app-line)',
              background: 'var(--app-panel)',
            }}
          >
            {out}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => void navigator.clipboard.writeText(out).catch(() => {})}
            style={{ height: 42, marginTop: 8 }}
          >
            Copy
          </button>
        </>
      )}
      {out ? <PrintButton label="Print this" style={{ marginTop: 8 }} /> : null}
      <div style={{ height: 26 }} />
    </div>
  );
}
