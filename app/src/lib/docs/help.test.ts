import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RETIRED } from '../../content/terms';
import { PALETTE, SHORTCUTS, keyLabel } from '../keys';
import { SEATS } from '../launchreadiness';

/**
 * The help pages, held to the app they describe.
 *
 * `docs/help/` is written for the people who open Semester: students first,
 * then families and faculty. A help page is a claim about what a button says
 * and what happens when it is pressed, so this file reads every page against
 * the source, the truth table and the retired-word list.
 *
 * ## What each guard holds
 *
 * - **Card.** Every page opens with the one-line card the documentation
 *   charter asks for, a plain first sentence, and the sections its type needs.
 * - **Labels.** Every page ends with `<!-- labels: A | B -->`. Each label must
 *   appear in the page and in the app's source text, and every **bold** span in
 *   the page must be in the list. A renamed button breaks the page that names it.
 * - **Words.** No retired word from `content/terms.ts`, none of the charter's
 *   banned words, and none of the claims the project may not make.
 * - **Length.** No sentence over 35 words, no table cell over 35 words.
 * - **Status.** Each page declares the LIVE capabilities it relies on
 *   (`<!-- live: ... -->`) and each is looked up in the truth table. A page that
 *   names a capability that is not LIVE must be an explanation, declare it
 *   (`<!-- not-live: Name=STATUS -->`), and carry a **Status:** line.
 * - **Links.** Every relative link resolves, except links into
 *   `docs/guides/institution/`, which another author owns.
 * - **Shortcuts.** The keyboard page lists exactly the bindings in `keys.ts`.
 *
 * ## Controls
 *
 * Each guard is first shown a fixture that must pass, and then a copy with one
 * fault that must fail with a named message. A guard that has never failed is
 * not known to be a guard.
 */

const root = join(import.meta.dirname, '../../../..');
const HELP = join(root, 'docs/help');
const SRC = join(root, 'app/src');
const HELD_BY = 'app/src/lib/docs/help.test.ts';
const DATE = '2026-10-04';
/** Links into this tree are checked by the lead at merge, not here. */
const OTHER_AUTHORS = [join(root, 'docs/guides/institution')];

const TYPES = ['tutorial', 'how-to', 'reference', 'explanation', 'runbook', 'help', 'release'];
const AUDIENCES = [
  'students',
  'families',
  'faculty',
  'institution-admins',
  'implementers',
  'partner-developers',
  'contributors',
  'operators',
  'support',
  'buyers',
  'security-reviewers',
];
const HELP_SECTIONS = ['What you need first', 'Steps', 'What you will see', 'If it does not work', 'Where your data goes'];

/* ── Reading ───────────────────────────────────────────────────────────── */

function walk(dir: string, ext: string[], skip: (p: string) => boolean = () => false): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (skip(p)) continue;
    if (statSync(p).isDirectory()) out.push(...walk(p, ext, skip));
    else if (ext.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const pageFiles = () => walk(HELP, ['.md']);
const rel = (p: string) => relative(root, p);

/**
 * Source text with comment lines and JSX comments taken out.
 *
 * Not `withoutComments` from `styles/rules.ts`: that one reads `image/*` in an
 * `accept` attribute as the start of a block comment and swallows what follows.
 * Dropping whole comment lines misses a trailing `// note`, which is harmless
 * here, because a label is never only in one.
 */
export function stripComments(text: string): string {
  return text
    .replace(/\{\/\*[^]*?\*\/\}/g, ' ')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
}

/**
 * All source text outside comments, whitespace collapsed, tests and this folder left out.
 *
 * Comments are blanked because a button renamed in the code is usually still
 * quoted in a comment about the old name, and a label found only there is gone.
 */
function sourceText(): string {
  const files = walk(SRC, ['.ts', '.tsx'], (p) => /\.test\.tsx?$/.test(p) || p.includes(join('lib', 'docs')));
  return files.map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n').replace(/\s+/g, ' ');
}

const normal = (s: string) => s.replace(/\s+/g, ' ').trim();
const inSource = (haystack: string, label: string) => haystack.includes(normal(label));

export interface Parsed {
  title: string;
  card: Record<string, string> | null;
  lead: string;
  /** The page without HTML comments. */
  body: string;
  labels: string[];
  live: string[];
  notLive: { name: string; status: string }[];
}

const CARD =
  /^> \*\*Type:\*\* (\S+) · \*\*Audience:\*\* ([a-z, -]+) · \*\*Owner:\*\* `([a-z]+)` · \*\*Truth:\*\* (\w+) · \*\*Reviewed:\*\* (\d{4}-\d{2}-\d{2}) · \*\*Held by:\*\* (`[^`]+`|—)$/;

function comment(text: string, key: string): string[] {
  const m = text.match(new RegExp(`<!-- ${key}: ([^]*?) -->`));
  return m ? m[1].split('|').map(normal).filter(Boolean) : [];
}

export function parse(text: string): Parsed {
  const lines = text.split('\n');
  const m = (lines[2] ?? '').match(CARD);
  const card = m
    ? { type: m[1], audience: m[2], owner: m[3], truth: m[4], reviewed: m[5], heldBy: m[6].replace(/`/g, '') }
    : null;
  const notLive = comment(text, 'not-live').map((x) => {
    const [name, status] = x.split('=');
    return { name: normal(name), status: normal(status ?? '') };
  });
  return {
    title: lines[0] ?? '',
    card,
    lead: lines[4] ?? '',
    body: text.replace(/<!--[^]*?-->/g, ''),
    labels: comment(text, 'labels'),
    live: comment(text, 'live'),
    notLive,
  };
}

