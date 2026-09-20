/**
 * Reading a .docx into blocks — the other half of `lib/docx.ts`.
 *
 * `xlsxin.ts` is the same idea for spreadsheets and says why it matters: a
 * file the app can only write is a file you have to start again in. A student
 * whose professor sent round a Word template, or who drafted three pages on a
 * library machine, had no way in at all.
 *
 * ## This is not `extract.ts`'s reader
 *
 * `extract.ts` also opens a .docx and deliberately flattens it: it pulls the
 * words out for *search* and for feeding a syllabus to the parser, and its
 * own comment says tables come out as text and formatting is discarded. That
 * is right for what it does. This one is the opposite job — the structure is
 * the point — so the two live apart rather than one growing a flag. They
 * share the entity decoder, because two copies of that is two chances to get
 * its ordering wrong.
 *
 * ## Read with patterns, not a parser
 *
 * The same choice `xlsxin.ts` made, and for its reason: the parts that matter
 * are few enough to lift out by hand, and a DOMParser is a browser object
 * this file would then need in every test. The patterns are namespace-
 * tolerant — `w:p` and a bare `p` both match — because what writes a .docx is
 * not always Word.
 *
 * ## What comes across, and what cannot
 *
 * Headings, paragraphs, lists (nested, bulleted or numbered), checklists,
 * tables, quotations, code, page breaks, dividers, pictures, alignment, and
 * bold, italic, strike-through, monospace and links inside a line.
 *
 * An equation does not: Word stores it as OMML, and turning OMML back into
 * the LaTeX this app edits is a second parser with its own failures. It comes
 * through as the words in it, and `notes` says so. Comments, tracked changes,
 * footnotes, headers, text boxes and anything drawn rather than written are
 * dropped the same way — named in `notes` rather than silently missing, which
 * is the whole reason `notes` exists.
 */

import { blankDoc, type Align, type Block, type Doc, type Line, type Note } from './document';
import { entities } from './extract';
import { tooPacked, tooPackedSaid } from './zips';

export interface Read {
  /** The document, ready for an id. The title comes from the file's own. */
  doc: Omit<Doc, 'id'>;
  /**
   * The pictures, as bytes, for the caller to put in the drive.
   *
   * Not filed here, for the reason `parts()` does not read them on the way
   * out: this stays a function of what it is handed, which is what lets its
   * tests open a .docx without a browser. Each one names the `image` block
   * that points at it, by the `name` the block carries. See the Write screen.
   */
  media: { name: string; type: string; bytes: Uint8Array }[];
  /** What the reader could not bring, in words meant for the student. */
  notes: string[];
}

/** `<w:p …>` and `<p …>` alike — what writes a .docx is not always Word. */
const ns = (tag: string) => `(?:[A-Za-z_][\\w.-]*:)?${tag}`;

/**
 * One opening tag, with the name ending where the name ends.
 *
 * The lookahead is not decoration. Without it `<a:blip …>` is written
 * `<(?:\w+:)?blip[^>]*>`, and `[^>]*` is perfectly happy to swallow the
 * `Fill` in `<pic:blipFill>` — which sits four characters earlier in every
 * picture Word writes, matches first, and carries no `r:embed`. The picture
 * then reads as a paragraph with no text in it and is dropped without a word.
 * That is what this cost before it was written down.
 */
const opening = (tag: string) => `<${ns(tag)}(?=[\\s/>])[^>]*>`;

function attr(source: string, name: string): string {
  const found = new RegExp(`\\s(?:[A-Za-z_][\\w.-]*:)?${name}="([^"]*)"`).exec(source);
  return found ? entities(found[1]) : '';
}

/** Whether an element appears anywhere inside a chunk. */
const has = (source: string, tag: string) => new RegExp(`<${ns(tag)}[\\s/>]`).test(source);

/**
 * The body, split into the paragraphs and tables it is made of, in order.
 *
 * Scanned rather than matched with one pattern, because a table holds
 * paragraphs: `</w:p>` would otherwise close the first cell's paragraph and
 * take the table apart from the inside. Tables can hold tables, so their
 * close is found by counting; paragraphs cannot hold paragraphs, so theirs is
 * the first one along.
 */
