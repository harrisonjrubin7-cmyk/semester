import { Suspense, lazy, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { ask, configured } from '../lib/claude';
import { KINDS, drawingName, kind as kindById, systemFor, unfence } from '../lib/diagram';
import { download } from '../lib/deliver';

const Drawing = lazy(() =>
  import('../components/Drawing').then((m) => ({ default: m.Drawing })),
);

/**
 * Draw it.
 *
 * The diagrams that carry an ECON, PSCI or BUS course are the ones a paragraph
 * explains badly: a curve shifting, an argument's causal chain, the branches
 * of a system, a payoff matrix. Claude cannot make an image, and it turns out
 * not to need to — for these, code is the better output, because the result is
 * text you can retitle, relabel, correct and hand in.
 *
 * The picture is drawn from what you say and from the course's own guide.
 * Nothing is invented into it: where you have not given a number, the axis
 * gets the name of the quantity rather than a plausible figure. That rule
 * matters more here than anywhere else in the app, because a number inside a
 * neat little chart is believed and repeated far more readily than the same
 * number in a sentence.
 */
export function Draw() {
  const { state, catalog } = useStore();
  const { guide } = useLive(state.guideId);

  const [kindId, setKindId] = useState(KINDS[0].id);
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const k = kindById(kindId);

  const draw = async () => {
    if (busy || !prompt.trim()) return;
    setBusy(true);
    setError('');
    setCode('');
    abort.current = new AbortController();
    let sofar = '';
    try {
      const context =
        catalog.courses.length > 0
          ? `\n\nThe course this is for: ${guide.code} — ${guide.name}.\n${guide.blurb}` +
            (guide.units.length
              ? `\nIts units: ${guide.units.map((u) => u.name).join('; ')}`
              : '')
          : '';
      await ask({
        signal: abort.current.signal,
        maxTokens: 3000,
        think: true,
        system: systemFor(k),
        messages: [
          { role: 'user', content: `${k.brief}\n\nWhat to draw:\n${prompt.trim()}${context}` },
        ],
        onText: (chunk) => {
          sofar += chunk;
        },
      });
      setCode(unfence(sofar));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
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
        Drawing for {guide.code}. The picture comes back as code, so every label is yours to change
        — and nothing is invented into it: an axis you gave no numbers for is labelled with the
        quantity, not with a plausible figure.
      </div>

      <SectionLabel>What kind of picture</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {KINDS.map((option) => {
          const on = option.id === kindId;
          return (
            <button
              key={option.id}
              type="button"
              className="bare tappable"
              onClick={() => setKindId(option.id)}
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
              <span style={{ display: 'block', fontSize: 11.5, opacity: 0.55, marginTop: 2, lineHeight: 1.4 }}>
                {option.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <SectionLabel>What to draw</SectionLabel>
      <textarea
        className="input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          k.language === 'svg'
            ? 'A demand curve shifting right after a rise in income, with the new equilibrium marked.'
            : 'How a bill becomes law, from introduction to signature.'
        }
        style={{ width: '100%', minHeight: 100, resize: 'vertical', lineHeight: 1.5 }}
      />
      <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 6, lineHeight: 1.45 }}>
        Give it the numbers if you have them — they go in exactly as typed. Leave them out and the
        drawing is labelled rather than guessed.
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => void draw()}
        disabled={busy || !prompt.trim()}
        style={{ height: 46, marginTop: 14, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {busy ? 'Drawing…' : code ? 'Draw it again' : 'Draw it'}
      </button>

      {error ? (
        <div style={{ fontSize: 13, marginTop: 12, color: 'var(--app-warn)', lineHeight: 1.45 }}>
          {error}
        </div>
      ) : null}

      {code && (
        <>
          <SectionLabel>The drawing</SectionLabel>
          <Suspense fallback={<div style={{ fontSize: 12.5, opacity: 0.5 }}>Drawing…</div>}>
            <Drawing code={code} language={k.language} />
          </Suspense>

          <SectionLabel>The code — yours to edit</SectionLabel>
          <textarea
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 160,
              resize: 'vertical',
              fontSize: 11.5,
              lineHeight: 1.5,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                download({
                  name: drawingName(prompt, k.language),
                  body: code,
                  mime: k.language === 'svg' ? 'image/svg+xml' : 'text/plain',
                })
              }
              style={{ flex: 1, height: 42 }}
            >
              Save the file
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void navigator.clipboard.writeText(code).catch(() => {})}
              style={{ flex: 1, height: 42 }}
            >
              Copy
            </button>
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 10, lineHeight: 1.45 }}>
            {k.language === 'svg'
              ? 'An .svg opens in a browser, drops into Word and Google Docs, and stays sharp at any size.'
              : 'A .mmd is Mermaid — it renders in GitHub, Notion and Obsidian as it stands.'}{' '}
            Edit a label above and the picture redraws.
          </div>
        </>
      )}
      {code ? <PrintButton label="Print the drawing" style={{ marginTop: 8 }} /> : null}
      <div style={{ height: 26 }} />
    </div>
  );
}