/* ── Truth table ───────────────────────────────────────────────────────── */

export interface Row {
  name: string;
  status: string;
}

export function truthRows(text: string): Row[] {
  const rows: Row[] = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.replace(/\*\*|`/g, '').trim());
    if (cells.length < 3 || /^-+$/.test(cells[0]) || !/^[A-Z][A-Z_]+/.test(cells[1])) continue;
    rows.push({ name: cells[0], status: cells[1] });
  }
  return rows;
}

const rowFor = (rows: Row[], name: string) => rows.find((r) => r.name === name) ?? rows.find((r) => r.name.startsWith(name));
const isLive = (r: Row) => r.status.startsWith('LIVE');

/**
 * What a page can say that names a capability, by truth-table row.
 *
 * Phrases are the distinctive names, because a generic word such as "Search"
 * or "Career" cannot be policed by text. The row must exist, so renaming a row
 * in the table breaks this list on purpose.
 */
export const MENTIONS: { row: string; phrases: string[] }[] = [
  { row: 'My Path', phrases: ['My Path'] },
  { row: 'Study abroad', phrases: ['Study abroad'] },
  { row: 'Transfer equivalencies', phrases: ['Transfer equivalencies', 'transfer equivalency'] },
  { row: 'Search', phrases: ['search index'] },
  { row: 'Plan: registration readiness', phrases: ['registration readiness', 'Registration Day Mode'] },
  { row: 'Study Studio: upload/extraction', phrases: ['Study Studio'] },
  { row: 'Math/Data Lab', phrases: ['Math/Data Lab', 'Writing Studio', 'Lab Companion'] },
  { row: 'Career', phrases: ['Career'] },
  { row: 'Opportunities / scholarships', phrases: ['Opportunities', 'scholarship'] },
  { row: 'Campus Hub', phrases: ['Campus Hub'] },
  { row: 'Athlete / NIL', phrases: ['NIL', 'Athletics'] },
  { row: 'Community', phrases: ['Community'] },
  { row: 'Call (video)', phrases: ['Video call'] },
  { row: 'Supporter / Family view', phrases: ['Family view', 'Supporter view', 'family view'] },
  { row: 'Shared AI key activation', phrases: ['shared key', 'Shared key'] },
  { row: 'Plan catalog, entitlements', phrases: ['Semester Plus', 'Plus plan', 'Pro plan'] },
  { row: 'Hosted Checkout', phrases: ['Checkout'] },
  { row: 'Customer Portal', phrases: ['Customer Portal'] },
  { row: 'SAML SSO', phrases: ['SAML'] },
  { row: 'OIDC SSO', phrases: ['OIDC'] },
  { row: 'SCIM 2.0', phrases: ['SCIM'] },
  { row: 'LTI 1.3 (launch, deep link, AGS)', phrases: ['LTI'] },
  { row: 'SIS / catalog connectors', phrases: ['SIS connector'] },
  { row: 'Google / Microsoft calendar & files', phrases: ['Google Calendar', 'Google Drive', 'OneDrive'] },
  { row: 'Canvas', phrases: ['Canvas'] },
  { row: 'Institution gateway', phrases: ['institution gateway'] },
  { row: 'Tenant admin console', phrases: ['admin console', 'Operations console'] },
  { row: 'Faculty Course Studio, advisor meeting mode', phrases: ['Course Studio', 'course studio', 'advisor meeting mode', 'Advisor meeting mode'] },
  { row: 'Pen test, HECVAT, SOC 2', phrases: ['HECVAT', 'SOC 2', 'pen test'] },
  { row: 'Purpose-coded FERPA authorization', phrases: ['FERPA'] },
];

const has = (body: string, phrase: string) => new RegExp(`(^|[^A-Za-z])${phrase.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}($|[^A-Za-z])`).test(body);

/* ── Guards ────────────────────────────────────────────────────────────── */

export function cardProblems(p: Parsed, dirName: string, lines: string[]): string[] {
  const out: string[] = [];
  if (!p.title.startsWith('# ') || p.title.length < 4) out.push('line 1 is not a "# Title"');
  if (lines[1] !== '') out.push('line 2 is not blank');
  if (!p.card) return [...out, 'line 3 is not a card in the charter format'];
  const c = p.card;
  if (!TYPES.includes(c.type)) out.push(`Type "${c.type}" is not a page type`);
  const audience = c.audience.split(',').map((a) => a.trim());
  for (const a of audience) if (!AUDIENCES.includes(a)) out.push(`Audience "${a}" is not an audience`);
  if (dirName && !audience.includes(dirName)) out.push(`Audience must include "${dirName}" for a page in that folder`);
  if (!(SEATS as readonly string[]).includes(c.owner)) out.push(`Owner "${c.owner}" is not a council seat`);
  if (!['generated', 'held', 'reviewed'].includes(c.truth)) out.push(`Truth "${c.truth}" is not a truth word`);
  if (c.type === 'reference' && c.truth === 'reviewed') out.push('a reference page cannot be Truth: reviewed');
  if (c.reviewed !== DATE) out.push(`Reviewed is ${c.reviewed}, expected ${DATE}`);
  if (c.truth === 'held' && c.heldBy !== HELD_BY) out.push(`Held by is "${c.heldBy}", expected ${HELD_BY}`);
  if (c.truth === 'reviewed' && c.heldBy !== '—') out.push('a reviewed page has Held by: —');
  if (lines[3] !== '') out.push('line 4 is not blank');
  if (!/^[A-Z][^#>|*`-].*\.$/.test(p.lead)) out.push('line 5 is not one plain sentence ending in a full stop');
  if (c.type === 'help') {
    // In order, though a page may add a section between them.
    const headings = lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
    let at = 0;
    for (const h of HELP_SECTIONS) {
      const found = headings.indexOf(h, at);
      if (found < 0) {
        out.push(`a help page needs these sections in order: ${HELP_SECTIONS.join(', ')}; "${h}" is missing or out of order`);
        break;
      }
      at = found + 1;
    }
  }
  return out;
}