function chunks(body: string): { kind: 'p' | 'tbl'; xml: string }[] {
  const out: { kind: 'p' | 'tbl'; xml: string }[] = [];
  const opens = new RegExp(`<(${ns('tbl')}|${ns('p')})(\\s[^>]*)?(/?)>`, 'g');
  let at = 0;
  for (;;) {
    opens.lastIndex = at;
    const open = opens.exec(body);
    if (!open) break;
    const name = open[1];
    const kind = /tbl$/.test(name) ? 'tbl' : 'p';
    // `<w:p/>` — an empty paragraph, which this app writes after a table.
    if (open[3] === '/') {
      out.push({ kind, xml: open[0] });
      at = open.index + open[0].length;
      continue;
    }
    const close = `</${name}>`;
    let from = open.index + open[0].length;
    let depth = 1;
    const nested = new RegExp(`<${name}(?:\\s[^>]*)?>|${close}`, 'g');
    nested.lastIndex = from;
    let end = -1;
    for (;;) {
      const step = nested.exec(body);
      if (!step) break;
      depth += step[0] === close ? -1 : 1;
      if (depth === 0) {
        end = step.index + step[0].length;
        break;
      }
    }
    if (end === -1) break;
    out.push({ kind, xml: body.slice(open.index, end) });
    at = end;
    from = end;
  }
  return out;
}

/** The style a paragraph names, as Word spells the id — `Heading1`, `Quote`. */
const styleOf = (p: string) => {
  const found = new RegExp(opening('pStyle')).exec(p);
  return found ? attr(found[0], 'val') : '';
};

const ALIGNMENTS: Record<string, Align> = {
  left: 'left',
  start: 'left',
  center: 'center',
  centre: 'center',
  right: 'right',
  end: 'right',
  both: 'justify',
  distribute: 'justify',
};

function alignOf(p: string): Align | undefined {
  const found = new RegExp(opening('jc')).exec(p);
  return found ? ALIGNMENTS[attr(found[0], 'val')] : undefined;
}

/**
 * A paragraph's text, with its marks written back as the marks this app edits.
 *
 * `runs()` in `lib/document.ts` reads `**bold**`; Word stores a `<w:b/>` on
 * the run. This is that in reverse, and it is where a round trip through Word
 * either keeps somebody's emphasis or quietly loses it.
 *
 * The markers go outside any spaces at the edges of a run. Word splits a
 * sentence into runs wherever a property changes, so a bold phrase commonly
 * arrives as `"the "` + `"important"` + `" bit"` — and `** important **` is
 * not emphasis in markdown, it is four asterisks and a word.
 */
function textOf(p: string, links: Record<string, string>, inLink = false): string {
  let out = '';
  const parts = new RegExp(
    `<(${ns('hyperlink')}|${ns('r')})(\\s[^>]*)?>([\\s\\S]*?)</\\1>`,
    'g',
  );
  for (const part of p.matchAll(parts)) {
    const [, name, head = '', inner] = part;
    if (/hyperlink$/.test(name)) {
      const target = links[attr(head, 'id')] ?? '';
      /*
       * `inLink`, because every word processor underlines a link and none of
       * them means it as emphasis. Without this a round trip turns
       * `[words](url)` into `[++words++](url)` — the link's own decoration
       * read back as something the writer typed, and it compounds: each pass
       * through Word would add another pair.
       */
      const words = textOf(inner, links, true);
      out += target && words ? `[${words}](${target})` : words;
      continue;
    }
    out += marked(inner, inLink);
  }
  return out;
}

