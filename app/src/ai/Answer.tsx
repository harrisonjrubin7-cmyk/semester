import { Fragment, type ReactNode } from 'react';

/**
 * An answer, drawn rather than printed.
 *
 * Models write markdown whether or not you ask them to, and the sheet used to
 * render it with `white-space: pre-wrap` — so a three-step answer arrived as
 * literal `**Step 1**` and `- ` on the front of every line, and a formula came
 * back wrapped in backticks. That is not a formatting preference; a wall of
 * asterisks is harder to read than the plain paragraph the model was trying
 * not to write.
 *
 * ## Why not `Help.tsx`'s renderer
 *
 * That one exists and is deliberately smaller: it draws four constructs
 * because the guidebook generator emits exactly four, and it is right to stay
 * that way. This input is not written by this app. A model reaches for
 * numbered steps, fenced code and headings without being asked, and a renderer
 * that ignored those would leave the syntax on screen.
 *
 * ## Why not a markdown library
 *
 * Every one of them accepts HTML, and the text here comes from a model that
 * has been handed the student's timetable. Nothing below produces an element
 * from the input — the input only ever becomes a text node — so there is no
 * path from something the model writes to something the browser executes.
 * That property is worth more here than complete markdown, and it is not a
 * property you get by configuring a dependency correctly.
 */
export function Answer({ text }: { text: string }) {
  return <>{blocks(text)}</>;
}

function blocks(text: string): ReactNode[] {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let para: string[] = [];
  let bullets: { text: string; ordered: boolean }[] = [];
  let fence: string[] | null = null;

  const flushPara = () => {
    if (para.length === 0) return;
    out.push(
      <p key={`p${out.length}`} style={{ margin: '0 0 var(--sp-5)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        {inline(para.join(' '))}
      </p>,
    );
    para = [];
  };

  const flushList = () => {
    if (bullets.length === 0) return;
    const ordered = bullets[0].ordered;
    const Tag = ordered ? 'ol' : 'ul';
    out.push(
      <Tag
        key={`l${out.length}`}
        style={{ margin: '0 0 var(--sp-5)', paddingLeft: 'var(--sp-7)', lineHeight: 'var(--leading-relaxed)' }}
      >
        {bullets.map((b, i) => (
          <li key={i} style={{ margin: '0 0 var(--sp-2)' }}>
            {inline(b.text)}
          </li>
        ))}
      </Tag>,
    );
    bullets = [];
  };

  const flushAll = () => {
    flushPara();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    // A fenced block runs until its closing fence, and nothing inside it is
    // read as markdown — which is the entire point of a fence.
    if (fence !== null) {
      if (/^\s*```/.test(line)) {
        out.push(
          <pre
            key={`c${out.length}`}
            style={{
              margin: '0 0 var(--sp-5)',
              padding: 'var(--sp-5)',
              border: '1px solid var(--app-line)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--app-hero)',
              fontSize: 'var(--type-xs)',
              lineHeight: 'var(--leading-normal)',
              whiteSpace: 'pre',
              overflowX: 'auto',
            }}
          >
            {fence.join('\n')}
          </pre>,
        );
        fence = null;
      } else {
        fence.push(raw);
      }
      continue;
    }
    if (/^\s*```/.test(line)) {
      flushAll();
      fence = [];
      continue;
    }

    if (line.trim() === '') {
      flushAll();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      // One size for every level. A model's `#` and `###` do not mean what a
      // document's do — it picks a depth per answer, not per document — so
      // four sizes would make two answers to the same question look like
      // different kinds of thing.
      out.push(
        <div
          key={`h${out.length}`}
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--type-base)',
            margin: 'var(--sp-5) 0 var(--sp-3)',
            lineHeight: 'var(--leading-tight)',
          }}
        >
          {inline(heading[2])}
        </div>,
      );
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushAll();
      out.push(
        <div
          key={`q${out.length}`}
          style={{
            margin: '0 0 var(--sp-5)',
            paddingLeft: 'var(--sp-5)',
            borderLeft: '2px solid var(--app-line)',
            opacity: 0.8,
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          {inline(quote[1])}
        </div>,
      );
      continue;
    }

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      // A list that changes kind mid-way is two lists.
      if (bullets.length > 0 && bullets[0].ordered !== ordered) flushList();
      bullets.push({ text: (bullet ?? numbered)![1], ordered });
      continue;
    }

    flushList();
    para.push(line.trim());
  }

  // An answer cut off mid-fence still shows what arrived, rather than nothing.
  if (fence !== null && fence.length > 0) {
    out.push(
      <pre key={`c${out.length}`} style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 'var(--type-xs)' }}>
        {fence.join('\n')}
      </pre>,
    );
  }
  flushAll();
  return out;
}

/** Bold, italic and code spans. Everything else is left as it was typed. */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|(?<![*\w])\*[^*\n]+\*(?!\w)|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    const key = `${i}-${part.slice(0, 12)}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} style={{ fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={key}
          style={{
            fontSize: '0.92em',
            padding: '1px 4px',
            borderRadius: 'var(--r-sm)',
            background: 'var(--app-hero)',
            border: '1px solid var(--app-line)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}
