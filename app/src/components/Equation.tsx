import { useMemo } from 'react';
import { mathml, parse, plain } from '../lib/maths';
import { secondLine } from '../lib/dim';

/**
 * An equation, laid out by the browser.
 *
 * MathML rather than a picture or a library. Every current browser lays it out
 * natively, it costs nothing to ship, it stays selectable, and it is read out
 * as an equation by a screen reader rather than as a run of characters — which
 * an image of an equation, or a `<span>` of glyphs positioned by JavaScript,
 * are not.
 *
 * ## The `dangerouslySetInnerHTML`
 *
 * React cannot build MathML elements from JSX — they are not in its element
 * namespace — so the markup goes in as a string, and the string is the one
 * thing on this screen worth being careful about.
 *
 * It is safe for a reason that is structural rather than a promise: the
 * markup is not the person's text. `lib/maths.ts` parses what they typed into
 * a tree of runs, fractions and scripts, and then *writes* the markup from
 * that tree, escaping every piece of text on the way out. There is no path by
 * which a `<script>` typed into the box arrives here as a tag — it arrives as
 * `&lt;script&gt;` inside an `<mtext>`, because that is all a run can become.
 *
 * ## The fallback
 *
 * Under the equation, the same thing as one line of ordinary text — dimmed and
 * small. Not decoration: it is what somebody copies to paste into an email,
 * and it is the honest check that the app read the notation the way they
 * meant. An equation that renders wrong and says nothing is worse than one
 * that renders wrong beside a line you can read.
 */
export function Equation({
  latex,
  showPlain = false,
  align = 'center',
  inline = false,
}: {
  latex: string;
  /** The one-line version under it. On in the editor, off inside a document. */
  showPlain?: boolean;
  align?: 'center' | 'start';
  /**
   * A symbol inside a sentence rather than an equation on its own line.
   *
   * What a glossary needs: `E_d` has no subscript character in Unicode — the
   * set stops at a handful of letters — so the one-line fallback renders it
   * `E_(d)`, which reads as a mistake in a list explaining what the symbols
   * mean. Inline MathML draws the real subscript at the size of the text
   * around it.
   */
  inline?: boolean;
}) {
  const { markup, line } = useMemo(() => {
    const tree = parse(latex);
    return { markup: mathml(tree, inline ? 'inline' : 'block'), line: plain(tree) };
  }, [latex, inline]);

  if (!latex.trim()) return null;

  if (inline) {
    return (
      <span
        // See the note above: written by `lib/maths.ts`, escaped on the way out.
        dangerouslySetInnerHTML={{ __html: markup }}
        style={{ display: 'inline-block' }}
      />
    );
  }

  return (
    <div style={{ textAlign: align === 'center' ? 'center' : 'left' }}>
      <div
        // See the note above: this markup is written by `lib/maths.ts` from a
        // parsed tree, with every piece of text escaped on the way out.
        dangerouslySetInnerHTML={{ __html: markup }}
        style={{ fontSize: 'var(--type-lg)', overflowX: 'auto' }}
      />
      {showPlain ? (
        <div
          style={{
            ...secondLine(),
            fontSize: 'var(--type-sm)',
            marginTop: 'var(--sp-2)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            wordBreak: 'break-word',
          }}
        >
          {line}
        </div>
      ) : null}
    </div>
  );
}