/** One run's words, wrapped in whatever its properties say it is. */
function marked(run: string, inLink = false): string {
  const props = new RegExp(`<${ns('rPr')}(?:\\s[^>]*)?>([\\s\\S]*?)</${ns('rPr')}>`).exec(run);
  const rPr = props ? props[1] : '';
  // `<w:b w:val="0"/>` is bold turned *off*, which Word writes when a style
  // is bold and one run is not. Reading it as bold inverts the emphasis.
  const on = (tag: string) => {
    const found = new RegExp(`<${ns(tag)}(?:\\s[^>]*)?/?>`).exec(rPr);
    if (!found) return false;
    const val = attr(found[0], 'val');
    return val !== '0' && val !== 'false' && val !== 'none';
  };
  /* `docx.ts` writes inline code as a named character style rather than as a
     font on the run — see the note on `run()` there — so the style is looked
     at first and the font names are the fallback for everything else. */
  const style = new RegExp(opening('rStyle')).exec(rPr);
  const mono =
    (style ? /code|verbatim|mono/i.test(attr(style[0], 'val')) : false) ||
    /Consolas|Courier|Mono/i.test(rPr);

  let body = '';
  for (const piece of run.matchAll(
    new RegExp(`<${ns('t')}(?:\\s[^>]*)?>([\\s\\S]*?)</${ns('t')}>|<${ns('tab')}[^>]*>`, 'g'),
  )) {
    body += piece[1] === undefined ? '\t' : entities(piece[1]);
  }
  if (!body.trim()) return body;

  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(body)!;
  let wrapped = core;
  if (mono) wrapped = `\`${wrapped}\``;
  /* `<w:highlight w:val="none"/>` is the pen lifted, which `on` already reads
     as off along with `0` and `false`. */
  if (on('highlight')) wrapped = `==${wrapped}==`;
  if (!inLink && on('u')) wrapped = `++${wrapped}++`;
  if (on('strike')) wrapped = `~~${wrapped}~~`;
  if (on('i')) wrapped = `*${wrapped}*`;
  if (on('b')) wrapped = `**${wrapped}**`;
  return `${lead}${wrapped}${trail}`;
}

/** The relationship ids a part points out with, by id. */
function relationships(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rel of xml.matchAll(/<Relationship\s[^>]*>/g)) {
    out[attr(rel[0], 'Id')] = attr(rel[0], 'Target');
  }
  return out;
}

/**
 * Which numbering definitions are bulleted.
 *
 * A list paragraph names a `numId`, which points at an `abstractNumId`, whose
 * level 0 says `bullet` or `decimal`. Getting this wrong turns somebody's
 * numbered steps into bullets, which is a list that has lost what made it a
 * list.
 */
function bulleted(numbering: string): Record<string, boolean> {
  const formats: Record<string, boolean> = {};
  for (const block of numbering.matchAll(
    new RegExp(`<${ns('abstractNum')}(\\s[^>]*)?>([\\s\\S]*?)</${ns('abstractNum')}>`, 'g'),
  )) {
    const id = attr(block[1] ?? '', 'abstractNumId');
    const first = new RegExp(opening('numFmt')).exec(block[2]);
    formats[id] = first ? attr(first[0], 'val') === 'bullet' : true;
  }
  const out: Record<string, boolean> = {};
  for (const num of numbering.matchAll(
    // The leading whitespace is captured with the attributes, because `attr`
    // looks for one in front of the name — a `numId` read off a string that
    // begins with it comes back empty, and every list then reads as bulleted.
    new RegExp(`<${ns('num')}(\\s[^>]*)?>([\\s\\S]*?)</${ns('num')}>`, 'g'),
  )) {
    const points = new RegExp(opening('abstractNumId')).exec(num[2]);
    out[attr(num[1] ?? '', 'numId')] = points ? (formats[attr(points[0], 'val')] ?? true) : true;
  }
  return out;
}

/**
 * What each paragraph style says about numbering, out of `styles.xml`.
 *
 * Word does not put `<w:numPr>` on a list paragraph it styled with *List
 * Bullet*: the numbering lives in the style, and the paragraph carries only
 * the style's name. Reading the document alone — which is all this did at
 * first — turns every list in every Word-made file into a run of ordinary
 * paragraphs, and it does it silently, because the words are all still there.
 *
 * The level is the other half. Word's built-in list styles have no `w:ilvl`
 * at all; the depth is in the *name*, `ListBullet2` being the second level,
 * each pointing at a numbering definition of its own. So the trailing digit
 * is read where there is no explicit level, which is what makes a nested
 * bulleted list from Word arrive nested.
 */
interface Numbering {
  numId: string;
  level: number;
}

function styleNumbering(styles: string): Record<string, Numbering> {
  const out: Record<string, Numbering> = {};
  for (const style of styles.matchAll(
    new RegExp(`<${ns('style')}(\\s[^>]*)?>([\\s\\S]*?)</${ns('style')}>`, 'g'),
  )) {
    const id = attr(style[1] ?? '', 'styleId');
    if (!id) continue;
    const numPr = new RegExp(`<${ns('numPr')}(?:\\s[^>]*)?>([\\s\\S]*?)</${ns('numPr')}>`).exec(
      style[2],
    );
    if (!numPr) continue;
    const idTag = new RegExp(opening('numId')).exec(numPr[1]);
    const levelTag = new RegExp(opening('ilvl')).exec(numPr[1]);
    const named = /(\d+)$/.exec(id);
    const level = levelTag
      ? Number(attr(levelTag[0], 'val')) || 0
      : named
        ? Number(named[1]) - 1
        : 0;
    out[id] = { numId: idTag ? attr(idTag[0], 'val') : '', level: Math.max(0, level) };
  }
  return out;
}

