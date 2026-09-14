/**
 * A document you build rather than one that is generated for you.
 *
 * The app had two writing screens and neither of them made a document. **Work
 * on it** breaks a brief into a plan and refuses to write the thing. **Draft
 * it** writes real prose and is fenced off from coursework on purpose. Both
 * are right, and between them a student who needed to hand in a memo with a
 * table in it opened Word.
 *
 * This is the third thing: an editor. Headings, paragraphs, lists, quotations,
 * tables and equations, arranged into a real .docx, a .pdf through the browser's
 * own print, or Markdown. Nothing here writes prose and nothing here needs a
 * key — the model is only ever invited in through the tools, and only as a
 * proposal the student accepts.
 *
 * ## Blocks, not a rich-text field
 *
 * A contenteditable div is the obvious way to do this and it is a trap: the
 * HTML it produces is whatever the browser felt like, it differs between
 * Safari and Chrome, and converting it to Word means writing an HTML parser
 * whose failures are silent. A list of typed blocks is duller and can be
 * converted exactly — every block has one shape in the editor, one in the
 * .docx, one in Markdown, and a test can hold all three together.
 *
 * It also means a table is a table and an equation is an equation rather than
 * both being "some markup", which is what lets `lib/xlsx.ts` and `lib/maths.ts`
 * be reached from inside a document at all.
 *
 * ## Emphasis
 *
 * `**bold**` and `*italic*`, and nothing else. Markdown's two commonest marks
 * are what people type without being told to; anything more and the field
 * needs a toolbar, and a toolbar needs a rich-text field, which is the trap
 * above.
 */

import type { Layout } from './doclayout';
import type { CourseId } from './types';

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'bullets'; items: string[]; numbered: boolean }
  /** A pulled quotation, with where it came from — the app never quotes blind. */
  | { kind: 'quote'; text: string; source: string }
  | { kind: 'table'; rows: string[][]; header: boolean; caption: string }
  | { kind: 'equation'; latex: string; caption: string }
  /**
   * Text that is not prose — a snippet, a command, a formula as it is typed.
   *
   * The one block whose words are *not* marked up. `**` inside code is two
   * asterisks somebody meant to type, and putting it through `runs()` would
   * turn a Python decorator or a shell glob into bold text with the marks
   * eaten. So this is the one kind that reaches the page and the `.docx` as
   * exactly the characters it holds, whitespace included.
   */
  | { kind: 'code'; text: string; language: string }
  /**
   * A list whose items can be ticked off.
   *
   * Its own kind rather than a flag on `bullets`, because the state belongs to
   * each *item* and `bullets` holds plain strings. Bolting a parallel array of
   * booleans onto it would be two lists that have to stay the same length, and
   * the first reorder would silently tick the wrong line.
   *
   * The ticks survive the export — Word gets ☒ and ☐ in front of the words
   * rather than a live control, because a Word content control opens as a
   * grey box in Pages and as nothing at all in Google Docs.
   */
  | { kind: 'checks'; items: { text: string; done: boolean }[] }
  /**
   * A picture, held in IndexedDB and pointed at from here.
   *
   * The bytes are not in the block, and could not be: a document lives in
   * localStorage with the rest of the app's state, and one screenshot would
   * spend the whole budget. `fileId` is a key into `lib/files.ts`, the same
   * store the drive uses.
   *
   * `name` is what the file was called when it was put in, kept beside the id
   * rather than looked up. It is what markdown has to write — `![alt](id)` is
   * a reference to nothing outside this app — and keeping it means the export
   * still says something useful about a picture whose file has since been
   * renamed or deleted. It is a label, never the way the picture is found.
   *
   * `alt` is separate from `caption` because they are different sentences: a
   * caption is read by everybody and says what the picture is *for*; alt text
   * is read instead of the picture and says what is *in* it. A document that
   * uses one for both leaves somebody with neither.
   */
  | { kind: 'image'; fileId: string; name: string; alt: string; caption: string }
  /**
   * The table of contents, built from the headings rather than typed.
   *
   * Word's is a field that has to be updated and Docs' is a live block; both
   * are the same promise, which is that the contents page cannot drift from
   * the document. Held here as a marker with no content of its own — what it
   * lists is computed from the headings above and below it every time it is
   * drawn, printed or exported, so it is never stale.
   *
   * No page numbers. Nothing here knows where a page break will fall in Word
   * — that depends on the reader's font substitution and paper size — and a
   * contents page with confidently wrong numbers on it is worse than one with
   * none.
   */
  | { kind: 'toc'; title: string }
  | { kind: 'break' };

