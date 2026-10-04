import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CRISIS_NOTICE } from '../../community/crisis';
import { COUNCIL, SEATS } from '../launchreadiness';
import { CATEGORY_LABELS, CONTEXT_KEYS, firstResponseHours } from '../supporttickets';

/**
 * Holds `docs/support/**`: the problem-shaped help articles and the internal
 * triage layer.
 *
 * Every page is a claim about the app or about how support is run, so each
 * claim that can be checked by a machine is checked here:
 *
 *   - the card on each page is well formed, and its owner is a real seat;
 *   - every article has Symptom / Check / Fix / Not your fault / Contact, with
 *     the send and do-not-send lists and a link to status and known limits;
 *   - every interface string an article quotes (its `labels` comment) exists
 *     in the app or a function's source, and appears in the article's prose;
 *   - the safety notice is verbatim, not paraphrased;
 *   - every relative link resolves, anchors into these pages included;
 *   - every macro names articles and documents that exist, and says nothing
 *     the claims discipline forbids;
 *   - the staffing table equals the seat register;
 *   - the access window, ticket limits and context keys equal the migrations
 *     and the client.
 *
 * `app/src/lib/ops/claims.ts` exports no text scanner (its `problems()` checks
 * the claims register, not prose), so the banned-claim list here is local and
 * is drawn from the public claims register (CLM-010, CLM-012, CLM-016) and the
 * five overclaims `site/site.test.tsx` already refuses.
 *
 * Each guard has a control: a case that must fail and a case that must pass,
 * so a broken probe cannot read as clean.
 */

const root = join(import.meta.dirname, '../../../..');
const THIS_TEST = 'app/src/lib/docs/support.test.ts';
const REVIEWED = '2026-10-04';

const read = (p: string): string => readFileSync(join(root, p), 'utf8');

/** Every file under a directory, as repository-relative paths. */
function walk(dir: string, keep: (p: string) => boolean): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop() as string;
    for (const e of readdirSync(join(root, d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') stack.push(p);
      } else if (keep(p)) out.push(p);
    }
  }
  return out.sort();
}

const ARTICLES = walk('docs/support/articles', (p) => p.endsWith('.md'));
const INTERNAL = walk('docs/support/internal', (p) => p.endsWith('.md'));
const PAGES = ['docs/support/README.md', ...ARTICLES, ...INTERNAL];

// ── the card ───────────────────────────────────────────────────────────────

const TYPES = ['tutorial', 'how-to', 'reference', 'explanation', 'runbook', 'help', 'release'];
const AUDIENCES = ['students', 'families', 'faculty', 'institution-admins', 'implementers', 'partner-developers', 'contributors', 'operators', 'support', 'buyers', 'security-reviewers'];
const TRUTHS = ['generated', 'held', 'reviewed'];
const STATUS_WORDS = ['LIVE', 'IMPLEMENTED_NOT_RELEASED', 'PARTIAL', 'MOCK_DEMO', 'PLANNED', 'BLOCKED'];

const CARD = /^> \*\*Type:\*\* ([a-z-]+) · \*\*Audience:\*\* ([a-z-]+(?:, [a-z-]+)*) · \*\*Owner:\*\* `([a-z]+)` · \*\*Truth:\*\* ([a-z]+) · \*\*Reviewed:\*\* (\d{4}-\d{2}-\d{2}) · \*\*Held by:\*\* `([^`]+)`$/;

/** Everything wrong with the head of one page; empty when it is right. */
function cardProblems(text: string, seats: readonly string[] = SEATS): string[] {
  const out: string[] = [];
  const lines = text.split('\n');
  if (!/^# \S/.test(lines[0] ?? '')) out.push('line 1 is not a title');
  if (lines[1] !== '') out.push('line 2 is not blank');
  const m = CARD.exec(lines[2] ?? '');
  if (!m) return [...out, 'line 3 is not a card'];
  const [, type, audience, owner, truth, reviewed, heldBy] = m;
  if (lines.filter((l) => l.startsWith('> **Type:**')).length !== 1) out.push('not exactly one card line');
  if (!TYPES.includes(type)) out.push(`type ${type} is not a type`);
  const people = audience.split(', ');
  if (people.length > 2) out.push('more than two audiences');
  for (const a of people) if (!AUDIENCES.includes(a)) out.push(`audience ${a} is not an audience`);
  if (!seats.includes(owner)) out.push(`owner ${owner} is not a seat`);
  if (!TRUTHS.includes(truth)) out.push(`truth ${truth} is not a truth`);
  if (reviewed !== REVIEWED) out.push(`reviewed ${reviewed}, expected ${REVIEWED}`);
  if (type === 'reference' && truth === 'reviewed') out.push('a reference page cannot be only reviewed');
  if ((type === 'how-to' || type === 'tutorial') && truth !== 'held') out.push('how-to and tutorial pages must be held');
  if (truth === 'held' && heldBy !== THIS_TEST) out.push(`held by ${heldBy}, not this test`);
  if (truth === 'reviewed' && heldBy !== '—') out.push('a reviewed page names no test');
  // line 4 blank, line 5 the one plain sentence.
  if (lines[3] !== '') out.push('no blank line after the card');
  const sentence = lines[4] ?? '';
  if (!sentence || /^[#>*|`-]/.test(sentence)) out.push('line 5 is not a sentence');
  else if (!/\.$/.test(sentence)) out.push('the sentence does not end with a full stop');
  else if (!/stop reading/i.test(sentence)) out.push('the sentence does not say who should stop reading');
  if (!/^\*\*Status:\*\* (.*)$/m.test(text)) out.push('no Status line');
  else {
    const status = /^\*\*Status:\*\* (.*)$/m.exec(text)?.[1] ?? '';
    if (!STATUS_WORDS.some((w) => status.startsWith(w))) out.push('Status does not open with a truth-table word');
  }
  return out;
}