/**
 * The comments a document carries, by the id the body refers to them with.
 *
 * Two parts. `comments.xml` holds the words; whether one is *resolved* is in
 * `commentsExtended.xml`, which finds a comment by the `w14:paraId` of its
 * paragraph rather than by the comment's own id — so the two are joined on
 * that, and a file without the second part reads as nothing resolved, which
 * is what it means.
 */
function remarksIn(comments: string, extended: string): Record<string, Note> {
  const done = new Set<string>();
  for (const ex of extended.matchAll(new RegExp(opening('commentEx'), 'g'))) {
    const at = attr(ex[0], 'paraId');
    const says = attr(ex[0], 'done');
    if (at && says !== '0' && says !== 'false' && says !== '') done.add(at.toUpperCase());
  }
  const out: Record<string, Note> = {};
  for (const one of comments.matchAll(
    new RegExp(`<${ns('comment')}(\\s[^>]*)?>([\\s\\S]*?)</${ns('comment')}>`, 'g'),
  )) {
    const head = one[1] ?? '';
    const id = attr(head, 'id');
    if (!id) continue;
    const text = chunks(one[2])
      .filter((c) => c.kind === 'p')
      .map((c) => textOf(c.xml, {}).trim())
      .filter(Boolean)
      .join('\n');
    if (!text) continue;
    const para = new RegExp(opening('p')).exec(one[2]);
    const at = para ? attr(para[0], 'paraId').toUpperCase() : '';
    const written = Date.parse(attr(head, 'date'));
    out[id] = {
      id: `c${id}`,
      text,
      at: Number.isFinite(written) ? written : Date.now(),
      done: at !== '' && done.has(at),
    };
  }
  return out;
}

/** Which comments a paragraph opens, in the order it opens them. */
function commentIds(p: string): string[] {
  return [...p.matchAll(new RegExp(opening('commentRangeStart'), 'g'))]
    .map((m) => attr(m[0], 'id'))
    .filter(Boolean);
}

const TICKED = /^\s*([☐☒☑✓✔])\s*/;