const bolds = (body: string): string[] =>
  body
    .split('\n')
    .filter((l) => !l.startsWith('> '))
    .flatMap((l) => [...l.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => normal(m[1])))
    .filter((b) => !b.endsWith(':'));

export function labelProblems(p: Parsed, haystack: string): string[] {
  const out: string[] = [];
  if (p.labels.length === 0) return ['no <!-- labels: ... --> list at the end'];
  const flat = normal(p.body);
  for (const l of p.labels) {
    if (!flat.includes(l)) out.push(`label "${l}" is listed but does not appear in the page`);
    if (!inSource(haystack, l)) out.push(`label "${l}" is not in app/src`);
  }
  for (const b of bolds(p.body)) if (!p.labels.includes(b)) out.push(`bold text "${b}" is not in the labels list`);
  return out;
}

/** Marketing words from the style guide, and claims the project may not make. */
const BANNED: { id: string; match: RegExp }[] = [
  { id: 'simply', match: /\bsimply\b/i },
  { id: 'easily', match: /\beasily\b/i },
  { id: 'just (as a softener)', match: /\bjust\b/i },
  { id: 'seamless', match: /\bseamless(ly)?\b/i },
  { id: 'powerful', match: /\bpowerful\b/i },
  { id: 'leverage', match: /\bleverage\b/i },
  { id: 'utilize', match: /\butili[sz]e\b/i },
  { id: 'compliant', match: /\bcompliant|\bcompliance\b/i },
  { id: 'certified', match: /\bcertified\b|\bcertification\b/i },
  { id: 'secure', match: /\bsecure(ly|d)?\b|\bsecurity\b/i },
  { id: 'COPPA/GDPR/FERPA', match: /\bCOPPA\b|\bGDPR\b|\bFERPA\b/ },
  { id: 'WCAG', match: /\bWCAG\b/ },
  { id: 'replaces your SIS/LMS', match: /\breplaces? your (SIS|LMS)\b/i },
];

