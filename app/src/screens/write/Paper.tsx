import { Equation } from '../../components/Equation';
import { nested, runs, type Block, type Branch, type Doc, type Run } from '../../lib/document';
import { fontStack, layoutOf, lineHeight, pageSize } from '../../lib/doclayout';
import { outline } from '../../lib/doctools';

/**
 * The document as the page it will be.
 *
 * The editor is a stack of labelled cards, and cards are the right shape for
 * *editing* a block and the wrong shape for judging a document. Word and Docs
 * both answer this the same way and have since 1997: a page, at the width of
 * a page, in the font it will actually be printed in. It is the difference
 * between finding out a title runs to three lines now and finding out in the
 * Word file at eleven at night.
 *
 * ## It is also what prints
 *
 * Printing used to print the editor — the cards, the labels, the fields, the
 * move buttons — so "Print, or save as PDF" produced a PDF of a form rather
 * than of a document. This is in the DOM whether or not page view is on, and
 * the print rule in `app.css` hides the editor and shows this. So the PDF is
 * the document, on the paper it was set up for, in the font it was set up in.
 *
 * ## Read-only, on purpose
 *
 * A page you can type into is a rich-text editor, which is the trap
 * `lib/document.ts` opens by refusing: a contenteditable produces whatever
 * HTML the browser felt like and converting it to Word means a parser whose
 * failures are silent. This draws; the cards edit. A block pressed here takes
 * you to its card, which is the one thing a preview owes you.
 */
export function Paper({ doc, onGo }: { doc: Doc; onGo?: (at: number) => void }) {
  const layout = layoutOf(doc);
  const { width } = pageSize(layout.paper);

  /*
   * The page's own measurements, as custom properties rather than as font
   * sizes in the style object.
   *
   * A preview of a printed page is the one place in this app where a real
   * point size is the correct thing to draw: the whole purpose is to show
   * 12-point Times at the width of a sheet of Letter. The app's text-size
   * setting scales the chrome around it and deliberately does not scale this,
   * for the same reason Word's zoom is not its font size.
   */
  const page = {
    '--doc-font': fontStack(layout.font),
    '--doc-size': `${layout.size}pt`,
    '--doc-leading': String(lineHeight(layout.spacing)),
    '--doc-width': `${width}in`,
    '--doc-margin': `${layout.margin}in`,
  } as React.CSSProperties;

  const headings = outline(doc);

  return (
    <article className="docpaper" style={page} aria-label="The document as a page">
      {(layout.numbers || layout.runningHead.trim()) && (
        <div className="docpaper-head" aria-hidden="true">
          {[layout.runningHead.trim(), layout.numbers ? '1' : ''].filter(Boolean).join(' ')}
        </div>
      )}
      {/*
        The document's title is an `h2`, not an `h1`.
        The shell already prints one `h1` per screen and a second under it is
        a heading outline with two tops — see `a11y/landmarks.test.ts`. The
        levels below it shift down to match, so the outline a screen reader
        reads is the outline of the document.
      */}
      {doc.title.trim() && <h2 className="docpaper-title">{doc.title}</h2>}
      {doc.subtitle.trim() && <p className="docpaper-sub">{doc.subtitle}</p>}
      {layout.titlePage && doc.title.trim() && <div className="docpaper-break" aria-hidden="true" />}

      {doc.blocks.map((block, at) => (
        <div
          key={at}
          className="docpaper-block"
          /*
           * A click goes to the card that edits it. Not a button: a page made
           * of buttons reads as a form to a screen reader and prints as one
           * too, which is the fault this whole component exists to fix. The
           * handler is an affordance for a pointer and the editor below is
           * the way in for everybody else.
           */
          onClick={onGo ? () => onGo(at) : undefined}
        >
          <Drawn block={block} headings={headings} />
        </div>
      ))}
    </article>
  );
}