// ── articles ───────────────────────────────────────────────────────────────

const SECTIONS = ['Symptom', 'Check', 'Fix', 'Not your fault', 'Contact'];
const CONTACT_PARTS = ['What to send', 'What not to send', 'Status and known limits'];

function headings(text: string, level: 2 | 3): string[] {
  const prefix = '#'.repeat(level) + ' ';
  const prose = text.replace(/```[\s\S]*?```/g, '');
  return prose.split('\n').filter((l) => l.startsWith(prefix)).map((l) => l.slice(prefix.length).trim());
}

/** The body of the section that opens at the given heading, up to the next of its level. */
function bodyOf(text: string, level: 2 | 3, title: string): string {
  const lines = text.split('\n');
  const prefix = '#'.repeat(level) + ' ';
  const start = lines.findIndex((l) => l === `${prefix}${title}`);
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const stop = rest.findIndex((l) => l.startsWith(prefix) || (level === 3 && l.startsWith('## ')));
  return (stop < 0 ? rest : rest.slice(0, stop)).join('\n').trim();
}

function articleProblems(text: string): string[] {
  const out: string[] = [];
  const h2 = headings(text, 2);
  if (h2.join('|') !== SECTIONS.join('|')) out.push(`sections are [${h2.join(', ')}], expected [${SECTIONS.join(', ')}]`);
  for (const s of SECTIONS) if (!bodyOf(text, 2, s).replace(/\s/g, '')) out.push(`section ${s} is empty`);
  const contact = bodyOf(text, 2, 'Contact');
  const h3 = headings(contact, 3);
  for (const part of CONTACT_PARTS) {
    if (!h3.includes(part)) out.push(`Contact has no "${part}"`);
    else if (!bodyOf(contact, 3, part).replace(/\s/g, '')) out.push(`"${part}" is empty`);
  }
  const status = bodyOf(contact, 3, 'Status and known limits');
  if (!/app\/public\/status\.html/.test(status)) out.push('no link to the status page');
  if (!/KNOWN-LIMITATIONS\.md/.test(status)) out.push('no link to known limits');
  if (!/No response time is committed/.test(status)) out.push('does not say no response time is committed');
  if (!/staffing-today/.test(status)) out.push('does not link how support is staffed');
  return out;
}

// ── labels ─────────────────────────────────────────────────────────────────

const collapse = (s: string): string => s.replace(/\s+/g, ' ');