export async function fromDocx(file: File): Promise<Read> {
  if (tooPacked(file)) {
    throw new Error(
      tooPackedSaid(file.name, 'Save the part you need as a smaller file, or paste the text in.'),
    );
  }
  const { unzipSync, strFromU8 } = await import('fflate');
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error(
      `${file.name} could not be opened as a Word file. If it is an older .doc, open it in ` +
        'Word and save it again as .docx.',
    );
  }
  const part = (name: string) => (zip[name] ? strFromU8(zip[name]) : '');
  const xml = part('word/document.xml');
  if (!xml) throw new Error('That .docx has no document inside it.');

  const links = relationships(part('word/_rels/document.xml.rels'));
  const lists = bulleted(part('word/numbering.xml'));
  const styled = styleNumbering(part('word/styles.xml'));
  const remarks = remarksIn(part('word/comments.xml'), part('word/commentsExtended.xml'));

  const notes = new Set<string>();
  const blocks: Block[] = [];
  const media: Read['media'] = [];
  let title = '';
  let subtitle = '';

  /* The block still open, so that consecutive paragraphs of one kind join up.
     Word has no list element and no code element — it has a run of paragraphs
     that each name the same style — so this is what turns eleven `Code`
     paragraphs back into one snippet rather than eleven. */
  let open: Block | null = null;
  const close = () => {
    if (open) blocks.push(open);
    open = null;
  };

  const body = new RegExp(`<${ns('body')}(?:\\s[^>]*)?>([\\s\\S]*)</${ns('body')}>`).exec(xml);
  /*
   * One chunk, placed. A function rather than the loop body it was, so
   * that the loop can see *which* block a paragraph landed in and hang
   * that paragraph's comments on it — a list's comment arrives on its
   * first item and belongs to the whole list, which by then is the block
   * still open rather than the last one pushed.
   */
  const place = (chunk: { kind: 'p' | 'tbl'; xml: string }) => {
      if (chunk.kind === 'tbl') {
        close();
        blocks.push(tableOf(chunk.xml, links));
        return;
      }
      const p = chunk.xml;
      const style = styleOf(p);
      const align = alignOf(p);

      if (has(p, 'br') && /w:type="page"|\stype="page"/.test(p)) {
        close();
        blocks.push({ kind: 'break' });
        return;
      }

      const picture = pictureOf(p, links, zip, media);
      if (picture) {
        close();
        blocks.push(picture);
        return;
      }

      const words = textOf(p, links).trim();

      // An empty paragraph carrying a bottom border is a divider — which is
      // what Word's own Borders button draws, and what `docx.ts` writes.
      if (!words && has(p, 'pBdr') && /bottom/.test(p)) {
        close();
        blocks.push({ kind: 'rule' });
        return;
      }

      if (has(p, 'oMath') || has(p, 'oMathPara')) {
        notes.add('An equation came through as its words — Word stores one in a form this app cannot read back into a formula.');
      }

      if (style === 'Title' && words) {
        close();
        title ||= words;
        return;
      }
      if (style === 'Subtitle' && words) {
        close();
        subtitle ||= words;
        return;
      }

      if (!words) {
        close();
        return;
      }

      /* The paragraph's own numbering, or the one its style carries — see
         `styleNumbering`, and the Word file that made it necessary. */
      const numbering = new RegExp(`<${ns('numPr')}(?:\\s[^>]*)?>([\\s\\S]*?)</${ns('numPr')}>`).exec(p);
      const fromStyle = styled[style];
      if (numbering || fromStyle) {
        const inner = numbering ? numbering[1] : '';
        const levelTag = new RegExp(opening('ilvl')).exec(inner);
        const idTag = new RegExp(opening('numId')).exec(inner);
        const level = levelTag
          ? Number(attr(levelTag[0], 'val')) || 0
          : (fromStyle?.level ?? 0);
        const numId = idTag ? attr(idTag[0], 'val') : (fromStyle?.numId ?? '');
        const numbered = lists[numId] === false;
        const tick = TICKED.exec(words);
        if (tick) {
          const done = tick[1] !== '☐';
          const text = words.replace(TICKED, '');
          if (open?.kind === 'checks') open.items.push({ text, done });
          else {
            close();
            open = { kind: 'checks', items: [{ text, done }] };
          }
          return;
        }
        const line: Line = { text: words, level };
        if (open?.kind === 'bullets' && open.numbered === numbered) open.items.push(line);
        else {
          close();
          open = { kind: 'bullets', items: [line], numbered };
        }
        return;
      }

      // A ticked line that lost its numbering — Pages writes one as an ordinary
      // paragraph — is still a checklist to anybody reading it.
      const loose = TICKED.exec(words);
      if (loose) {
        const done = loose[1] !== '☐';
        const text = words.replace(TICKED, '');
        if (open?.kind === 'checks') open.items.push({ text, done });
        else {
          close();
          open = { kind: 'checks', items: [{ text, done }] };
        }
        return;
      }

      if (style === 'Code' || style === 'HTMLPreformatted' || style === 'SourceCode') {
        const line = textOf(p, links).replace(/^`|`$/g, '');
        if (open?.kind === 'code') open.text += `\n${line}`;
        else {
          close();
          open = { kind: 'code', text: line, language: '' };
        }
        return;
      }

      close();

      const heading = /^Heading\s?([1-9])$/i.exec(style);
      if (heading) {
        const level = Math.min(3, Number(heading[1])) as 1 | 2 | 3;
        if (Number(heading[1]) > 3) {
          notes.add('Headings below level 3 came in as level 3 — this app has three.');
        }
        blocks.push({ kind: 'heading', level, text: words, ...(align ? { align } : null) });
        return;
      }

      if (style === 'Quote' || style === 'IntenseQuote' || style === 'BlockText') {
        blocks.push({ kind: 'quote', text: words, source: '', ...(align ? { align } : null) });
        return;
      }

      /* A caption under a quotation is its attribution, which this app keeps as
         a field of the quotation rather than as a paragraph of its own. */
      const previous = blocks[blocks.length - 1];
      if (style === 'Caption' && previous?.kind === 'quote' && !previous.source) {
        previous.source = words.replace(/^[—–-]\s*/, '');
        return;
      }

      blocks.push({ kind: 'text', text: words, ...(align ? { align } : null) });
  };

  for (const chunk of chunks(body ? body[1] : xml)) {
    const ids = commentIds(chunk.xml);
    place(chunk);
    if (ids.length) {
      const target = open ?? blocks[blocks.length - 1];
      const found = ids.map((id) => remarks[id]).filter((n): n is Note => Boolean(n));
      if (target && found.length) target.notes = [...(target.notes ?? []), ...found];
    }
  }
  close();

  /* A comment whose range this reader never met — one anchored inside a
     footnote, or to a run in a text box — is still a comment that did not
     arrive, and saying nothing about it would be the silence this list
     exists to avoid. */
  if (has(xml, 'commentReference') && Object.keys(remarks).length === 0) {
    notes.add('A comment could not be placed against any block, and was left behind.');
  }
  if (has(xml, 'ins') || has(xml, 'del')) notes.add('Tracked changes were flattened: insertions are in, deletions are out.');
  if (part('word/footnotes.xml').includes('<w:footnote ')) {
    notes.add('Footnotes were left behind.');
  }
  if (has(xml, 'txbxContent')) notes.add('A text box was left behind.');

  const named = file.name.replace(/\.docx$/i, '').trim();
  return {
    doc: { ...blankDoc(title || named || 'Untitled document'), subtitle, blocks: blocks.length ? blocks : [{ kind: 'text', text: '' }] },
    media,
    notes: [...notes],
  };
}