/** What a reader reads: no comments, code, link targets, emphasis marks or table rules. */
export function prose(body: string): string {
  return body
    .replace(/<!--[^]*?-->/g, '')
    .replace(/```[^]*?```/g, '')
    .replace(/`[^`]*`/g, 'X')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/\*\*|\[|\]/g, '')
    .split('\n')
    .filter((l) => !/^\|[\s|:-]+\|?$/.test(l))
    .join('\n');
}

export function wordProblems(p: Parsed): string[] {
  const text = prose(p.body);
  const out: string[] = [];
  for (const r of RETIRED) if (r.match.test(text)) out.push(`retired word "${r.id}" (use ${r.use})`);
  for (const b of BANNED) if (b.match.test(text)) out.push(`banned word or claim "${b.id}"`);
  return out;
}

export function lengthProblems(p: Parsed, max = 35): string[] {
  const out: string[] = [];
  for (const raw of prose(p.body).split('\n')) {
    const line = raw.replace(/^\s*(?:[-*]|\d+\.)\s+/, '');
    const pieces = line.startsWith('|') ? line.split('|') : line.split(/(?<=[.!?])\s+/);
    for (const s of pieces) {
      const n = (s.match(/\S+/g) ?? []).length;
      if (n > max) out.push(`${n} words: "${normal(s).slice(0, 60)}…"`);
    }
  }
  return out;
}

export function capabilityProblems(p: Parsed, rows: Row[]): string[] {
  const out: string[] = [];
  const type = p.card?.type ?? '';
  if (type === 'help' && p.live.length === 0) out.push('a help page must declare <!-- live: ... --> capabilities');
  for (const name of p.live) {
    const r = rowFor(rows, name);
    if (!r) out.push(`live capability "${name}" is not in the truth table`);
    else if (!isLive(r)) out.push(`"${name}" is declared live but the truth table says ${r.status}`);
  }
  for (const d of p.notLive) {
    const r = rowFor(rows, d.name);
    if (!r) out.push(`not-live capability "${d.name}" is not in the truth table`);
    else if (!r.status.startsWith(d.status)) out.push(`"${d.name}" is declared ${d.status} but the truth table says ${r.status}`);
    if (type !== 'explanation') out.push(`"${d.name}" is not live, so only an explanation page may name it`);
    if (!new RegExp(`\\*\\*Status:\\*\\* ${d.status}`).test(p.body)) out.push(`"${d.name}" needs a "**Status:** ${d.status}" line`);
  }
  for (const m of MENTIONS) {
    const r = rowFor(rows, m.row);
    if (!r || isLive(r)) continue;
    const hit = m.phrases.find((ph) => has(prose(p.body), ph));
    if (hit && !p.notLive.some((d) => rowFor(rows, d.name) === r)) {
      out.push(`names "${hit}" (${m.row}, ${r.status}) without declaring it not-live`);
    }
  }
  return out;
}

export function linkProblems(file: string, text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = resolve(dirname(file), target.split('#')[0]);
    if (OTHER_AUTHORS.some((o) => path === o || path.startsWith(o + '/'))) continue;
    if (!existsSync(path)) out.push(`link "${target}" does not resolve`);
  }
  return out;
}

export function shortcutProblems(text: string): string[] {
  const out: string[] = [];
  const rows = [...text.matchAll(/^\| `([^`]+)` \| (.+) \|$/gm)].map((m) => [m[1], m[2]]);
  const want = [...SHORTCUTS, PALETTE].map((s) => [keyLabel(s.key), s.does]);
  for (const [k, d] of want) if (!rows.some((r) => r[0] === k && r[1] === d)) out.push(`no row for ${k}: ${d}`);
  for (const r of rows) if (!want.some((w) => w[0] === r[0])) out.push(`row for ${r[0]} is not a binding`);
  return out;
}

