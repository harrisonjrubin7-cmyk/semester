import { useEffect, useState, type CSSProperties } from 'react';
import { Equation } from '../../components/Equation';
import {
  figureTable,
  nested,
  runs,
  type Align,
  type Block,
  type Branch,
  type Doc,
  type DocFigure,
  type Note,
  type Run,
} from '../../lib/document';
import { fontStack, layoutOf, lineHeight, pageSize } from '../../lib/doclayout';
import { outline } from '../../lib/doctools';
import { getFile } from '../../lib/files';

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
          <Margin notes={block.notes} />
        </div>
      ))}
    </article>
  );
}

/**
 * A block's alignment as the one style property it is.
 *
 * `undefined` rather than `'left'` when nothing is set, so the paragraph
 * inherits whatever the page is doing instead of overriding it with a value
 * that only looks like the absence of one.
 */
function set(align?: Align): CSSProperties | undefined {
  return align ? { textAlign: align } : undefined;
}

/** One block, drawn the way it will print. */
function Drawn({ block, headings }: { block: Block; headings: ReturnType<typeof outline> }) {
  switch (block.kind) {
    case 'heading': {
      const Tag = (['h3', 'h4', 'h5'] as const)[block.level - 1];
      return (
        <Tag className={`docpaper-h docpaper-h${block.level}`} style={set(block.align)}>
          <Marked text={block.text} />
        </Tag>
      );
    }
    case 'text':
      return (
        <p className="docpaper-p" style={set(block.align)}>
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
        <blockquote className="docpaper-quote" style={set(block.align)}>
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
    /*
     * A picture, which this drew as nothing at all.
     *
     * The page this component draws is "the way it will print", and a `.docx`
     * and a `.pdf` of the same document both carry the picture — so a student
     * checking the page before exporting saw a gap where a figure was going to
     * be, and had no way to know which of the three was telling the truth.
     *
     * Found the same way `lib/exportqa.ts` found the other four: by asking
     * every renderer what it does with every kind. The in-app view is the
     * third rendering and nothing had been comparing it either. The `never`
     * below is so the next kind cannot go missing the same way — this
     * function returns an element, and a kind with no case falls out of the
     * switch as `undefined`, which React draws as nothing and TypeScript is
     * content with.
     */
    case 'image':
      return (
        <figure className="docpaper-figure">
          <Held fileId={block.fileId} alt={block.alt || block.name || 'Picture'} />
          {block.caption.trim() && <figcaption className="docpaper-cap">{block.caption}</figcaption>}
        </figure>
      );
    case 'figure':
      return (
        <figure className="docpaper-figure">
          {block.figure.title.trim() && (
            <figcaption className="docpaper-cap">{block.figure.title}</figcaption>
          )}
          {block.figure.type === 'image' ? (
            <Held fileId={block.figure.fileId} alt={block.figure.title || 'Figure'} />
          ) : (
            <FigureTable figure={block.figure} />
          )}
          {block.figure.caption.trim() && (
            <figcaption className="docpaper-cap">{block.figure.caption}</figcaption>
          )}
        </figure>
      );
    case 'rule':
      return <hr className="docpaper-rule" />;
    case 'break':
      return <div className="docpaper-break" aria-hidden="true" />;
  }
  const missed: never = block;
  return missed;
}

/**
 * A figure's numbers, as the table both exports write.
 *
 * Through `figureTable`, so this page and the two files cannot disagree about
 * what a bar chart says — which is the whole argument of `lib/exportqa.ts`,
 * applied to the rendering it cannot see.
 */
function FigureTable({ figure }: { figure: DocFigure }) {
  const made = figureTable(figure);
  if (!made) return null;
  return (
    <table className="docpaper-table">
      <tbody>
        {made.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) =>
              r === 0 ? (
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
  );
}

/**
 * A picture out of the drive, drawn on the page.
 *
 * The object URL is revoked when the block changes or the page closes, the
 * same care `PictureEditor` takes and for the same reason: a document with
 * eight figures in it, re-rendered as somebody types, is eight blobs a render.
 */
function Held({ fileId, alt }: { fileId: string; alt: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let made = '';
    let dropped = false;
    /*
     * Caught, not just awaited. A drive that refuses — private browsing, a
     * quota, a jsdom with no IndexedDB in it — rejects here, and a rejection
     * inside an effect is unhandled: it reaches the window, not the caller.
     * There is nothing for a reader to do about it, and the answer is already
     * written: no picture, and the caption under it, which is what both
     * exports print for a file that is gone.
     */
    const reading = fileId ? getFile(fileId).catch(() => undefined) : Promise.resolve(undefined);
    void reading.then((file) => {
      if (dropped) return;
      if (!file) {
        setUrl('');
        return;
      }
      made = URL.createObjectURL(file.blob);
      setUrl(made);
    });
    return () => {
      dropped = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [fileId]);
  // Nothing rather than a broken-image icon: a file taken out of the drive is
  // a caption with no picture, which is what both exports do with it too.
  if (!url) return null;
  return <img className="docpaper-picture" src={url} alt={alt} />;
}

/**
 * The notes against a block, out in the margin beside it.
 *
 * Out in the margin and not in the flow, because a note is not part of the
 * document: it must not shift the text it is about, and it must not print.
 * `.docpaper-note` is absolutely positioned and the print rule hides it — the
 * page this draws is the page that comes out of the printer, which is the
 * whole reason this component exists.
 *
 * Where the margin is too narrow to hold one — a phone — the stylesheet
 * brings them back into the flow rather than off the side of the screen,
 * because a note nobody can reach is a note nobody wrote.
 */
function Margin({ notes }: { notes?: Note[] }) {
  const said = (notes ?? []).filter((n) => n.text.trim());
  if (said.length === 0) return null;
  return (
    <aside className="docpaper-notes" aria-label="Notes on this block">
      {said.map((note) => (
        <p key={note.id} className={`docpaper-note${note.done ? ' docpaper-note-done' : ''}`}>
          {note.text}
        </p>
      ))}
    </aside>
  );
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
  if (run.underline) body = <u>{body}</u>;
  if (run.strike) body = <s>{body}</s>;
  /*
   * `<mark>` rather than a span with a background, so the highlight survives
   * being copied into anything else and is announced as a highlight rather
   * than read straight past. The colour is fixed in `app.css` beside the rest
   * of the page's, not taken from the ground: the page is white here and on
   * paper whatever the app's theme is, and a highlighter that changed colour
   * with the theme would print differently from how it looked.
   */
  if (run.highlight) body = <mark className="docpaper-mark">{body}</mark>;
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
