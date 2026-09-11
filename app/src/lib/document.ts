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

import type { CourseId } from './types';

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'bullets'; items: string[]; numbered: boolean }
  /** A pulled quotation, with where it came from — the app never quotes blind. */
  | { kind: 'quote'; text: string; source: string }
  | { kind: 'table'; rows: string[][]; header: boolean; caption: string }
  | { kind: 'equation'; latex: string; caption: string }
  | { kind: 'break' };

export type BlockKind = Block['kind'];

export interface Doc {
  id: string;
  title: string;
  subtitle: string;
  courseId: CourseId | null;
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
}

/** What each kind is called where somebody has to choose one. */
export const BLOCK_LABEL: Record<BlockKind, string> = {
  heading: 'Heading',
  text: 'Paragraph',
  bullets: 'List',
  quote: 'Quotation',
  table: 'Table',
  equation: 'Equation',
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
    case 'break':
      return { kind: 'break' };
    default:
      return { kind: 'text', text: '' };
  }
}

export function blankDoc(title: string, courseId: CourseId | null = null): Omit<Doc, 'id'> {
  return {
    title: title.trim() || 'Untitled document',
    subtitle: '',
    courseId,
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
}

/**
 * A paragraph split into its emphasised pieces.
 *
 * Bold first, then italic inside it, so `**a *b* c**` comes out right. The
 * markers have to be adjacent to the words they mark — `2 * 3 * 4` is
 * arithmetic and stays arithmetic, which is the case a naive `\*(.+?)\*`
 * turns into an italic 3.
 *
 * `***both at once***` is not handled, and is the one shape left out on
 * purpose. Three stars in a row are ambiguous — markdown's own parsers
 * disagree about them — and resolving it here would mean a real parser rather
 * than two passes. What comes out is the words with a star beside them, which
 * is visible and fixable; a wrong guess about which star closed which mark is
 * neither.
 */
export function runs(text: string): Run[] {
  const out: Run[] = [];
  const walk = (part: string, bold: boolean, italic: boolean) => {
    const strong = /\*\*(\S(?:(?!\*\*)[\s\S])*?\S|\S)\*\*/.exec(part);
    if (strong) {
      if (strong.index > 0) walk(part.slice(0, strong.index), bold, italic);
      walk(strong[1], true, italic);
      walk(part.slice(strong.index + strong[0].length), bold, italic);
      return;
    }
    const em = /\*(\S(?:[^*]*\S)?)\*/.exec(part);
    if (em) {
      if (em.index > 0) walk(part.slice(0, em.index), bold, italic);
      walk(em[1], bold, true);
      walk(part.slice(em.index + em[0].length), bold, italic);
      return;
    }
    if (part) out.push({ text: part, bold, italic });
  };
  walk(text, false, false);
  return out.length ? out : [{ text: '', bold: false, italic: false }];
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
    else if (block.kind === 'quote') count(block.text);
  }
  return n;
}

/** What a document holds, as one line — the confirmation a proposal needs. */
export function summary(blocks: Block[]): string {
  const counted = new Map<BlockKind, number>();
  for (const b of blocks) counted.set(b.kind, (counted.get(b.kind) ?? 0) + 1);
  const order: BlockKind[] = ['heading', 'text', 'bullets', 'quote', 'table', 'equation'];
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
export function hasContent(doc: Doc): boolean {
  return doc.blocks.some((b) => {
    if (b.kind === 'break') return false;
    if (b.kind === 'table') return b.rows.some((r) => r.some((c) => c.trim() !== ''));
    if (b.kind === 'bullets') return b.items.some((i) => i.trim() !== '');
    if (b.kind === 'equation') return b.latex.trim() !== '';
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
