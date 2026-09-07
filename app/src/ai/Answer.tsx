import { Fragment, useState, type ReactNode } from 'react';
import type { Screen } from '../lib/types';
import { fromHash } from '../lib/route';

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
 * ## Why not a markdown library
 *
 * Every one of them accepts HTML, and the text here comes from a model that
 * has been handed the student's timetable. Nothing below produces an element
 * from the input — the input only ever becomes a text node, or an anchor whose
 * href has been checked against a scheme allowlist — so there is no path from
 * something the model writes to something the browser executes. That property
 * is worth more here than complete markdown, and it is not a property you get
 * by configuring a dependency correctly.
 *
 * ## What it does not do
 *
 * No LaTeX. The app has no maths renderer, and adding one to draw the
 * occasional formula would be a dependency for a case the guide already
 * handles with figures. A `$…$` stays as it was typed, which is legible and
 * honest, rather than becoming a half-rendered guess.
 */

export function Answer({ text }: { text: string }) {
  return <>{blocks(text)}</>;
}

/** One list, at one depth, holding items and any lists nested under them. */
interface Item {
  text: string;
  depth: number;
  ordered: boolean;
}

function blocks(text: string): ReactNode[] {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let para: string[] = [];
  let items: Item[] = [];
  let rows: string[] = [];
  let fence: { lang: string; body: string[] } | null = null;

  const flushPara = () => {
    if (para.length === 0) return;
    out.push(
      <p key={`p${out.length}`} style={PARA}>
        {inline(para.join(' '))}
      </p>,
    );
    para = [];
  };

  const flushList = () => {
    if (items.length === 0) return;
    out.push(<List key={`l${out.length}`} items={items} at={0} />);
    items = [];
  };

  const flushTable = () => {
    if (rows.length === 0) return;
    out.push(<Table key={`t${out.length}`} rows={rows} />);
    rows = [];
  };

  const flushAll = () => {
    flushPara();
    flushList();
    flushTable();
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    // A fenced block runs until its closing fence, and nothing inside it is
    // read as markdown — which is the entire point of a fence.
    if (fence !== null) {
      if (/^\s*```/.test(line)) {
        out.push(<Code key={`c${out.length}`} lang={fence.lang} body={fence.body.join('\n')} />);
        fence = null;
      } else {
        fence.body.push(raw);
      }
      continue;
    }
    const opens = /^\s*```\s*([\w+-]*)/.exec(line);
    if (opens) {
      flushAll();
      fence = { lang: opens[1] ?? '', body: [] };
      continue;
    }

    if (line.trim() === '') {
      flushAll();
      continue;
    }

    // A table is a run of `|`-delimited rows. The separator row is dropped by
    // `Table`; it carries alignment this does not use.
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara();
      flushList();
      rows.push(line);
      continue;
    }
    flushTable();

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      // One size for every level. A model's `#` and `###` do not mean what a
      // document's do — it picks a depth per answer, not per document — so
      // four sizes would make two answers to the same question look like
      // different kinds of thing.
      //
      // The level is kept anyway, in the role rather than in the type. Looking
      // the same and *being* the same are different claims: a reader skimming
      // a long answer by heading needs these to be headings, and one drawn as
      // a plain div is a paragraph in bold to everything but the eye. So the
      // size is flattened and the structure is not.
      //
      // Offset by one, because the answer sits inside a page that already has
      // an h1 — a `#` from the model is a section of the answer, not a title
      // of the document.
      out.push(
        <div
          key={`h${out.length}`}
          role="heading"
          aria-level={Math.min(6, heading[1].length + 1)}
          style={HEADING}
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
        <div key={`q${out.length}`} style={QUOTE}>
          {inline(quote[1])}
        </div>,
      );
      continue;
    }

    const bullet = /^(\s*)[-*•]\s+(.*)$/.exec(line);
    const numbered = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const m = (bullet ?? numbered)!;
      // Two spaces to a level, which is what every model emits and what
      // markdown itself specifies loosely enough that anything stricter would
      // flatten half the nested lists that arrive.
      const depth = Math.floor(m[1].replace(/\t/g, '  ').length / 2);
      items.push({ text: m[2], depth, ordered: Boolean(numbered) });
      continue;
    }

    flushList();
    para.push(line.trim());
  }

  // An answer cut off mid-fence still shows what arrived, rather than nothing.
  if (fence !== null && fence.body.length > 0) {
    out.push(<Code key={`c${out.length}`} lang={fence.lang} body={fence.body.join('\n')} />);
  }
  flushAll();
  return out;
}

const PARA = {
  margin: '0 0 var(--sp-5)',
  lineHeight: 'var(--leading-relaxed)',
  textWrap: 'pretty',
} as const;

const HEADING = {
  fontFamily: 'var(--font-heading)',
  fontSize: 'var(--type-base)',
  margin: 'var(--sp-6) 0 var(--sp-3)',
  lineHeight: 'var(--leading-tight)',
} as const;

const QUOTE = {
  margin: '0 0 var(--sp-5)',
  paddingLeft: 'var(--sp-5)',
  borderLeft: '2px solid var(--app-line)',
  opacity: 0.8,
  lineHeight: 'var(--leading-relaxed)',
} as const;

/**
 * A list and everything nested under it, built from the flat run.
 *
 * Recursive rather than flat-with-padding: a nested list that is really a
 * nested `<ul>` is one a screen reader announces as "list, 3 items, list, 2
 * items", and one that is only indented is announced as five items at one
 * level. The indentation looks the same and the reading is not.
 */