/* ── Fixtures for the controls ─────────────────────────────────────────── */

const GOOD = [
  '# Add a course',
  '',
  `> **Type:** help · **Audience:** students · **Owner:** \`product\` · **Truth:** held · **Reviewed:** ${DATE} · **Held by:** \`${HELD_BY}\``,
  '',
  'Use this page to add a course; stop reading if you have one.',
  '',
  '## What you need first',
  '',
  '- A syllabus.',
  '',
  '## Steps',
  '',
  '1. Open **Add a course**.',
  '',
  '## What you will see',
  '',
  'Your course.',
  '',
  '## If it does not work',
  '',
  'Try **Edit the course**.',
  '',
  '## Where your data goes',
  '',
  'It stays on your device.',
  '',
  '<!-- live: Today / Action Center -->',
  '<!-- labels: Add a course | Edit the course -->',
  '',
].join('\n');

const TABLE = [
  '| Module | Status | Persistence |',
  '|---|---|---|',
  '| Today / Action Center | LIVE (device) | device |',
  '| Campus Hub | MOCK_DEMO without a tenant | seed |',
  '| Supporter / Family view | PARTIAL | device |',
].join('\n');

const asPage = (text: string): Parsed => parse(text);

/* ── Tests ─────────────────────────────────────────────────────────────── */

const haystack = sourceText();
const truth = truthRows(readFileSync(join(root, 'docs/FEATURE-TRUTH-TABLE.md'), 'utf8'));
const files = pageFiles();
const pages = files.map((f) => ({ file: f, name: rel(f), text: readFileSync(f, 'utf8') }));
const dirOf = (f: string) => relative(HELP, dirname(f)).split('/')[0];
const AUDIENCE_OF: Record<string, string> = { students: 'students', families: 'families', faculty: 'faculty' };
const audienceFor = (f: string) => AUDIENCE_OF[dirOf(f)] ?? '';

describe('the set of help pages', () => {
  it('has the pages the index promises', () => {
    const helpPages = pages.filter((p) => asPage(p.text).card?.type === 'help');
    const explanations = pages.filter((p) => asPage(p.text).card?.type === 'explanation');
    expect(helpPages.length).toBeGreaterThanOrEqual(15);
    expect(helpPages.length + explanations.length).toBeLessThanOrEqual(25);
    expect(pages.filter((p) => dirOf(p.file) === 'families').length).toBeGreaterThanOrEqual(1);
    expect(pages.filter((p) => dirOf(p.file) === 'faculty').length).toBeGreaterThanOrEqual(1);
    // At most three "not available yet" stubs for students; families and faculty have their own.
    expect(explanations.filter((p) => dirOf(p.file) === 'students').length).toBeLessThanOrEqual(3);
  });

  it('is indexed: the README links every page and the glossary', () => {
    const index = readFileSync(join(HELP, 'README.md'), 'utf8');
    const missing = pages
      .filter((p) => p.file !== join(HELP, 'README.md'))
      .map((p) => relative(HELP, p.file))
      .filter((r) => !index.includes(`](${r})`));
    expect(missing).toEqual([]);
  });
});

describe.each(pages)('$name', (page) => {
  const parsed = asPage(page.text);
  const lines = page.text.split('\n');
  const dir = audienceFor(page.file);

  it('has a valid card, a plain first sentence and its sections', () => {
    expect(cardProblems(parsed, dir, lines)).toEqual([]);
  });

  it('names only labels that exist in the app, and lists every bold label', () => {
    expect(labelProblems(parsed, haystack)).toEqual([]);
  });

  it('uses no retired word, no banned word and no claim the project may not make', () => {
    expect(wordProblems(parsed)).toEqual([]);
  });

  it('has no sentence over 35 words', () => {
    expect(lengthProblems(parsed)).toEqual([]);
  });

  it('names capabilities only as the truth table allows', () => {
    expect(capabilityProblems(parsed, truth)).toEqual([]);
  });

  it('has links that resolve', () => {
    expect(linkProblems(page.file, page.text)).toEqual([]);
  });
});