/** One block, drawn the way it will print. */
function Drawn({ block, headings }: { block: Block; headings: ReturnType<typeof outline> }) {
  switch (block.kind) {
    case 'heading': {
      const Tag = (['h3', 'h4', 'h5'] as const)[block.level - 1];
      return <Tag className={`docpaper-h docpaper-h${block.level}`}>{<Marked text={block.text} />}</Tag>;
    }
    case 'text':
      return (
        <p className="docpaper-p">
          <Marked text={block.text} />
        </p>
      );
    case 'bullets':
      return <Nest branches={nested(block.items)} numbered={block.numbered} />;
    case 'checks':
      return (
        <ul className="docpaper-list docpaper-ticks">
          {block.items.map((item, i) => (
            <li key={i} className={item.done ? 'docpaper-done' : undefined}>
              <span aria-hidden="true">{item.done ? '☒ ' : '☐ '}</span>
              <span className="sr-only">{item.done ? 'Done: ' : 'Not done: '}</span>
              <Marked text={item.text} />
            </li>
          ))}
        </ul>
      );
    case 'quote':
      return (
        <blockquote className="docpaper-quote">
          <Marked text={block.text} />
          {block.source.trim() && <footer className="docpaper-cap">— {block.source}</footer>}
        </blockquote>
      );
    case 'table':
      return (
        <figure className="docpaper-figure">
          <table className="docpaper-table">
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) =>
                    block.header && r === 0 ? (
                      <th key={c} scope="col">
                        {cell}
                      </th>
                    ) : (
                      <td key={c}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {block.caption.trim() && <figcaption className="docpaper-cap">{block.caption}</figcaption>}
        </figure>
      );
    case 'equation':
      return (
        <figure className="docpaper-figure docpaper-eq">
          <Equation latex={block.latex} />
          {block.caption.trim() && <figcaption className="docpaper-cap">{block.caption}</figcaption>}
        </figure>
      );
    case 'code':
      return (
        <pre className="docpaper-code">
          <code>{block.text}</code>
        </pre>
      );
    /*
     * The contents, built from the headings every time this is drawn.
     *
     * No page numbers, for the reason written on the block in
     * `lib/document.ts`: nothing in a browser knows where Word will break a
     * page, and confidently wrong numbers on a contents page are worse than
     * none at all.
     */
    case 'toc':
      return headings.length === 0 ? null : (
        <nav className="docpaper-toc" aria-label={block.title || 'Contents'}>
          <h3 className="docpaper-h docpaper-h1">{block.title || 'Contents'}</h3>
          {headings.map((h) => (
            <div key={`${h.at}-${h.text}`} className={`docpaper-toc-line docpaper-toc${h.level}`}>
              {h.text}
            </div>
          ))}
        </nav>
      );
    /*
     * A real `<hr>`, not a bordered div: it is what the element is for, and a
     * screen reader announces it as a separator, which is the whole of what
     * the line is saying.
     */
    case 'rule':
      return <hr className="docpaper-rule" />;
    case 'break':
      return <div className="docpaper-break" aria-hidden="true" />;
  }
}

/**
 * A list, drawn as the tree it is.
 *
 * A sub-list is a `<ul>` inside its parent's `<li>`, which is what HTML means
 * by a nested list and what a screen reader reads as one — six flat rows with
 * padding on three of them announce six items, not three and three. The
 * browser's own indentation and marker cycling then do the drawing, so there
 * is no per-level styling here to keep in step with the Word file.
 */
function Nest({ branches, numbered }: { branches: Branch[]; numbered: boolean }) {
  if (branches.length === 0) return null;
  const List = numbered ? 'ol' : 'ul';
  return (
    <List className="docpaper-list">
      {branches.map((branch, i) => (
        <li key={i}>
          <Marked text={branch.line.text} />
          <Nest branches={branch.under} numbered={numbered} />
        </li>
      ))}
    </List>
  );
}

/** A line of text with its marks drawn — the on-screen half of `runs`. */
function Marked({ text }: { text: string }) {
  return (
    <>
      {runs(text).map((piece, i) => (
        <Piece key={i} run={piece} />
      ))}
    </>
  );
}

function Piece({ run }: { run: Run }) {
  let body: React.ReactNode = run.text;
  if (run.code) body = <code className="docpaper-tt">{body}</code>;
  if (run.bold) body = <strong>{body}</strong>;
  if (run.italic) body = <em>{body}</em>;
  if (run.strike) body = <s>{body}</s>;
  if (run.link) {
    /*
     * `rel="noreferrer"` and a new tab, because a link inside somebody's own
     * coursework is the one place a page should not be replaced under them —
     * losing an unsaved paragraph to a mis-tapped citation is the sort of
     * thing that stops people trusting an editor.
     */
    body = (
      <a href={run.link} target="_blank" rel="noreferrer noopener">
        {body}
      </a>
    );
  }
  return <>{body}</>;
}
