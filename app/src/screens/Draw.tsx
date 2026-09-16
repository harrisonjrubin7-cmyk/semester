import { Suspense, lazy, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useLive } from '../lib/live';
import { ActionButton, SectionLabel } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { PrintButton } from '../components/PrintButton';
import { ask } from '../lib/claude';
import { configured } from '../lib/assistant';
import { KINDS, drawingName, kind as kindById, systemFor, unfence } from '../lib/diagram';
import { readDrawn } from '../lib/figure';
import { download } from '../lib/deliver';
import { NeedsKey } from '../components/NeedsKey';

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
 *
 * ## There was a graphing calculator in here, and it was the second one
 *
 * A port added a tab bar over this screen — "Graphing calculator · Diagrams &
 * illustrations" — where the first tab was `components/GraphCalculator.tsx`
 * over `lib/graphing.ts`: a second expression parser and a second plotter, in
 * an app whose `lib/calc.ts` and `lib/plot.ts` already did both and are what
 * the grades are computed with.
 *
 * It went to `equations`, which is where the registry always said it was.
 * That screen's blurb is "Write a formula properly, work it out at your own
 * numbers, and draw its curve" and its keywords already carried `graphing
 * calculator`, `desmos` and `geogebra`. This screen is the one that draws a
 * *diagram* — a curve shifting, a causal chain, a payoff matrix — from a
 * sentence and a course guide. Somebody typing `y = sin(x)` was never looking
 * for it.
 *
 * The survivor is the better instrument, which is the part worth knowing
 * rather than assuming: `lib/plot.ts` does implicit curves, zeros, turning
 * points, intersections, the area under a curve and the slope at a point, and
 * `components/Grapher.tsx` gives every free number its own slider and colours
 * each curve off the reader's own accent. The copy that went had none of that
 * and hardcoded twelve colours, `fill="white"` among them — a white square in
 * the dark themes.
 *
 * Two things the copy did have and the survivor does not, left out
 * deliberately rather than overlooked. A **table of values** is the opposite
 * of what `lib/plot.ts` is for, and says so at the top of that file: "the
 * handful of facts somebody actually wants off a graph — where it crosses
 * zero, where it turns, where two curves meet". Twenty-one rows of y is
 * figures instead of facts. An **SVG export** is a fair thing to want, and is
 * real work rather than a carry-over: this app's plot is drawn in
 * `var(--app-*)` tokens, so a file saved straight out of it has unresolved
 * variables in it. The copy exported cleanly only because its colours were
 * hardcoded, which is the same defect from the other end.
 */
export function Draw() {
  const { state, dispatch, catalog } = useStore();
  const { guide } = useLive(state.guideId);

  const [kindId, setKindId] = useState(KINDS[0].id);
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  /** What the last keep did, said on the screen rather than as a toast. */
  const [kept, setKept] = useState('');
  const trouble = useTrouble();
  const abort = useRef<AbortController | null>(null);
  const k = kindById(kindId);

  const draw = async () => {
    if (busy || !prompt.trim()) return;
    setBusy(true);
    trouble.clear();
    setCode('');
    setKept('');
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
        about: 'diagram',
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
      trouble.failed(e, () => void draw());
    } finally {
      setBusy(false);
    }
  };

  /**
   * Keep the drawing as a figure of this course.
   *
   * It goes in as a `CourseUpdate`, which is the same door a reading and a
   * photograph of the board already come through — so it is placed by
   * `lib/live.ts`'s one placement pass, it appears in the Figures tab beside
   * the guide's own, it is counted by the mode card, and it can be taken back
   * out by the same undo. Writing it anywhere else would have been a second
   * kind of added figure, which is the duplication this app keeps removing.
   *
   * `readDrawn` is the gate, and the refusal is worth a sentence on the
   * screen rather than a silent no-op: the commonest way to arrive here is
   * with a reply that came back as an apology instead of a diagram, and
   * "nothing happened" is the least useful thing to say about that.
   */
  const keep = () => {
    const figure = readDrawn({
      title: prompt.trim().slice(0, 80) || k.label,
      /*
       * The kind and nothing else. `lib/live.ts`'s placement pass appends
       * ` — ${source}` to every added figure's caption, so a caption naming
       * the course here rendered as "Drawn for ECON 1020 — a graph with
       * axes. — Drawn here": the course is already the guide you are reading
       * and the provenance is already on the end.
       */
      caption: `${k.label}.`,
      language: k.language,
      code,
    });
    if (!figure) {
      setKept(
        'That is not a drawing yet — the code above did not come back as ' +
          `${k.language === 'svg' ? 'an SVG' : 'Mermaid'}. Draw it again, or fix it above.`,
      );
      return;
    }
    dispatch({
      type: 'addUpdate',
      update: {
        courseId: state.guideId,
        // No unit: a drawing is about the course rather than about one week of
        // it, and `place` sends a figure with no unit to the shared rail —
        // which is where somebody looking for "the diagram I drew" will look.
        unit: null,
        title: figure.title,
        source: 'Drawn here',
        body: '',
        cards: [],
        terms: [],
        figures: [figure],
        fileIds: [],
      },
    });
    setKept(`Kept. It is in ${guide.code}’s Figures now.`);
  };

  if (!configured()) return <NeedsKey frame />;

  return (
    <Page bottom={26}>
      <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
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
              <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{option.label}</span>
              <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-1)', lineHeight: 1.4 }}>
                {option.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <SectionLabel>What to draw</SectionLabel>
      <textarea
        aria-label="What to draw"
        className="input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          k.language === 'svg'
            ? 'A demand curve shifting right after a rise in income, with the new equilibrium marked.'
            : 'How a bill becomes law, from introduction to signature.'
        }
        style={{ width: '100%', minHeight: 100, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
      />
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
        Give it the numbers if you have them — they go in exactly as typed. Leave them out and the
        drawing is labelled rather than guessed.
      </div>

      <ActionButton
        onClick={() => void draw()}
        disabled={busy || !prompt.trim()}
        tone="primary"
        style={{ marginTop: 14 }}
      >
        {busy ? 'Drawing…' : code ? 'Draw it again' : 'Draw it'}
      </ActionButton>

      <Trouble said={trouble.said} onRetry={trouble.again} />

      {code && (
        <>
          <SectionLabel>The drawing</SectionLabel>
          <Suspense fallback={<div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-dim)' }}>Drawing…</div>}>
            <Drawing code={code} language={k.language} />
          </Suspense>

          <SectionLabel>The code — yours to edit</SectionLabel>
          <textarea
            className="input"
            aria-label="The code — yours to edit"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 160,
              resize: 'vertical',
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              lineHeight: 'var(--leading-relaxed)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          />
          <ActionButton onClick={keep} disabled={!code.trim()} style={{ marginTop: 'var(--sp-5)' }}>
            Keep it in {guide.code}
          </ActionButton>
          <div
            style={{
              fontSize: 'var(--type-xs)',
              color: kept.startsWith('That') ? 'var(--app-fg)' : 'var(--app-dim)',
              marginTop: 'var(--sp-3)',
              lineHeight: 'var(--leading-normal)',
              textWrap: 'pretty',
            }}
            aria-live="polite"
          >
            {kept ||
              'A kept drawing joins this course’s Figures, alongside the guide’s own — labelled as ' +
                'drawn from a description rather than as the guide’s, and still yours to edit here.'}
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
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
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
            {k.language === 'svg'
              ? 'An .svg opens in a browser, drops into Word and Google Docs, and stays sharp at any size.'
              : 'A .mmd is Mermaid — it renders in GitHub, Notion and Obsidian as it stands.'}{' '}
            Edit a label above and the picture redraws.
          </div>
        </>
      )}
      {code ? <PrintButton label="Print the drawing" style={{ marginTop: 'var(--sp-4)' }} /> : null}
    </Page>
  );
}