/** The `<!-- labels: [...] -->` comment of an article, or null. */
function labelsOf(text: string): string[] | null {
  const m = /<!-- labels: (\[[\s\S]*?\]) -->/.exec(text);
  if (!m) return null;
  try {
    const parsed: unknown = JSON.parse(m[1]);
    return Array.isArray(parsed) && parsed.every((x) => typeof x === 'string' && x.length > 0) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

/** The page as a reader sees it: comments removed. */
const visible = (text: string): string => text.replace(/<!--[\s\S]*?-->/g, '');

/**
 * The page without the interface sentences it quotes. An app sentence such as
 * "usually within a minute" is what the app says about Stripe, not something
 * support promises, so the promise scan reads around the labels.
 */
function withoutLabels(text: string): string {
  let out = visible(text);
  for (const l of labelsOf(text) ?? []) out = out.split(l).join(' ');
  return out;
}

/**
 * Source with its comments taken out. A sentence in a comment is not on any
 * screen, so a label that survives only in a comment is a label that has gone.
 * Block comments first, then line comments that begin a line or follow
 * whitespace (so `https://` inside a string is left alone).
 */
function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

/** Strings in the app and in the functions, never in a test: a test can quote anything. */
let corpusCache: string | null = null;
function corpus(): string {
  if (corpusCache === null) {
    const keep = (p: string) => /\.(ts|tsx)$/.test(p) && !/\.(test|check)\./.test(p) && !p.endsWith('.d.ts');
    const files = [...walk('app/src', keep), ...walk('supabase/functions', keep)];
    corpusCache = collapse(files.map((f) => withoutComments(read(f))).join('\n'));
  }
  return corpusCache;
}

const missing = (labels: readonly string[], haystack: string): string[] => labels.filter((l) => !haystack.includes(collapse(l)));

// ── links ──────────────────────────────────────────────────────────────────

/** GitHub's heading anchor: lower case, punctuation dropped, spaces to hyphens. */
const slug = (h: string): string => h.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/ /g, '-');

/** Relative links that point nowhere, anchors into pages we can read included. Code is not a link. */
function deadLinks(file: string, text: string, exists: (p: string) => boolean, source: (p: string) => string | null): string[] {
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const out: string[] = [];
  for (const m of prose.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|tel:)/.test(target)) continue;
    const [path, anchor] = target.split('#');
    const resolved = path ? normalize(join(dirname(file), decodeURI(path))) : file;
    if (!exists(resolved)) {
      out.push(`${file} → ${target}`);
      continue;
    }
    if (anchor && resolved.endsWith('.md') && resolved.startsWith('docs/support/')) {
      const body = source(resolved);
      const slugs = body === null ? [] : body.split('\n').filter((l) => /^#{1,6} /.test(l)).map((l) => slug(l.replace(/^#+ /, '')));
      if (!slugs.includes(anchor)) out.push(`${file} → ${target} (no such heading)`);
    }
  }
  return out;
}

// ── macros ─────────────────────────────────────────────────────────────────

interface Macro {
  id: string;
  title: string;
  quote: string;
  articles: string[];
  docs: string[];
}

function macrosOf(text: string): Macro[] {
  const parts = text.split(/^### (M\d{2}) — (.*)$/m);
  const out: Macro[] = [];
  for (let i = 1; i < parts.length; i += 3) {
    const body = parts[i + 2] ?? '';
    const meta = /<!-- macro: id=(M\d{2}); articles=([^;]*); docs=([^>]*?) -->/.exec(body);
    out.push({
      id: parts[i],
      title: parts[i + 1],
      quote: body.split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, '')).join('\n'),
      articles: meta ? meta[2].split(',').map((s) => s.trim()).filter(Boolean) : [],
      docs: meta && meta[1] === parts[i] ? meta[3].split(',').map((s) => s.trim()).filter(Boolean) : [],
    });
  }
  return out;
}

/**
 * What a reply may not say. Drawn from the public claims register (CLM-010,
 * CLM-012, CLM-016) and the five overclaims `site/site.test.tsx` refuses.
 */