export type BlockKind = Block['kind'];

export interface Doc {
  id: string;
  title: string;
  subtitle: string;
  courseId: CourseId | null;
  /**
   * The deadline this was written for, where it was written for one.
   *
   * A course was as close as anything made in this app could get to saying
   * what it was for, and a course is four months and eleven deadlines wide.
   * The response paper due Friday and the one due in November were both
   * "ECON 1010", which is the filing equivalent of one drawer for the term.
   *
   * Optional on every made thing for the same two reasons: a document written
   * before this field existed has none, and plenty of documents are genuinely
   * not for a deadline. Read it through `lib/forwork.ts`, which is the one
   * place that knows an id here may name a deadline that has since been
   * edited out of a course — a dangling link is shown as no link rather than
   * as a broken one.
   */
  itemId?: string | null;
  blocks: Block[];
  created: number;
  updated: number;
  /**
   * When it was last opened, which is not when it was last changed.
   *
   * What the shelf's default order sorts by, and the reason it can be called
   * "Last opened" honestly. Absent on everything made before this existed, and
   * read as "not since" rather than as the epoch — `lib/shelf.ts` falls back to
   * when it was last written to. The same field, for the same reason, as
   * `opened` on `Sheet` in `lib/sheet.ts`.
   */
  opened?: number;
  /**
   * How it is set up as a page — font, size, spacing, margins, the corner.
   *
   * Absent on everything written before this existed and read as the app's
   * own: see `layoutOf` in `lib/doclayout.ts`. Held on the document rather
   * than as a setting because it belongs to the document — an MLA essay and a
   * one-page memo are both open in the same app in the same afternoon, and a
   * preference shared between them would be wrong for one of them.
   */
  layout?: Layout;
}

/** What each kind is called where somebody has to choose one. */
export const BLOCK_LABEL: Record<BlockKind, string> = {
  heading: 'Heading',
  text: 'Paragraph',
  bullets: 'List',
  checks: 'Checklist',
  quote: 'Quotation',
  table: 'Table',
  equation: 'Equation',
  code: 'Code',
  image: 'Picture',
  toc: 'Contents',
  break: 'Page break',
};

/** A new block of each kind, empty and ready to type into. */
export function blankBlock(kind: BlockKind): Block {
  switch (kind) {
    case 'heading':
      return { kind: 'heading', level: 2, text: '' };
    case 'bullets':
      return { kind: 'bullets', items: [''], numbered: false };
    case 'quote':
      return { kind: 'quote', text: '', source: '' };
    case 'table':
      return {
        kind: 'table',
        rows: [
          ['', ''],
          ['', ''],
        ],
        header: true,
        caption: '',
      };
    case 'equation':
      return { kind: 'equation', latex: '', caption: '' };
    case 'code':
      return { kind: 'code', text: '', language: '' };
    case 'checks':
      return { kind: 'checks', items: [{ text: '', done: false }] };
    case 'image':
      return { kind: 'image', fileId: '', name: '', alt: '', caption: '' };
    case 'toc':
      return { kind: 'toc', title: 'Contents' };
    case 'break':
      return { kind: 'break' };
    default:
      return { kind: 'text', text: '' };
  }
}

export function blankDoc(
  title: string,
  courseId: CourseId | null = null,
  itemId: string | null = null,
): Omit<Doc, 'id'> {
  return {
    title: title.trim() || 'Untitled document',
    subtitle: '',
    courseId,
    itemId,
    blocks: [{ kind: 'text', text: '' }],
    created: Date.now(),
    updated: Date.now(),
  };
}

// ── Emphasis ─────────────────────────────────────────────────────────────

export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  /** Monospaced and literal — nothing inside it is a mark. */
  code: boolean;
  /**
   * Where this run points, or empty when it points nowhere.
   *
   * Already checked by {@link safeUrl} — nothing downstream re-checks it, so
   * nothing downstream may set it from raw text either.
   */
  link: string;
}

/** A run with nothing on it, which is what every walk starts from. */
const PLAIN: Omit<Run, 'text'> = {
  bold: false,
  italic: false,
  strike: false,
  code: false,
  link: '',
};