describe('the keyboard page', () => {
  it('lists exactly the bindings in keys.ts', () => {
    const text = readFileSync(join(HELP, 'students/keyboard-shortcuts.md'), 'utf8');
    expect(shortcutProblems(text)).toEqual([]);
  });
});

describe('the glossary', () => {
  const text = readFileSync(join(HELP, 'GLOSSARY.md'), 'utf8');
  const terms = [...text.matchAll(/^\| \*\*([^*]+)\*\* \|/gm)].map((m) => m[1]);

  it('defines each term once, and each term is in the app', () => {
    expect(terms.length).toBeGreaterThanOrEqual(30);
    expect(new Set(terms).size).toBe(terms.length);
    expect(terms.filter((t) => !inSource(haystack, t))).toEqual([]);
  });

  it('lists every term in its labels', () => {
    const labels = parse(text).labels;
    expect(terms.filter((t) => !labels.includes(t))).toEqual([]);
  });
});

/* ── Controls: every guard fails when it should, and passes when it should ── */

describe('controls', () => {
  const swap = (from: string, to: string) => GOOD.replace(from, to);

  it('the fixture passes every guard', () => {
    const p = asPage(GOOD);
    expect(cardProblems(p, 'students', GOOD.split('\n'))).toEqual([]);
    expect(labelProblems(p, haystack)).toEqual([]);
    expect(wordProblems(p)).toEqual([]);
    expect(lengthProblems(p)).toEqual([]);
    expect(capabilityProblems(p, truthRows(TABLE))).toEqual([]);
  });

  it('the source probe finds a real label and refuses a made-up one', () => {
    expect(inSource(haystack, 'Add a course')).toBe(true);
    expect(inSource(haystack, 'Add a cours3 from nowhere')).toBe(false);
  });

  it('the card guard names each fault', () => {
    const bad = (t: string) => cardProblems(asPage(t), 'students', t.split('\n'));
    expect(bad(swap('`product`', '`someone`')).join()).toMatch(/not a council seat/);
    expect(bad(swap('**Type:** help', '**Type:** guide')).join()).toMatch(/not a page type/);
    expect(bad(swap('**Reviewed:** 2026-10-04', '**Reviewed:** 2026-10-03')).join()).toMatch(/Reviewed is/);
    expect(bad(swap('`app/src/lib/docs/help.test.ts`', '`app/src/other.test.ts`')).join()).toMatch(/Held by/);
    expect(bad(swap('**Audience:** students', '**Audience:** families')).join()).toMatch(/must include "students"/);
    expect(bad(swap('Use this page to add a course; stop reading if you have one.', '## Not a sentence')).join()).toMatch(/plain sentence/);
    expect(bad(swap('## Steps', '## How')).join()).toMatch(/sections in order/);
    expect(bad(swap('> **Type:**', '> Type:')).join()).toMatch(/card/);
  });

  it('the label guard fails on a renamed button, a missing label and an unlisted bold', () => {
    const issues = (t: string) => labelProblems(asPage(t), haystack).join();
    expect(issues(GOOD.replaceAll('Add a course', 'Add a cours3'))).toMatch(/label "Add a cours3" is not in app\/src/);
    expect(issues(swap('Add a course | Edit the course', 'Add a course'))).toMatch(/bold text "Edit the course" is not in the labels list/);
    expect(issues(swap('Try **Edit the course**.', 'Try it.'))).toMatch(/does not appear in the page/);
    expect(issues(swap('<!-- labels: Add a course | Edit the course -->', ''))).toMatch(/no <!-- labels/);
  });

  it('the word guard catches a retired word, a banned word and a claim', () => {
    const issues = (t: string) => wordProblems(asPage(t)).join();
    expect(issues(swap('A syllabus.', 'A syllabus and your homework task.'))).toMatch(/retired word "task"/);
    expect(issues(swap('A syllabus.', 'Easily add one.'))).toMatch(/banned word or claim "easily"/);
    expect(issues(swap('It stays on your device.', 'It is stored securely.'))).toMatch(/"secure"/);
    expect(issues(swap('It stays on your device.', 'It meets WCAG.'))).toMatch(/WCAG/);
    // A retired word inside code or a link target is not prose.
    expect(issues(swap('A syllabus.', 'A syllabus, see `task` and [here](task.md).'))).not.toMatch(/retired/);
  });

  it('the length guard fails at 36 words and passes at 35', () => {
    const sentence = (n: number) => `${Array.from({ length: n }, () => 'word').join(' ')}.`;
    expect(lengthProblems(asPage(swap('Your course.', sentence(36)))).length).toBe(1);
    expect(lengthProblems(asPage(swap('Your course.', sentence(35)))).length).toBe(0);
    expect(lengthProblems(asPage(swap('Your course.', `| ${sentence(40)} |`))).length).toBe(1);
  });

  it('the capability guard holds the truth table', () => {
    const rows = truthRows(TABLE);
    const issues = (t: string) => capabilityProblems(asPage(t), rows).join();
    expect(truthRows(TABLE).length).toBe(3);
    expect(issues(swap('Today / Action Center', 'Campus Hub'))).toMatch(/declared live but the truth table says MOCK_DEMO/);
    expect(issues(swap('Today / Action Center', 'Nowhere'))).toMatch(/not in the truth table/);
    expect(issues(swap('Your course.', 'Open the Campus Hub.'))).toMatch(/without declaring it not-live/);
    expect(issues(swap('<!-- live: Today / Action Center -->', ''))).toMatch(/must declare/);
    // Declared and honest, on an explanation: passes.
    const honest = swap('**Type:** help', '**Type:** explanation')
      .replace('Your course.', '**Status:** MOCK_DEMO. Open the Campus Hub.')
      .replace('<!-- live: Today / Action Center -->', '<!-- not-live: Campus Hub=MOCK_DEMO -->');
    expect(issues(honest)).toBe('');
    // The same declaration on a help page is refused.
    expect(issues(honest.replace('**Type:** explanation', '**Type:** help'))).toMatch(/only an explanation page may name it/);
    // A wrong status word is refused.
    expect(issues(honest.replaceAll('MOCK_DEMO', 'LIVE'))).toMatch(/declared LIVE but the truth table says MOCK_DEMO/);
    // No Status line is refused.
    expect(issues(honest.replace('**Status:** MOCK_DEMO. ', ''))).toMatch(/needs a "\*\*Status:\*\* MOCK_DEMO" line/);
  });

  it('every phrase list points at a row the truth table still has', () => {
    for (const m of MENTIONS) expect(rowFor(truth, m.row), m.row).toBeDefined();
  });

  it('the link guard fails on a missing file and passes on a real one', () => {
    const here = join(HELP, 'README.md');
    expect(linkProblems(here, '[ok](GLOSSARY.md)')).toEqual([]);
    expect(linkProblems(here, '[gone](students/not-a-page.md)')).toEqual(['link "students/not-a-page.md" does not resolve']);
    expect(linkProblems(here, '[outside](../guides/institution/)')).toEqual([]);
    expect(linkProblems(here, '[web](https://example.edu)')).toEqual([]);
  });

  it('the shortcut guard fails on a missing row and on an invented one', () => {
    const real = readFileSync(join(HELP, 'students/keyboard-shortcuts.md'), 'utf8');
    expect(shortcutProblems(real)).toEqual([]);
    expect(shortcutProblems(real.replace('| `K` | The calendar |\n', '')).join()).toMatch(/no row for K/);
    expect(shortcutProblems(real.replace('| `K` | The calendar |', '| `K` | The calendar |\n| `Z` | Zoom |')).join()).toMatch(/row for Z is not a binding/);
    expect(shortcutProblems(real.replace('The calendar', 'Calendar')).join()).toMatch(/no row for K/);
  });

  it('the helpers read a card and a table the way the guards need', () => {
    const p = asPage(GOOD);
    expect(p.card?.type).toBe('help');
    expect(p.live).toEqual(['Today / Action Center']);
    expect(p.labels).toEqual(['Add a course', 'Edit the course']);
  });
});