const BANNED: readonly [string, RegExp][] = [
  ['a round-the-clock claim', /\b24\s?\/\s?7\b|\b24 hours a day\b|\baround the clock\b/i],
  ['a response time', /\bwithin\s+(\d+|an?|one|two|three|four|five|a few|several)\s+(business\s+|working\s+)?(minutes?|hours?|days?|weeks?)\b/i],
  ['a vague speed', /\b(promptly|shortly|immediately|right away|as soon as possible|asap|same[- ]day|next[- ]day|quickly|in no time)\b/i],
  ['a guarantee', /\bguarantee[sd]?\b|\bguaranteed\b/i],
  ['an outcome promise', /\b(we|i)(?:'ll| will)\s+(fix|resolve|restore|refund|get back to you|reply|respond|sort)\b/i],
  ['no loss', /\bno data loss\b|\bnever (lose|lost)\b|\bnothing will be lost\b/i],
  ['safety or assurance', /\b(safe|safely|secure[ds]?|securely|encrypted|private by design)\b/i],
  ['an assurance status', /\b(compliant|compliance|certified|certification|SOC ?2|HECVAT|VPAT|WCAG|FERPA|COPPA|GDPR|uptime|SLA|RTO|RPO)\b/i],
  ['replacing a school system', /replac(es|ing) (your |the )?(SIS|LMS|registrar|student information system|learning management system)/i],
];

const bannedIn = (text: string): string[] => BANNED.filter(([, re]) => re.test(text)).map(([name]) => name);

/** Promises of time or guarantees, which no page outside the targets table may make. */
const TIME_PROMISES = BANNED.filter(([name]) => ['a round-the-clock claim', 'a response time', 'a guarantee'].includes(name));
const timePromisesIn = (text: string): string[] => TIME_PROMISES.filter(([, re]) => re.test(text)).map(([name]) => name);

/** The assurance words as a claim about Semester, which a page may deny but not make. */
const ASSURES = /\b(semester|the app|your data|your information) (is|are) (fully |entirely )?(secure|compliant|certified|safe)\b|\bfully (FERPA[- ])?compliant\b|\b100% compliant\b/i;

// ── seats ──────────────────────────────────────────────────────────────────

/** `| seat | holder | note |` rows between two comment markers, as [seat, holder]. */
function seatRows(text: string): [string, string][] {
  const m = /<!-- seats -->([\s\S]*?)<!-- \/seats -->/.exec(text);
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((l) => /^\| `([a-z]+)` \| ([^|]+) \|/.exec(l))
    .filter((x): x is RegExpExecArray => x !== null)
    .map((x) => [x[1], x[2].trim()]);
}

function seatProblems(rows: [string, string][], council: readonly { seat: string; holder: string | null }[]): string[] {
  const out: string[] = [];
  for (const c of council) {
    const row = rows.find(([s]) => s === c.seat);
    if (!row) out.push(`seat ${c.seat} is not in the table`);
    else if (row[1] !== (c.holder ?? 'vacant')) out.push(`seat ${c.seat}: the table says "${row[1]}", the register says "${c.holder ?? 'vacant'}"`);
  }
  for (const [s] of rows) if (!council.some((c) => c.seat === s)) out.push(`seat ${s} is not in the register`);
  return out;
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('docs/support: the pages exist and are the ones we mean', () => {
  it('has the twelve articles, the five internal pages and the index (control for every check below)', () => {
    expect(ARTICLES.map((p) => p.split('/').pop())).toEqual([
      'accessibility-help.md',
      'ai-unavailable.md',
      'billing.md',
      'calendar-not-updating.md',
      'cannot-sign-in.md',
      'delete-account-export-data.md',
      'deleted-item-came-back.md',
      'old-version-showing.md',
      'safety-concern.md',
      'school-connection-failing.md',
      'syllabus-did-not-parse.md',
      'sync-waiting-or-conflict.md',
    ]);
    expect(INTERNAL.map((p) => p.split('/').pop())).toEqual([
      'escalation-map.md',
      'macro-library.md',
      'severity-and-routing.md',
      'supporter-access.md',
      'triage-guide.md',
    ]);
    expect(PAGES).toHaveLength(18);
  });

  it('is indexed: the README links every article and every internal page', () => {
    const readme = read('docs/support/README.md');
    for (const p of [...ARTICLES, ...INTERNAL]) expect(readme, p).toContain(`](${p.replace('docs/support/', '')})`);
  });

  it('routes every article from the triage guide and a macro', () => {
    const triage = read('docs/support/internal/triage-guide.md');
    const cited = new Set(macrosOf(read('docs/support/internal/macro-library.md')).flatMap((m) => m.articles));
    for (const p of ARTICLES) {
      const name = p.split('/').pop() as string;
      expect(triage, name).toContain(`](../articles/${name})`);
      expect(cited.has(name.replace(/\.md$/, '')), `no macro cites ${name}`).toBe(true);
    }
  });
});

describe('docs/support: the card', () => {
  it('is valid on every page', () => {
    for (const p of PAGES) expect(cardProblems(read(p)), p).toEqual([]);
  });

  const good = [
    '# A title',
    '',
    '> **Type:** help · **Audience:** students, support · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`',
    '',
    'Use this page for a thing; stop reading if it is not that.',
    '',
    '**Status:** LIVE where it is on.',
  ].join('\n');

  it('passes a good page and refuses each fault (controls)', () => {
    expect(cardProblems(good)).toEqual([]);
    expect(cardProblems(good.replace('`success`', '`somebody`'))).toContain('owner somebody is not a seat');
    expect(cardProblems(good.replace('help', 'guide'))).toContain('type guide is not a type');
    expect(cardProblems(good.replace('students, support', 'students, support, faculty'))).toContain('more than two audiences');
    expect(cardProblems(good.replace('2026-10-04 ·', '2026-10-03 ·'))).toContain('reviewed 2026-10-03, expected 2026-10-04');
    expect(cardProblems(good.replace('**Type:** help', '**Type:** reference').replace('held', 'reviewed'))).toContain('a reference page cannot be only reviewed');
    expect(cardProblems(good.replace('app/src/lib/docs/support.test.ts', 'app/src/lib/other.test.ts'))).toContain('held by app/src/lib/other.test.ts, not this test');
    expect(cardProblems(good.replace('Use this page for a thing; stop reading if it is not that.', 'Use this page for a thing.'))).toContain('the sentence does not say who should stop reading');
    expect(cardProblems(good.replace('**Status:** LIVE where it is on.', ''))).toContain('no Status line');
    expect(cardProblems(good.replace('LIVE', 'Fine'))).toContain('Status does not open with a truth-table word');
  });
});

describe('docs/support: every article has the sections', () => {
  it('has Symptom, Check, Fix, Not your fault and Contact, and the Contact lists', () => {
    for (const p of ARTICLES) expect(articleProblems(read(p)), p).toEqual([]);
  });

  it('refuses a missing section, an empty list and a missing link (controls)', () => {
    const real = read('docs/support/articles/cannot-sign-in.md');
    expect(articleProblems(real)).toEqual([]);
    expect(articleProblems(real.replace('## Fix', '## Repair'))[0]).toMatch(/sections are/);
    expect(articleProblems(real.replace('### What not to send', '### Other'))).toContain('Contact has no "What not to send"');
    expect(articleProblems(real.replace(/app\/public\/status\.html/g, 'elsewhere.html'))).toContain('no link to the status page');
    expect(articleProblems(real.replace(/KNOWN-LIMITATIONS\.md/g, 'ELSE.md'))).toContain('no link to known limits');
    expect(articleProblems(real.replace('No response time is committed', 'It is quick'))).toContain('does not say no response time is committed');
  });

  it('puts the symptom in the person’s words: every article quotes at least three', () => {
    for (const p of ARTICLES) expect((bodyOf(read(p), 2, 'Symptom').match(/"[^"]+"/g) ?? []).length, p).toBeGreaterThanOrEqual(3);
  });
});

describe('docs/support: every interface string an article quotes exists', () => {
  it('lists its labels in a machine-readable comment', () => {
    for (const p of ARTICLES) {
      const labels = labelsOf(read(p));
      expect(labels, p).not.toBeNull();
      expect((labels ?? []).length, p).toBeGreaterThanOrEqual(5);
      expect(new Set(labels).size, `${p} repeats a label`).toBe((labels ?? []).length);
    }
  });

  it('finds every label in the app or a function source, never only in a test', () => {
    const haystack = corpus();
    for (const p of ARTICLES) expect(missing(labelsOf(read(p)) ?? [], haystack), p).toEqual([]);
  });

  it('prints every label in the article itself, so the comment cannot drift from the prose', () => {
    for (const p of ARTICLES) {
      const prose = collapse(visible(read(p)));
      expect((labelsOf(read(p)) ?? []).filter((l) => !prose.includes(collapse(l))), p).toEqual([]);
    }
  });

  it('can tell a real label from an invented one, and ignores tests (controls)', () => {
    const haystack = corpus();
    expect(missing(['Send a reset link', 'Sign out (keeps data on this device)'], haystack)).toEqual([]);
    expect(missing(['Press the purple button to recover everything'], haystack)).toEqual(['Press the purple button to recover everything']);
    // A string that exists only in this test file is not a label: tests are not the product.
    expect(missing(['zzq-support-doc-probe-7731'], haystack)).toEqual(['zzq-support-doc-probe-7731']);
    // A function's own message counts, because the app shows it.
    expect(missing(['AI generation is switched off right now.'], haystack)).toEqual([]);
    // A sentence that survives only in a comment is not a label (control for the comment stripper).
    expect(withoutComments('const a = 1; // Send a reset link\n/* Send a reset link */ const b = "https://x.example/Send a reset link";')).toContain('https://x.example/Send a reset link');
    expect(withoutComments('x // gone\ny /* gone too */ z')).not.toMatch(/gone/);
    expect(labelsOf('no comment here')).toBeNull();
    expect(labelsOf('<!-- labels: [1, 2] -->')).toBeNull();
  });
});

describe('docs/support: the safety notice is verbatim', () => {
  const norm = (s: string) => collapse(s.replace(/^>\s?/gm, '')).trim();

  it('is quoted exactly in the article, the macro and the runbook', () => {
    expect(norm(read('docs/support/articles/safety-concern.md'))).toContain(CRISIS_NOTICE);
    const m12 = macrosOf(read('docs/support/internal/macro-library.md')).find((m) => m.id === 'M12');
    expect(collapse(m12?.quote ?? '')).toContain(CRISIS_NOTICE);
    expect(norm(read('docs/CRISIS-RESPONSE-RUNBOOK.md'))).toContain(CRISIS_NOTICE);
  });

  it('refuses a paraphrase (control)', () => {
    const paraphrase = 'If someone is in danger, call emergency services. Semester Community is not an emergency service.';
    expect(norm(`> ${paraphrase}`)).not.toContain(CRISIS_NOTICE);
    expect(CRISIS_NOTICE).toMatch(/^If someone is in immediate danger/);
  });
});

describe('docs/support: links', () => {
  const exists = (p: string) => existsSync(join(root, p));
  const source = (p: string) => (exists(p) ? read(p) : null);

  it('resolve, including anchors into these pages', () => {
    const dead = PAGES.flatMap((f) => deadLinks(f, read(f), exists, source));
    expect(dead).toEqual([]);
  });

  it('has links to check at all (control)', () => {
    const count = PAGES.reduce((n, f) => n + (read(f).match(/\]\((?!https?:)[^)]+\)/g) ?? []).length, 0);
    expect(count).toBeGreaterThan(150);
  });

  it('catches a dead link and a dead anchor, and ignores code (controls)', () => {
    const none = () => false;
    expect(deadLinks('docs/support/README.md', 'See [x](nope.md).', none, () => null)).toEqual(['docs/support/README.md → nope.md']);
    expect(deadLinks('docs/support/articles/a.md', '[s](../README.md#no-such-heading)', exists, source)).toEqual(['docs/support/articles/a.md → ../README.md#no-such-heading (no such heading)']);
    expect(deadLinks('docs/support/articles/a.md', '[s](../README.md#staffing-today)', exists, source)).toEqual([]);
    expect(deadLinks('docs/support/README.md', 'Written as `[a](gone.md)`.', none, () => null)).toEqual([]);
    expect(deadLinks('docs/support/README.md', '```\n[a](gone.md)\n```', none, () => null)).toEqual([]);
    expect(slug('Staffing today')).toBe('staffing-today');
  });
});

describe('docs/support: the macros', () => {
  const macros = macrosOf(read('docs/support/internal/macro-library.md'));

  it('has twelve, M01 to M12, each with a reply, an article and a document', () => {
    expect(macros.map((m) => m.id)).toEqual(Array.from({ length: 12 }, (_, i) => `M${String(i + 1).padStart(2, '0')}`));
    for (const m of macros) {
      expect(m.quote.trim().length, m.id).toBeGreaterThan(200);
      expect(m.articles.length, `${m.id} cites no article`).toBeGreaterThan(0);
      expect(m.docs.length, `${m.id} cites no document`).toBeGreaterThan(0);
    }
  });

  it('cites only articles and documents that exist', () => {
    for (const m of macros) {
      for (const a of m.articles) expect(existsSync(join(root, `docs/support/articles/${a}.md`)), `${m.id}: article ${a}`).toBe(true);
      for (const d of m.docs) expect(existsSync(join(root, d)), `${m.id}: ${d}`).toBe(true);
    }
  });

  it('makes no banned claim in any reply', () => {
    for (const m of macros) expect(bannedIn(m.quote), m.id).toEqual([]);
  });

  it('says there is no committed response time in every reply', () => {
    for (const m of macros) expect(m.quote, m.id).toContain('There is no committed response time for Semester support.');
  });

  it('fires on each banned claim and passes honest wording (controls)', () => {
    const probes: Record<string, string> = {
      'a round-the-clock claim': 'We are here 24/7 for you.',
      'a response time': 'You will hear from us within 24 hours.',
      'a vague speed': 'We will reply shortly.',
      'a guarantee': 'This is guaranteed to work.',
      'an outcome promise': 'I will fix it for you.',
      'no loss': 'There is no data loss.',
      'safety or assurance': 'Your data is secure.',
      'an assurance status': 'Semester is FERPA compliant.',
      'replacing a school system': 'Semester replaces your SIS.',
    };
    expect(Object.keys(probes).sort()).toEqual(BANNED.map(([n]) => n).sort());
    for (const [name, probe] of Object.entries(probes)) expect(bannedIn(probe), probe).toContain(name);
    expect(bannedIn('There is no committed response time for Semester support.')).toEqual([]);
    expect(bannedIn('The shared key is switched off. Everything else in Semester still works.')).toEqual([]);
    expect(bannedIn('Semester does not replace your school’s systems.')).toEqual([]);
    expect(bannedIn('A safety service. Support and the safety notice.')).toEqual([]);
  });

  it('parses a macro with no metadata as citing nothing, so the check above would fail it (control)', () => {
    const [m] = macrosOf('### M99 — Test\n\n> a reply\n');
    expect(m.articles).toEqual([]);
    expect(m.docs).toEqual([]);
  });
});

describe('docs/support: claims discipline across all pages', () => {
  // The severity page states the ticket targets, with their register status; every other page is silent on numbers.
  const NUMBERS_ALLOWED = new Set(['docs/support/internal/severity-and-routing.md', 'docs/support/internal/macro-library.md']);

  it('promises no response time, hours or guarantee outside the page that explains the targets', () => {
    for (const p of PAGES.filter((f) => !NUMBERS_ALLOWED.has(f))) expect(timePromisesIn(withoutLabels(read(p))), p).toEqual([]);
  });

  it('never claims Semester is secure, compliant, certified or safe', () => {
    for (const p of PAGES) expect(visible(read(p)).match(ASSURES), p).toBeNull();
    expect('Semester is fully FERPA compliant.').toMatch(ASSURES);
    expect('The app is secure.').toMatch(ASSURES);
    expect('Your data is safe.').toMatch(ASSURES);
    // The app’s own words are quoted, not claimed: "it is safe to repeat" is a UI sentence about pressing a button twice.
    expect('Press it again — it is safe to repeat.').not.toMatch(ASSURES);
    expect('Semester does not claim to be compliant.').not.toMatch(ASSURES);
  });

  it('states the register’s answer on response time on the pages that talk about staffing', () => {
    for (const p of ['docs/support/README.md', 'docs/support/internal/triage-guide.md', 'docs/support/internal/severity-and-routing.md']) {
      expect(read(p), p).toMatch(/no committed response time|no response time is committed/i);
    }
  });

  it('contains no email address, no person’s name and no private host', () => {
    const personal = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}|Harrison|Rubin|supabase\.co|vercel\.app/;
    for (const p of PAGES) expect(visible(read(p)).match(personal), p).toBeNull();
    expect('write to someone@example.edu').toMatch(personal);
    expect('the live app is at https://harrisonjrubin7-cmyk.github.io/semester/').not.toMatch(personal);
  });
});

describe('docs/support: staffing equals the seat register', () => {
  const page = read('docs/support/internal/severity-and-routing.md');

  it('lists every seat with the holder the register names', () => {
    const rows = seatRows(page);
    expect(rows.map(([s]) => s)).toEqual([...SEATS]);
    expect(seatProblems(rows, COUNCIL)).toEqual([]);
  });

  it('says in the index who holds the support seat', () => {
    const success = COUNCIL.find((c) => c.seat === 'success');
    expect(success?.holder).toBe('Founder, acting');
    expect(read('docs/support/README.md')).toContain('`success`) is held by "Founder, acting"');
  });

  it('detects a changed holder, a missing seat and an invented seat (controls)', () => {
    const rows = seatRows(page);
    const changed: [string, string][] = rows.map(([s, h]) => (s === 'trust' ? [s, 'Somebody'] : [s, h]));
    expect(seatProblems(changed, COUNCIL)).toEqual(['seat trust: the table says "Somebody", the register says "vacant"']);
    expect(seatProblems(rows.slice(1), COUNCIL)).toEqual(['seat founder is not in the table']);
    expect(seatProblems([...rows, ['wizard', 'vacant']], COUNCIL)).toEqual(['seat wizard is not in the register']);
    expect(seatRows('no markers')).toEqual([]);
  });
});

describe('docs/support: what a supporter may see equals the migrations and the client', () => {
  const access = read('docs/support/internal/supporter-access.md');
  const sqlWindow = read('supabase/migrations/20260925103000_support_access.sql');
  const sqlUi = read('supabase/migrations/20260925160000_support_access_ui.sql');
  const sqlTickets = read('supabase/migrations/20260928210000_support_tickets.sql');

  /** The longest window the table allows, in days. */
  const windowDays = (sql: string): number | null => {
    const m = /expires_at <= created_at \+ interval '(\d+) days'/.exec(sql);
    return m ? Number(m[1]) : null;
  };

  it('states the window the table enforces: one to seven days', () => {
    expect(windowDays(sqlWindow)).toBe(7);
    expect(sqlUi).toContain('want_days > 7');
    expect(sqlUi).toContain('Support access must last between one and seven days.');
    expect(access).toContain("`interval '7 days'`");
    expect(access).toContain('one to seven days');
    expect(access).toContain('Support access must last between one and seven days.');
  });

  it('states the scope, the policy version and who may revoke', () => {
    expect(sqlWindow).toContain("scopes <@ array['learning-progress']::text[]");
    expect(sqlUi).toContain("'support-access-v1/'");
    expect(sqlUi).toContain('Only the student who created this access can revoke it.');
    expect(sqlUi).toContain("'That account is not a verified supporter for your university.'");
    for (const sentence of ['`learning-progress`', '`support-access-v1`', 'Only the student who created this access can revoke it.', 'That account is not a verified supporter for your university.']) {
      expect(access, sentence).toContain(sentence);
    }
  });

  it('lists the six context keys the client and the database accept', () => {
    const rows = [...access.matchAll(/^\| `([a-z_]+)` \| [^|]+ \|$/gm)].map((m) => m[1]).filter((k) => (CONTEXT_KEYS as readonly string[]).includes(k));
    expect(rows).toEqual([...CONTEXT_KEYS]);
    for (const k of CONTEXT_KEYS) expect(sqlTickets, k).toContain(`'${k}'`);
  });

  it('states the ticket limits the database enforces', () => {
    expect(sqlTickets).toContain("when 'accessibility' then 24 when 'privacy' then 24 else 72");
    expect(firstResponseHours('accessibility')).toBe(24);
    expect(firstResponseHours('privacy')).toBe(24);
    expect(firstResponseHours('other')).toBe(72);
    expect(sqlTickets).toContain(">= 5 then");
    expect(access).toContain('Five tickets per account per day');
    const severity = read('docs/support/internal/severity-and-routing.md');
    expect(severity).toContain('24 hours for accessibility and privacy, 72 for the rest');
    expect(Object.keys(CATEGORY_LABELS)).toContain('accessibility');
  });

  it('would notice a changed window (control)', () => {
    expect(windowDays(sqlWindow.replace("interval '7 days'", "interval '30 days'"))).toBe(30);
    expect(windowDays('no constraint')).toBeNull();
  });
});

describe('docs/support: the facts articles lean on have not moved', () => {
  it('billing: new individual checkout is held, and the article says so', () => {
    const plans = read('app/src/lib/plans.ts');
    expect(plans).toContain('export const INDIVIDUAL_PAID_ACQUISITION_ENABLED = false;');
    const billing = read('docs/support/articles/billing.md');
    expect(billing).toContain('`INDIVIDUAL_PAID_ACQUISITION_ENABLED` is `false`');
    expect(billing).toContain('IMPLEMENTED_NOT_RELEASED for new purchases');
    expect(existsSync(join(root, 'docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md'))).toBe(true);
    // The control: a flipped flag would no longer match what the article says.
    expect(plans.replace('= false;', '= true;')).not.toContain('INDIVIDUAL_PAID_ACQUISITION_ENABLED = false;');
  });

  it('read-only mode: the banner sentence quoted in two articles is the one the app shows', () => {
    const readOnly = read('app/src/lib/readonly.ts');
    const sentence = 'Read-only mode: your changes stay on this device until it ends.';
    expect(readOnly).toContain(sentence);
    for (const a of ['cannot-sign-in', 'sync-waiting-or-conflict']) expect(read(`docs/support/articles/${a}.md`)).toContain(sentence);
  });

  it('tickets are off by default, as the pages say', () => {
    expect(read('app/src/lib/experience-flags.ts')).toContain("supportTickets: featureState(env, 'VITE_SUPPORT_TICKETS', false)");
    expect(read('docs/support/internal/supporter-access.md')).toContain('off by default');
  });

  it('subscribed calendars are read only by Subscribe and REFRESH, as the article says', () => {
    const callers = walk('app/src', (p) => /\.(ts|tsx)$/.test(p) && !/\.test\./.test(p))
      .filter((p) => /\bfetchCalendar\(/.test(read(p)) && !p.endsWith('lib/feedlink.ts'));
    expect(callers).toEqual(['app/src/screens/Connect.tsx']);
    expect((read('app/src/screens/Connect.tsx').match(/await fetchCalendar\(/g) ?? []).length).toBe(2);
  });
});

describe('docs/support: rejects a page that drifts (end-to-end control)', () => {
  it('fails a copy of a real article with an invented label and a promise', () => {
    const real = read('docs/support/articles/cannot-sign-in.md');
    const broken = real.replace('"Sign in",', '"Press the purple button",').replace('Support cannot see', 'Support replies within 2 hours and cannot see');
    expect(missing(labelsOf(broken) ?? [], corpus())).toEqual(['Press the purple button']);
    expect(timePromisesIn(withoutLabels(broken))).toContain('a response time');
    expect(timePromisesIn(withoutLabels(real))).toEqual([]);
    // A quoted interface sentence is read around, not counted as a promise (control).
    const billing = read('docs/support/articles/billing.md');
    expect(timePromisesIn(visible(billing))).toContain('a response time');
    expect(timePromisesIn(withoutLabels(billing))).toEqual([]);
    expect(existsSync(join(root, THIS_TEST))).toBe(true);
  });
});