function List({ items, at }: { items: Item[]; at: number }) {
  const Tag = items[0].ordered ? 'ol' : 'ul';
  const out: ReactNode[] = [];
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].depth > at) continue;
    // Everything deeper, up to the next item at this level, belongs under it.
    const under: Item[] = [];
    let j = i + 1;
    while (j < items.length && items[j].depth > at) {
      under.push(items[j]);
      j += 1;
    }
    out.push(
      <li key={i} style={{ margin: '0 0 var(--sp-2)' }}>
        {inline(items[i].text)}
        {under.length > 0 && <List items={under} at={at + 1} />}
      </li>,
    );
    i = j - 1;
  }
  return (
    <Tag
      style={{
        margin: at === 0 ? '0 0 var(--sp-5)' : 'var(--sp-2) 0 0',
        paddingLeft: 'var(--sp-7)',
        lineHeight: 'var(--leading-relaxed)',
      }}
    >
      {out}
    </Tag>
  );
}

/** A table, with the alignment row dropped and the first row as headers. */
function Table({ rows }: { rows: string[] }) {
  const cells = (row: string) =>
    row
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());
  const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r));
  if (body.length === 0) return null;
  const [head, ...rest] = body.map(cells);
  return (
    // Its own scroller: a four-column table on a 390px phone is wider than the
    // column, and the alternative to scrolling it is the page scrolling
    // sideways, which moves everything else too.
    <div style={{ overflowX: 'auto', margin: '0 0 var(--sp-5)' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 'var(--type-sm)', minWidth: '100%' }}>
        <thead>
          <tr>
            {head.map((c, i) => (
              <th
                key={i}
                style={{
                  textAlign: 'left',
                  padding: 'var(--sp-3) var(--sp-5) var(--sp-3) 0',
                  borderBottom: '1px solid var(--app-line)',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {inline(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rest.map((row, i) => (
            <tr key={i}>
              {row.map((c, j) => (
                <td
                  key={j}
                  style={{
                    padding: 'var(--sp-3) var(--sp-5) var(--sp-3) 0',
                    borderBottom: '1px solid var(--app-line-soft)',
                    verticalAlign: 'top',
                    lineHeight: 'var(--leading-normal)',
                  }}
                >
                  {inline(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A fenced block, with what it is and a way to take it. */
function Code({ lang, body }: { lang: string; body: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      style={{
        margin: '0 0 var(--sp-5)',
        border: '1px solid var(--app-line)',
        borderRadius: 'var(--r-sm)',
        background: 'var(--app-hero)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          padding: 'var(--sp-2) var(--sp-4) var(--sp-2) var(--sp-5)',
          borderBottom: '1px solid var(--app-line-soft)',
        }}
      >
        <span
          style={{
            flex: 1,
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--type-xs)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.5,
          }}
        >
          {lang || 'code'}
        </span>
        <button
          type="button"
          className="bare"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(body)
              .then(() => setCopied(true))
              // Silent: a clipboard the browser refused is not something the
              // reader can act on, and the label simply does not change.
              .catch(() => {});
          }}
          style={{ flex: 'none', width: 'auto', fontSize: 'var(--type-xs)', letterSpacing: '0.1em', opacity: 0.6 }}
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: 'var(--sp-5)',
          fontSize: 'var(--type-xs)',
          lineHeight: 'var(--leading-normal)',
          whiteSpace: 'pre',
          overflowX: 'auto',
        }}
      >
        {body}
      </pre>
    </div>
  );
}

/**
 * Where a link in an answer is allowed to go.
 *
 * `http` and `https` only. Not a general "is this a URL" check — the point is
 * that `javascript:`, `data:` and `vbs:` never reach an `href`, and an
 * allowlist of two schemes is the only form of that check which cannot be
 * talked around by a string nobody thought of.
 */
function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.href);
    return /^https?:$/.test(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Bold, italic, code spans and links. Everything else stays as typed. */
function inline(text: string): ReactNode {
  const parts = text.split(
    /(\[[^\]]*\]\([^)\s]+\)|\*\*[^*]+\*\*|(?<![*\w])\*[^*\n]+\*(?!\w)|`[^`]+`)/g,
  );
  return parts.map((part, i) => {
    if (!part) return null;
    const key = `${i}-${part.slice(0, 12)}`;

    const link = /^\[([^\]]*)\]\(([^)\s]+)\)$/.exec(part);
    if (link) return <Link key={key} label={link[1]} to={link[2]} />;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} style={{ fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} style={INLINE_CODE}>
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

const INLINE_CODE = {
  fontSize: '0.92em',
  padding: '1px 4px',
  borderRadius: 'var(--r-sm)',
  background: 'var(--app-hero)',
  border: '1px solid var(--app-line)',
} as const;

/**
 * A link, which is two different things.
 *
 * `#/grades` is a place in this app and should behave like one: same tab, no
 * new window, and the router already knows how to read it. Anything else is
 * the web and opens away from the app, with `noopener` because a page opened
 * from here can otherwise reach back through `window.opener`.
 *
 * A link that is neither — a `javascript:` href, a malformed URL — renders as
 * its own label in plain text. It came from a model; it does not get an
 * `href` just for being formatted like one.
 */
function Link({ label, to }: { label: string; to: string }) {
  const inside = to.startsWith('#/') ? fromHash(to) : null;
  if (inside) {
    return (
      <a href={to} style={{ color: 'inherit', textUnderlineOffset: '2px' }}>
        {label || (inside.screen as Screen)}
      </a>
    );
  }
  const href = safeHref(to);
  if (!href) return <>{label || to}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'inherit', textUnderlineOffset: '2px' }}
    >
      {label || href}
    </a>
  );
}
