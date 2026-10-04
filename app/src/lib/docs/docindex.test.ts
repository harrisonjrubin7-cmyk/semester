import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIENCES, TYPES, governedPages, isTemplatePage, parseCard, read, type Card } from './card.ts';

/**
 * `docs/documentation/INDEX.md` — every governed page, by audience and by kind,
 * rendered from the cards so it cannot disagree with them. Discoverability has
 * two halves: `docs/README.md` is the curated front door (a person picks who
 * they are), and this is the complete list (a person or a gate asks "is there a
 * page about X"). Only the second is generated.
 *
 * `REGISTERS=write npx vitest run src/lib/docs/docindex.test.ts` rewrites it;
 * `npm run registers` does the same with the other rendered pages.
 */

const root = join(import.meta.dirname, '../../../..');
const OUT = 'docs/documentation/INDEX.md';

const titleOf = (text: string): string => (/^# (.+)$/m.exec(text)?.[1] ?? '').replace(/\|/g, '\\|');
const rel = (to: string) => relative(dirname(OUT), to).split('\\').join('/');
const superseded = (text: string) => /^\*\*Status:\*\* superseded/m.test(text);

interface Row { page: string; title: string; card: Card; gone: boolean }

/** The rows, from page text. Pure, so the controls below can feed it a made-up tree. */
function rows(pages: ReadonlyMap<string, string>): Row[] {
  const out: Row[] = [];
  for (const [page, text] of [...pages].sort(([a], [b]) => a.localeCompare(b))) {
    if (isTemplatePage(page)) continue;
    const { card } = parseCard(text);
    if (card) out.push({ page, title: titleOf(text), card, gone: superseded(text) });
  }
  return out;
}

const line = (r: Row) =>
  `| [${r.title}](${rel(r.page)})${r.gone ? ' — *superseded*' : ''} | ${r.card.type} | ${r.card.truth} | \`${r.card.owner}\` | ${r.card.reviewed} |`;

const HEAD = ['| Page | Type | Held how | Owner | Reviewed |', '| --- | --- | --- | --- | --- |'];

function render(pages: ReadonlyMap<string, string>): string {
  const all = rows(pages);
  const n = (t: string) => all.filter((r) => r.card.truth === t).length;
  const out: string[] = [
    '# Documentation index',
    '',
    `> **Type:** reference · **Audience:** contributors · **Owner:** \`engineering\` · **Truth:** generated · **Reviewed:** 2026-10-04 · **Held by:** \`app/src/lib/docs/docindex.test.ts\``,
    '',
    'Every page the documentation system governs, by audience and by kind. The curated way in is [`docs/README.md`](../README.md); this is the complete list, and it is rendered from the pages’ own cards.',
    '',
    '<!-- Rendered from the cards of every governed page by app/src/lib/docs/docindex.test.ts. Edit a page’s card, then run `REGISTERS=write npx vitest run src/lib/docs/docindex.test.ts` from app/. -->',
    '',
    `**${all.length} governed pages:** ${n('generated')} generated from code, ${n('held')} held by a test, ${n('reviewed')} reviewed by a person only. The last group is the part a reader leans on least, and the part [\`docs:stale\`](OWNERSHIP-AND-REVIEW.md#cadence) watches.`,
    '',
    'Pages elsewhere in `docs/` (about three hundred, mostly older) are not governed by this system and are not listed here; [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md) says which of them is authoritative for each company control.',
    '',
    '## By audience',
    '',
  ];
  for (const a of AUDIENCES) {
    const mine = all.filter((r) => r.card.audience.includes(a));
    if (mine.length === 0) continue;
    out.push(`### ${a}`, '', ...HEAD, ...mine.map(line), '');
  }
  out.push('## By kind', '');
  for (const t of TYPES) {
    const mine = all.filter((r) => r.card.type === t);
    if (mine.length === 0) continue;
    out.push(`### ${t}`, '', ...HEAD, ...mine.map(line), '');
  }
  return out.join('\n').replace(/\n+$/, '\n');
}

const pagesNow = () => new Map(governedPages(root).filter((p) => p !== OUT).map((p) => [p, read(root, p)]));

describe(`${OUT}`, () => {
  it('is what the cards say', () => {
    const rendered = render(pagesNow());
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, OUT), rendered);
    expect(readFileSync(join(root, OUT), 'utf8'), `${OUT} is stale; run \`REGISTERS=write npx vitest run src/lib/docs/docindex.test.ts\` from app/`).toBe(rendered);
  });

  it('lists the charter under contributors — the control that the render reads real pages', () => {
    const text = render(pagesNow());
    expect(text).toContain('[The documentation system](README.md)');
    expect(text).toMatch(/### contributors[\s\S]*### /);
  });
});

describe('the render, against a tree I made up', () => {
  const card = (type: string, aud: string, truth: string, held: string) =>
    `# T-${type}\n\n> **Type:** ${type} · **Audience:** ${aud} · **Owner:** \`product\` · **Truth:** ${truth} · **Reviewed:** 2026-10-04 · **Held by:** ${held}\n\nx\n`;
  const tree = new Map([
    ['docs/help/a.md', card('help', 'students', 'reviewed', '—')],
    ['docs/reference/b.md', card('reference', 'partner-developers, implementers', 'generated', '`x.test.ts`')],
    ['docs/documentation/templates/t.md', card('how-to', 'students', 'reviewed', '—')],
    ['docs/help/c.md', card('help', 'students', 'reviewed', '—').replace('x\n', '**Status:** superseded by [a](a.md) on 2026-10-05.\n')],
    ['docs/help/broken.md', 'no card here'],
  ]);

  it('files a page under every audience it names, once under its kind, skips templates and unreadable pages', () => {
    const out = render(tree);
    expect(out).toContain('**3 governed pages:** 1 generated from code, 0 held by a test, 2 reviewed');
    expect(out.match(/\[T-reference\]/g)).toHaveLength(3); // two audiences + its kind
    expect(out).not.toContain('docs/documentation/templates');
    expect(out).toContain('— *superseded*');
    expect(out).not.toContain('broken');
  });
});
