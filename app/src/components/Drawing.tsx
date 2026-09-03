import { useEffect, useMemo, useRef, useState } from 'react';
import { cleanMermaid, cleanSvg, type Language } from '../lib/diagram';

let ready: Promise<typeof import('mermaid').default> | null = null;

/**
 * Mermaid, loaded once and only when a diagram is drawn.
 *
 * It is the largest thing in the app by some distance, and every session that
 * never draws a flowchart should pay nothing for it. `startOnLoad` is off
 * because we render explicitly; `securityLevel: 'strict'` is on because the
 * text being rendered was written by a model, and strict is what keeps any
 * HTML inside a label as text rather than as markup.
 */
async function mermaid() {
  if (!ready) {
    ready = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'dark',
        fontFamily: 'inherit',
        themeVariables: {
          background: '#12141a',
          primaryColor: '#22262f',
          primaryTextColor: '#eceef2',
          primaryBorderColor: '#d4d9e2',
          lineColor: '#949cab',
          secondaryColor: '#191c23',
          tertiaryColor: '#12141a',
        },
      });
      return m.default;
    });
  }
  return ready;
}

/**
 * A generated diagram, rendered.
 *
 * Both languages go through their sanitiser first — see `lib/diagram.ts` for
 * why that is not optional — and a failure shows the code rather than an empty
 * box, because a diagram that will not draw is still something you can read,
 * fix a label in, and paste into a document.
 */
export function Drawing({ code, language }: { code: string; language: Language }) {
  // The SVG path is synchronous, so it is derived during render rather than
  // set from an effect — an effect here would render an empty box first and
  // the drawing on a second pass, which flickers on every keystroke while the
  // code below is being edited.
  const direct = useMemo(
    () => (language === 'svg' ? cleanSvg(code) : null),
    [code, language],
  );
  const [drawn, setDrawn] = useState('');
  const [trouble, setTrouble] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    if (language !== 'mermaid') return;
    const mine = ++seq.current;
    setTrouble('');
    setDrawn('');
    const body = cleanMermaid(code);
    if (!body) {
      setTrouble('That did not come back as a diagram.');
      return;
    }
    let live = true;
    void (async () => {
      try {
        const m = await mermaid();
        const out = await m.render(`d${mine}${Math.random().toString(36).slice(2, 7)}`, body);
        if (!live || seq.current !== mine) return;
        setDrawn(out.svg);
      } catch (e) {
        if (!live || seq.current !== mine) return;
        // Mermaid leaves its failed attempt in the document when it throws.
        document.querySelectorAll('[id^="dmermaid"], .mermaid-error').forEach((n) => n.remove());
        setTrouble(e instanceof Error ? e.message : 'It would not draw.');
      }
    })();
    return () => {
      live = false;
    };
  }, [code, language]);

  const svg = language === 'svg' ? (direct ?? '') : drawn;
  const failed =
    language === 'svg' ? (direct ? '' : 'That did not come back as a drawing.') : trouble;

  if (failed) {
    return (
      <div>
        <div style={{ fontSize: 12.5, opacity: 0.6, marginBottom: 8, lineHeight: 1.45 }}>
          {failed} The code is below — it is often one label away from working, and it is yours to
          edit.
        </div>
        <pre
          style={{
            fontSize: 11.5,
            lineHeight: 1.5,
            overflowX: 'auto',
            padding: 12,
            margin: 0,
            borderRadius: 'var(--r-md)',
            background: 'var(--app-panel)',
            border: '1px solid var(--app-line)',
          }}
        >
          {code}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{ fontSize: 12.5, opacity: 0.5, padding: '20px 0' }}>Drawing…</div>
    );
  }

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--app-line)',
        background: 'var(--app-panel)',
        overflowX: 'auto',
        color: 'var(--app-fg)',
      }}
      // Both paths are sanitised: `cleanSvg` walks and strips a parsed
      // document, and Mermaid renders under securityLevel 'strict'.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