/**
 * A URL this app is willing to put behind words, or nothing.
 *
 * A document is text somebody else wrote as often as not — pasted from a
 * reading, imported from Markdown, handed over by a model — and a link is the
 * one piece of a document that *does* something when it is clicked. So the
 * scheme is checked against a list of three rather than against a list of the
 * bad ones: `javascript:` is the one everybody remembers, and `data:` will
 * serve a whole page, and neither is the interesting part. The interesting
 * part is that the next scheme somebody thinks of is allowed by any rule
 * written as a denial and refused by this one.
 *
 * A bare domain is what people actually type, so `vanderbilt.edu` becomes
 * `https://vanderbilt.edu` — but only when it *looks* like a domain. `#notes`
 * and `../thing` are not links out of this document and must not be turned
 * into one by having a scheme stapled to the front.
 */
export function safeUrl(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  const looksLikeDomain = /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(text);
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text);
  if (!hasScheme && !looksLikeDomain) return '';
  try {
    const url = new URL(hasScheme ? text : `https://${text}`);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * `[words](where)`, in the form people already type.
 *
 * The space between `]` and `(` is what keeps a numbered citation out of
 * this: "see [3] (above)" is not a link and never becomes one. The target may
 * not contain whitespace for the same reason.
 */
const LINK = /\[([^\]\n]+)\]\((\S+?)\)/;

/**
 * A paragraph split into its marked pieces.
 *
 * Five marks, all of them markdown's own, because markdown is what people
 * type without being told to:
 *
 *     **bold**  *italic*  ~~struck out~~  `code`  [a link](https://…)
 *
 * The first two were the whole set for a long time and the argument for
 * stopping there was that anything more needs a toolbar. It does, and there
 * is one now — but the three added here are not decoration. A link is the
 * commonest thing in a document written this decade and the .docx had no way
 * to carry one; struck-out text is how a shared draft says "cut this" without
 * deleting it; and backticks are what stops a variable name in a methods
 * section turning into italics.
 *
 * ## How it walks
 *
 * Earliest mark of the five, in that precedence, then the text either side is
 * walked again from the top — so the order below decides *nesting* only, and
 * text before and after a mark is fully parsed either way. Code comes first
 * and its contents are never parsed, which is what makes `**not bold**`
 * inside backticks come out as stars.
 *
 * ## What is left out, and why
 *
 * The markers have to be adjacent to the words they mark — `2 * 3 * 4` is
 * arithmetic and stays arithmetic, which is the case a naive `\*(.+?)\*`
 * turns into an italic 3.
 *
 * `***both at once***` is not handled, and is the one shape left out on
 * purpose. Three stars in a row are ambiguous — markdown's own parsers
 * disagree about them — and resolving it here would mean a real parser rather
 * than a chain of passes. What comes out is the words with a star beside
 * them, which is visible and fixable; a wrong guess about which star closed
 * which mark is neither.
 */