/** A table, as the rows of text this app's own table block holds. */
function tableOf(xml: string, links: Record<string, string>): Block {
  const rows: string[][] = [];
  let header = false;
  for (const tr of xml.matchAll(new RegExp(`<${ns('tr')}(?:\\s[^>]*)?>([\\s\\S]*?)</${ns('tr')}>`, 'g'))) {
    const cells: string[] = [];
    for (const tc of tr[1].matchAll(new RegExp(`<${ns('tc')}(?:\\s[^>]*)?>([\\s\\S]*?)</${ns('tc')}>`, 'g'))) {
      cells.push(
        chunks(tc[1])
          .filter((c) => c.kind === 'p')
          .map((c) => textOf(c.xml, links).trim())
          .filter(Boolean)
          .join(' '),
      );
    }
    if (rows.length === 0 && has(tr[1], 'tblHeader')) header = true;
    rows.push(cells);
  }
  /*
   * A header row's bold is the header, not somebody's emphasis.
   *
   * `docx.ts` bolds every cell of the first row *because* the block says
   * `header: true` — it is formatting derived from the flag. Reading it back
   * as marks turns `Ward` into `**Ward**`, and the next export bolds that
   * again, so a table gains a pair of asterisks every round trip.
   */
  if (header && rows[0]) {
    rows[0] = rows[0].map((cell) => {
      const bare = /^\*\*([\s\S]*)\*\*$/.exec(cell.trim());
      return bare && !bare[1].includes('**') ? bare[1] : cell;
    });
  }
  return { kind: 'table', rows: rows.length ? rows : [['']], header, caption: '' };
}

/** A drawing, with its bytes lifted out for the caller to file. */
function pictureOf(
  p: string,
  links: Record<string, string>,
  zip: Record<string, Uint8Array>,
  media: Read['media'],
): Block | null {
  const blip = new RegExp(opening('blip')).exec(p);
  if (!blip) return null;
  const target = links[attr(blip[0], 'embed')];
  if (!target) return null;
  const path = `word/${target.replace(/^\.?\//, '')}`;
  const bytes = zip[path];
  if (!bytes) return null;
  const docPr = new RegExp(opening('docPr')).exec(p);
  const name = path.split('/').pop() ?? 'picture';
  const extension = (name.split('.').pop() ?? '').toLowerCase();
  media.push({
    name,
    type: extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : 'image/jpeg',
    bytes,
  });
  return {
    kind: 'image',
    // Filed by the caller, which is where the drive is. The name is what ties
    // this block to its entry in `media`.
    fileId: '',
    name,
    alt: docPr ? attr(docPr[0], 'descr') : '',
    caption: '',
  };
}

/** Whether this is a file this reader will open at all. */
export function readable(file: File): boolean {
  return /\.docx$/i.test(file.name);
}