export function runs(text: string): Run[] {
  const out: Run[] = [];
  const walk = (part: string, on: Omit<Run, 'text'>) => {
    if (!part) return;

    /*
     * Five marks, earliest one first, and the two rules that decide nesting.
     *
     * **A link is only read outside a link**, because a link inside a link
     * has no meaning and the recursion has to end. A target this app will not
     * follow keeps its brackets and is pushed as it was typed — visible and
     * fixable, which is the same choice this file makes about
     * `***three stars***`; silently dropping the words, or silently keeping
     * the link, are both worse.
     *
     * **Backticks are literal**, so what is between them is pushed rather
     * than walked: otherwise `` `**p**` `` is a bold p in a sentence about
     * markdown. Earliest-first is what keeps that from fighting the link
     * rule — `[`x`](url)` starts with the bracket, so it is a link whose
     * words happen to be code, which is what it looks like.
     */
    const link = on.link ? null : LINK.exec(part);
    const code = on.code ? null : /`([^`\n]+)`/.exec(part);
    const strong = /\*\*(\S(?:(?!\*\*)[\s\S])*?\S|\S)\*\*/.exec(part);
    const struck = /~~(\S(?:(?!~~)[\s\S])*?\S|\S)~~/.exec(part);
    const em = /\*(\S(?:[^*]*\S)?)\*/.exec(part);

    const found = [
      {
        at: link,
        take: () => {
          const url = safeUrl(link![2]);
          if (url) walk(link![1], { ...on, link: url });
          else out.push({ text: link![0], ...on });
        },
      },
      { at: code, take: () => out.push({ text: code![1], ...on, code: true }) },
      { at: strong, take: () => walk(strong![1], { ...on, bold: true }) },
      { at: struck, take: () => walk(struck![1], { ...on, strike: true }) },
      { at: em, take: () => walk(em![1], { ...on, italic: true }) },
    ].filter((f): f is { at: RegExpExecArray; take: () => void } => f.at !== null);

    if (found.length === 0) {
      out.push({ text: part, ...on });
      return;
    }
    // Earliest wins; ties go to whichever is listed first above, which is
    // what keeps `**bold**` from being read as an italic star either side.
    const first = found.reduce((best, f) => (f.at.index < best.at.index ? f : best));
    if (first.at.index > 0) walk(part.slice(0, first.at.index), on);
    first.take();
    walk(part.slice(first.at.index + first.at[0].length), on);
  };
  walk(text, PLAIN);
  return out.length ? out : [{ text: '', ...PLAIN }];
}

/** The same text with the marks taken off — for a word count or a plain export. */
export function unmarked(text: string): string {
  return runs(text)
    .map((r) => r.text)
    .join('');
}

// ── Measuring it ─────────────────────────────────────────────────────────

/**
 * The words in a document.
 *
 * Table cells and equations are not counted. A marker's word limit means the
 * prose, and a table of twelve figures counted as twelve words would push a
 * document over a limit it is nowhere near — which is the direction that costs
 * somebody marks.
 */
export function words(doc: Doc): number {
  let n = 0;
  const count = (text: string) => {
    const clean = unmarked(text).trim();
    if (clean) n += clean.split(/\s+/).length;
  };
  for (const block of doc.blocks) {
    if (block.kind === 'heading' || block.kind === 'text') count(block.text);
    else if (block.kind === 'bullets') block.items.forEach(count);
    else if (block.kind === 'checks') block.items.forEach((i) => count(i.text));
    else if (block.kind === 'quote') count(block.text);
    /*
     * Code is not counted, and neither are tables or equations — the rule this
     * function already kept before there was code to apply it to. A word count
     * on a piece of writing is a count of its *prose*: nobody submitting three
     * thousand words means three thousand including a shell script.
     */
  }
  return n;
}

/** What a document holds, as one line — the confirmation a proposal needs. */
export function summary(blocks: Block[]): string {
  const counted = new Map<BlockKind, number>();
  for (const b of blocks) counted.set(b.kind, (counted.get(b.kind) ?? 0) + 1);
  const order: BlockKind[] = [
    'heading',
    'text',
    'bullets',
    'checks',
    'quote',
    'table',
    'image',
    'equation',
    'code',
    'toc',
  ];
  const said = order
    .filter((kind) => counted.get(kind))
    .map((kind) => {
      const n = counted.get(kind)!;
      const name = BLOCK_LABEL[kind].toLowerCase();
      return `${n} ${n === 1 ? name : `${name}s`}`;
    });
  return said.length ? said.join(', ') : 'nothing in it yet';
}

/** Whether there is anything in it at all — an empty paragraph is not something. */
export function hasContent(doc: Partial<Doc> & Pick<Doc, 'blocks'>): boolean {
  return doc.blocks.some((b) => {
    if (b.kind === 'break') return false;
    if (b.kind === 'table') return b.rows.some((r) => r.some((c) => c.trim() !== ''));
    if (b.kind === 'bullets') return b.items.some((i) => i.trim() !== '');
    // Said out loud because the fall-through below reads `b.text`, and a
    // checklist has not got one: without this an empty checklist would answer
    // `undefined !== ''` — true — and a blank document would claim to hold
    // something.
    if (b.kind === 'checks') return b.items.some((i) => i.text.trim() !== '');
    if (b.kind === 'equation') return b.latex.trim() !== '';
    // A picture is content once it points at one, whatever it is captioned.
    if (b.kind === 'image') return b.fileId.trim() !== '';
    if (b.kind === 'code') return b.text.trim() !== '';
    /*
     * A contents block is not content.
     *
     * It lists the headings, so a document holding nothing but one is a
     * contents page of nothing — and `hasContent` is what the File menu reads
     * to decide whether there is anything worth exporting.
     */
    if (b.kind === 'toc') return false;
    return b.text.trim() !== '';
  });
}

// ── Markdown, both directions ────────────────────────────────────────────

/** One markdown table row, with pipes inside cells escaped. */
function tableRow(row: string[], width: number): string {
  return `| ${Array.from({ length: width }, (_, i) => (row[i] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`;
}

export function toMarkdown(doc: Doc): string {
  const parts: string[] = [`# ${doc.title}`];
  if (doc.subtitle.trim()) parts.push(`*${doc.subtitle.trim()}*`);

  for (const block of doc.blocks) {
    switch (block.kind) {
      case 'heading':
        parts.push(`${'#'.repeat(block.level + 1)} ${block.text}`);
        break;
      case 'text':
        if (block.text.trim()) parts.push(block.text);
        break;
      case 'bullets':
        parts.push(
          block.items
            .filter((i) => i.trim())
            .map((item, i) => (block.numbered ? `${i + 1}. ${item}` : `- ${item}`))
            .join('\n'),
        );
        break;
      /*
       * A fence long enough that the code cannot end it early.
       *
       * Three backticks is the usual fence, and a snippet *about* markdown
       * contains three backticks — which would close the block at that line
       * and leave the rest of the code as prose, silently. So the fence is one
       * longer than the longest run of backticks the code starts a line with,
       * which is what CommonMark specifies for exactly this reason.
       */
      case 'code': {
        if (!block.text.trim()) break;
        const runs = block.text.match(/^`{3,}/gm) ?? [];
        const longest = runs.reduce((n, f) => Math.max(n, f.length), 0);
        const fence = '`'.repeat(Math.max(3, longest + 1));
        parts.push(`${fence}${block.language.trim()}\n${block.text}\n${fence}`);
        break;
      }
      case 'checks':
        parts.push(
          block.items
            .filter((i) => i.text.trim())
            .map((i) => `- [${i.done ? 'x' : ' '}] ${i.text}`)
            .join('\n'),
        );
        break;
      /*
       * `![alt](name)`, with the caption as its own line under it.
       *
       * Markdown has nowhere to put a caption — `![alt](src "title")` is a
       * tooltip, which is not what a caption is — so it goes underneath in
       * italics, which is what it looks like on the page anyway and what every
       * markdown-to-anything converter does with it.
       */
      case 'image': {
        if (!block.fileId.trim()) break;
        const alt = block.alt.trim() || block.name.trim() || 'Picture';
        parts.push(
          `![${alt.replace(/[[\]]/g, '')}](${block.name.trim() || block.fileId})` +
            (block.caption.trim() ? `\n\n*${block.caption.trim()}*` : ''),
        );
        break;
      }
      case 'quote': {
        const body = block.text
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
        parts.push(block.source.trim() ? `${body}\n>\n> — ${block.source}` : body);
        break;
      }
      case 'table': {
        const width = block.rows.reduce((n, r) => Math.max(n, r.length), 0);
        if (width === 0) break;
        const lines = block.header
          ? [
              tableRow(block.rows[0] ?? [], width),
              `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
              ...block.rows.slice(1).map((r) => tableRow(r, width)),
            ]
          : block.rows.map((r) => tableRow(r, width));
        parts.push(block.caption.trim() ? `${lines.join('\n')}\n\n*${block.caption}*` : lines.join('\n'));
        break;
      }
      /*
       * The contents, written out as the list it is rather than as a marker.
       *
       * Markdown has no table of contents and inventing a `[[toc]]` of our own
       * would be a token that means nothing anywhere else. What goes in the
       * file is the headings, linked the way every markdown renderer links
       * them — which is a working contents page in anything that reads the
       * file, and reads back in as a list if it comes home again.
       */
      case 'toc': {
        const headings = doc.blocks.filter((b) => b.kind === 'heading' && b.text.trim());
        if (headings.length === 0) break;
        parts.push(
          `## ${block.title.trim() || 'Contents'}\n\n` +
            headings
              .map((h) =>
                h.kind === 'heading'
                  ? `${'  '.repeat(h.level - 1)}- ${h.text.trim()}`
                  : '',
              )
              .join('\n'),
        );
        break;
      }
      case 'equation':
        // Fenced the way every markdown renderer that does maths expects it,
        // so a document pasted into one is an equation rather than a line of
        // backslashes.
        parts.push(
          block.caption.trim()
            ? `$$\n${block.latex}\n$$\n\n*${block.caption}*`
            : `$$\n${block.latex}\n$$`,
        );
        break;
      case 'break':
        parts.push('---');
        break;
    }
  }
  return `${parts.filter((p) => p.trim() !== '').join('\n\n')}\n`;
}

/**
 * Markdown back into blocks.
 *
 * The way a note, a chat answer or a pasted outline becomes something you can
 * edit. Deliberately forgiving: anything it does not recognise becomes a
 * paragraph, because a paste that half-fails and drops the rest is worse than
 * one that keeps everything as prose and lets somebody promote the headings by
 * hand.
 */
export function fromMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    const body = paragraph.join('\n').trim();
    if (body) blocks.push({ kind: 'text', text: body });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      // `#` is the document's own title, so a `#` inside the body is a level 1
      // heading rather than a second title.
      const level = Math.min(3, Math.max(1, heading[1].length - 1)) as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, text: heading[2].trim() });
      continue;
    }

    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      flush();
      blocks.push({ kind: 'break' });
      continue;
    }

    const fence = /^\s*```\s*([A-Za-z0-9+#-]*)\s*$/.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      blocks.push({ kind: 'code', text: body.join('\n'), language: fence[1] });
      continue;
    }

    if (/^\s*\$\$\s*$/.test(line)) {
      flush();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      blocks.push({ kind: 'equation', latex: body.join(' ').trim(), caption: '' });
      continue;
    }

    if (/^\s*\|/.test(line)) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        if (!/^\s*\|[\s:|-]*\|\s*$/.test(lines[i])) {
          rows.push(
            lines[i]
              .trim()
              .replace(/^\|/, '')
              .replace(/\|$/, '')
              .split('|')
              .map((c) => c.trim()),
          );
        }
        i += 1;
      }
      i -= 1;
      if (rows.length) blocks.push({ kind: 'table', rows, header: true, caption: '' });
      continue;
    }

    /*
     * A fenced block, and everything to its closing fence taken literally.
     *
     * Before the bullet and paragraph branches on purpose: a line of code can
     * look like anything, and `- x` inside a snippet is a line of the snippet.
     * The closing fence has to be at least as long as the opening one, so a
     * shorter run of backticks inside the code does not end it.
     */
    const fenced = /^\s*(`{3,}|~{3,})\s*(\S*)\s*$/.exec(line);
    if (fenced) {
      flush();
      const [, fence, language] = fenced;
      const body: string[] = [];
      i += 1;
      const closes = new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`);
      while (i < lines.length && !closes.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      blocks.push({ kind: 'code', text: body.join('\n'), language: language.trim() });
      continue;
    }

    /*
     * A task list, before the bullet branch it would otherwise be read by.
     *
     * `- [ ] thing` matches the bullet pattern perfectly well, and would come
     * through as a bullet whose text begins with a literal `[ ]` — the ticks
     * silently demoted to punctuation.
     */
    if (/^\s*[-*+]\s+\[[ xX]\]\s/.test(line)) {
      flush();
      const items: { text: string; done: boolean }[] = [];
      while (i < lines.length) {
        const m = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push({ text: m[2].trim(), done: m[1].toLowerCase() === 'x' });
        i += 1;
      }
      i -= 1;
      blocks.push({ kind: 'checks', items });
      continue;
    }

    const bullet = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      const numbered = /\d/.test(bullet[1]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(m[1].trim());
        i += 1;
      }
      i -= 1;
      blocks.push({ kind: 'bullets', items, numbered });
      continue;
    }

    if (/^\s*>/.test(line)) {
      flush();
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      i -= 1;
      // A trailing `— source` line inside the quotation is the attribution,
      // which this app keeps as its own field rather than as part of the words.
      let source = '';
      while (body.length && body[body.length - 1].trim() === '') body.pop();
      const last = body[body.length - 1] ?? '';
      const attributed = /^\s*[—–-]\s*(.+)$/.exec(last);
      if (attributed && body.length > 1) {
        source = attributed[1].trim();
        body.pop();
      }
      blocks.push({ kind: 'quote', text: body.join('\n').trim(), source });
      continue;
    }

    /*
     * A picture, where the whole line is one.
     *
     * The file is not here — a markdown document brings a *reference*, and the
     * bytes it points at are wherever the person kept them. So this comes in
     * with no `fileId`: the alt text and the name survive, the block says it
     * has no picture, and the screen offers to attach one. Inventing an id
     * would be a block pointing confidently at nothing.
     */
    const picture = /^\s*!\[([^\]]*)\]\(([^)]*)\)\s*$/.exec(line);
    if (picture) {
      flush();
      blocks.push({
        kind: 'image',
        fileId: '',
        name: picture[2].trim(),
        alt: picture[1].trim(),
        caption: '',
      });
      continue;
    }

    if (line.trim() === '') {
      flush();
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks.length ? blocks : [{ kind: 'text', text: '' }];
}

/** `memo-on-tariffs.docx`, from whatever it is called. */
export function docFileName(title: string, extension = 'docx'): string {
  const stem = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join('-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return `${stem || 'document'}.${extension}`;
}
