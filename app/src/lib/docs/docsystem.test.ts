import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUDIENCES, FILLER, GOVERNED_DIRS, GOVERNED_FILES, TYPES, REVIEW_DAYS,
  governedPages, headingSlugs, isTemplatePage, parseCard, read, relativeLinks,
} from './card.ts';

/**
 * The documentation system's gate (`docs/documentation/QUALITY-GATES.md`).
 *
 * Every Markdown file in a governed directory (`GOVERNED_DIRS`) or named in
 * `GOVERNED_FILES` is held to the same rules, so a new page cannot opt out by
 * being put somewhere new, and an existing page elsewhere in `docs/` is not
 * disturbed — D-002: nothing is moved, renumbered or deleted.
 *
 * The rules are the ones `docs/documentation/README.md` states:
 *
 *   1. the first three lines are `# Title`, a blank line, and a valid card;
 *   2. a `reference` is `generated` or `held`, never merely `reviewed`;
 *   3. a page that says a test holds it names a file that exists, and that
 *      file mentions the page (or the directory the page is in) — a test that
 *      never mentions a page cannot be holding it;
 *   4. every relative link and `#fragment` resolves;
 *   5. every page is reachable from `docs/README.md` — a page nobody can find
 *      is not documentation;
 *   6. no marketing filler, and no unqualified compliance claim;
 *   7. a `generated` page says what rendered it.
 *
 * Nothing here reads the clock. Staleness is `npm run docs:stale`'s report,
 * because a test that goes red when the calendar moves guards nothing.
 */

const root = join(import.meta.dirname, '../../../..');
const pages = governedPages(root);
const text = new Map(pages.map((p) => [p, read(root, p)]));

// ── Probes, exported to the controls below ─────────────────────────────────

/** Prose with fences, inline code, link targets and the card removed — what a reader reads. */
function prose(page: string): string {
  return page
    .split('\n').filter((l, i) => !(i === 2 && l.startsWith('> **Type:**'))).join('\n')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/\]\([^)]*\)/g, ']');
}

function filler(page: string): string[] {
  const p = prose(page).toLowerCase();
  return FILLER.filter((w) => new RegExp(`(?<![\\w-])${w.replace(/-/g, '\\-')}(?![\\w-])`).test(p));
}

/**
 * A claim a page may not make. A sentence that says what the product *is not*
 * or *does not yet have* — "not SOC 2 certified" — states the absence, which
 * is the honest version, so a sentence carrying a negation or a hedge passes.
 */
const CLAIM = [
  /\b(?:FERPA|COPPA|GDPR|CCPA|HIPAA|SOC ?2|ISO ?27001|WCAG(?: 2\.[0-2])?(?: AA)?|Section 508)[- ]?(?:compliant|certified|conformant|conforming)\b/i,
  /\bSOC ?2(?: Type (?:I|II|1|2))? (?:report|audit|attestation)\b/i,
  /\b(?:military|bank)-grade\b/i,
  /\b(?:100% (?:secure|safe)|unhackable|breach-proof|zero risk)\b/i,
  /\b(?:fully|completely) (?:secure|compliant|private)\b/i,
  /\bwe (?:guarantee|ensure) (?:your )?(?:data|privacy|security)\b/i,
];
const HEDGE = /\b(?:not|no|never|neither|nor|without|isn['’]t|aren['’]t|doesn['’]t|hasn['’]t|haven['’]t|cannot|can['’]t|pending|planned|until|before|unless|if|would|should|must|may|might|whether|claims? register|counsel)\b|\?/i;

function claims(page: string): string[] {
  // A sentence wraps across lines in Markdown, so units are paragraphs (and single table rows), not lines.
  const units: string[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) units.push(para.join(' ')); para = []; };
  for (const line of prose(page).split('\n')) {
    if (line.trim() === '') flush();
    else if (line.trimStart().startsWith('|')) { flush(); units.push(line); }
    else para.push(line.trim());
  }
  flush();
  return units.flatMap((u) => u.split(/(?<=[.!?])\s+/)).filter((s) => CLAIM.some((c) => c.test(s)) && !HEDGE.test(s));
}

/** Dead relative links and dead fragments, as `page → target`. */
function deadLinks(file: string, body: string, exists: (p: string) => boolean, slugsOf: (p: string) => Set<string> | null): string[] {
  const dead: string[] = [];
  for (const { target, path, fragment } of relativeLinks(body)) {
    const resolved = path === '' ? file : normalize(join(dirname(file), decodeURI(path)));
    if (!exists(resolved)) { dead.push(`${file} → ${target}`); continue; }
    if (fragment && resolved.endsWith('.md')) {
      const slugs = slugsOf(resolved);
      if (slugs && !slugs.has(decodeURI(fragment).toLowerCase())) dead.push(`${file} → ${target} (no such heading)`);
    }
  }
  return dead;
}

/** Pages not reachable from `start` by following links between governed pages. */
function unreachable(start: string, all: string[], bodyOf: (p: string) => string, exists: (p: string) => boolean): string[] {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift() as string;
    for (const { path } of relativeLinks(bodyOf(cur))) {
      if (path === '') continue;
      const resolved = normalize(join(dirname(cur), decodeURI(path)));
      const candidates = resolved.endsWith('.md') ? [resolved] : [`${resolved}/README.md`, `${resolved}/INDEX.md`];
      for (const c of candidates) {
        if (all.includes(c) && exists(c) && !seen.has(c)) { seen.add(c); queue.push(c); }
      }
    }
  }
  return all.filter((p) => !seen.has(p));
}

// ── The set under test ────────────────────────────────────────────────────

describe('the governed set', () => {
  it('is found — the control for every check below', () => {
    // The charter itself is governed; if discovery broke, nothing below would be checked.
    expect(pages).toContain('docs/documentation/README.md');
    expect(pages).toContain('docs/documentation/QUALITY-GATES.md');
    expect(pages).toContain('docs/audit/CURRENT_STATE.md');
    expect(pages).toContain('docs/audit/ROLE_AND_SCREEN_GAP_ANALYSIS.md');
    expect(pages).toContain('docs/audit/SYSTEM_AND_WORKFLOW_GAP_ANALYSIS.md');
    expect(pages).toContain('docs/roadmap/P0-P3-IMPLEMENTATION_PLAN.md');
    expect(pages.length).toBeGreaterThanOrEqual(8);
    for (const d of GOVERNED_DIRS) expect(d.startsWith('/')).toBe(false);
    for (const f of GOVERNED_FILES) expect(f.endsWith('.md')).toBe(true);
  });

  it('lists, in the style guide, every word the gate bans', () => {
    const guide = text.get('docs/documentation/STYLE-GUIDE.md') as string;
    for (const w of FILLER) expect(guide, `\`${w}\` is banned by the gate and missing from the style guide`).toContain(`\`${w}\``);
  });

  it('keeps the vocabulary the charter documents', () => {
    const charter = text.get('docs/documentation/README.md') as string;
    for (const t of TYPES) expect(charter, `type ${t}`).toContain(`\`${t}\``);
    for (const a of AUDIENCES) expect(charter, `audience ${a}`).toContain(`\`${a}\``);
    for (const t of TYPES) expect(REVIEW_DAYS[t], t).toBeGreaterThan(0);
  });
});

describe('every governed page', () => {
  it('opens with a title, a blank line and a valid card', () => {
    const bad = pages.flatMap((p) => parseCard(text.get(p) as string).problems.map((x) => `${p}: ${x}`));
    expect(bad).toEqual([]);
  });

  it('puts words before headings: something sits between the card and the first section', () => {
    const bad = pages.filter((p) => {
      const rest = (text.get(p) as string).split('\n').slice(3).find((l) => l.trim() !== '');
      return !rest || rest.startsWith('#');
    });
    expect(bad).toEqual([]);
  });

  it('is a `reference` only if something holds it', () => {
    const bad = pages.filter((p) => {
      const { card } = parseCard(text.get(p) as string);
      return !isTemplatePage(p) && card?.type === 'reference' && card.truth === 'reviewed';
    });
    expect(bad, 'a reference that is only "reviewed" is a failed gate').toEqual([]);
  });

  it('names the file that holds it, and that file mentions it', () => {
    const bad: string[] = [];
    for (const p of pages) {
      const { card } = parseCard(text.get(p) as string);
      // A template's holder is a placeholder by design; its card is still parsed above.
      if (!card || (isTemplatePage(p) && p !== 'docs/documentation/templates/README.md')) continue;
      if (card.truth === 'reviewed') {
        if (card.heldBy) bad.push(`${p}: is "reviewed" but names a holder; if a test holds it, say "held"`);
        continue;
      }
      if (!card.heldBy) { bad.push(`${p}: is "${card.truth}" but has no Held by`); continue; }
      const holder = join(root, card.heldBy);
      if (!existsSync(holder) || !statSync(holder).isFile()) { bad.push(`${p}: Held by ${card.heldBy} does not exist`); continue; }
      const src = readFileSync(holder, 'utf8');
      const segments = p.split('/');
      const ancestors = [p, ...segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).join('/'))]
        .filter((a) => a === p || a.split('/').length >= 2 || a === 'examples');
      if (!ancestors.some((a) => src.includes(a))) bad.push(`${p}: ${card.heldBy} never mentions the page or its directory`);
    }
    expect(bad).toEqual([]);
  });

  it('says what rendered it, if it is generated', () => {
    const bad = pages.filter((p) => {
      const { card } = parseCard(text.get(p) as string);
      return !isTemplatePage(p) && card?.truth === 'generated' && !/<!-- Rendered from [^>]+ by [^>]+ -->/.test(text.get(p) as string);
    });
    expect(bad).toEqual([]);
  });

  it('links only to things that exist, headings included', () => {
    const slugCache = new Map<string, Set<string>>();
    const slugsOf = (p: string) => {
      if (!existsSync(join(root, p))) return null;
      if (!slugCache.has(p)) slugCache.set(p, headingSlugs(readFileSync(join(root, p), 'utf8')));
      return slugCache.get(p) as Set<string>;
    };
    const dead = pages.flatMap((p) => deadLinks(p, text.get(p) as string, (t) => existsSync(join(root, t)), slugsOf));
    expect(dead).toEqual([]);
  });

  it('can be found from the front door', () => {
    const body = (p: string) => (text.get(p) ?? (existsSync(join(root, p)) ? read(root, p) : '')) as string;
    const lost = unreachable('docs/README.md', pages.filter((p) => !isTemplatePage(p) && p !== 'docs/README.md'), body, (p) => existsSync(join(root, p)));
    expect(lost, 'link each page from docs/README.md or a page it links to; INDEX.md is generated and lists them all').toEqual([]);
  });

  it('is indexed: every reference page and every guides folder is linked from its own README', () => {
    const linked = (readme: string) => new Set(relativeLinks(read(root, readme)).map((l) => normalize(join(dirname(readme), l.path))));
    const ref = linked('docs/reference/README.md');
    const missingRef = pages.filter((p) => /^docs\/reference\/[^/]+\.md$/.test(p) && p !== 'docs/reference/README.md' && !ref.has(p));
    expect(missingRef, 'link each reference page from docs/reference/README.md').toEqual([]);
    const guides = linked('docs/guides/README.md');
    const missingGuides = pages.filter((p) => /^docs\/guides\/[^/]+\/README\.md$/.test(p) && !guides.has(p));
    expect(missingGuides, 'link each guides folder from docs/guides/README.md').toEqual([]);
  });

  it('has a README in every governed folder, linked from the front door', () => {
    const front = new Set(relativeLinks(read(root, 'docs/README.md')).map((l) => normalize(join('docs', l.path))));
    for (const d of GOVERNED_DIRS.filter((x) => x !== 'docs/documentation')) {
      const readme = `${d}/README.md`;
      if (!existsSync(join(root, readme))) { expect.fail(`${readme} is missing`); }
      const asLinked = d === 'examples' ? 'examples/README.md' : readme;
      expect(front.has(asLinked) || front.has(normalize(join('docs', '..', asLinked))), `docs/README.md does not link ${asLinked}`).toBe(true);
    }
  });

  it('uses no filler words', () => {
    const bad = pages.map((p) => [p, filler(text.get(p) as string)] as const).filter(([, w]) => w.length).map(([p, w]) => `${p}: ${w.join(', ')}`);
    expect(bad).toEqual([]);
  });

  it('makes no unqualified compliance or security claim', () => {
    const bad = pages.flatMap((p) => claims(text.get(p) as string).map((s) => `${p}: ${s.trim().slice(0, 100)}`));
    expect(bad).toEqual([]);
  });
});

// ── Controls: each probe must see what it exists to see ────────────────────

describe('the probes, against inputs that must fail and inputs that must pass', () => {
  const good = '# T\n\n> **Type:** how-to · **Audience:** students · **Owner:** `product` · **Truth:** reviewed · **Reviewed:** 2026-10-04 · **Held by:** —\n\nWhat this is for.\n';

  it('parseCard accepts a good card and reads it', () => {
    const { card, problems } = parseCard(good);
    expect(problems).toEqual([]);
    expect(card).toMatchObject({ type: 'how-to', owner: 'product', truth: 'reviewed', heldBy: null, audience: ['students'] });
  });

  it('parseCard names each way a card can be wrong', () => {
    const cases: [string, string][] = [
      [good.replace('how-to', 'guide'), 'type "guide"'],
      [good.replace('`product`', '`harrison`'), 'not a council seat'],
      [good.replace('students', 'everyone'), 'audience "everyone"'],
      [good.replace('2026-10-04', '04/10/2026'), 'not a YYYY-MM-DD'],
      [good.replace('reviewed ·', 'maybe ·'), 'truth "maybe"'],
      [good.replace(' · **Held by:** —', ''), 'no held by'],
      [good.replace('\n\n>', '\n>'), 'line 2 is not blank'],
      [good.replace('> **Type:**', 'Type:'), 'line 3 is not the card'],
    ];
    for (const [input, want] of cases) expect(parseCard(input).problems.join(' | '), want).toContain(want);
  });

  it('filler sees filler in prose and ignores it in code, labels and other words', () => {
    expect(filler(good + 'You can simply press Save.')).toEqual(['simply']);
    expect(filler(good + 'This powerful, robust tool.')).toEqual(['powerful', 'robust']);
    expect(filler(good + 'Run `utilize()` now.\n\n```ts\nsimply()\n```\n')).toEqual([]);
    expect(filler(good + 'Robustness testing and a simplyfied name are different words.')).toEqual([]);
  });

  it('claims sees an unqualified claim and passes a stated absence', () => {
    expect(claims(good + 'Semester is FERPA compliant.')).toHaveLength(1);
    expect(claims(good + 'We offer bank-grade encryption.')).toHaveLength(1);
    expect(claims(good + 'Semester is not SOC 2 certified.')).toEqual([]);
    expect(claims(good + 'No claim of FERPA compliance is made until counsel has reviewed it.')).toEqual([]);
    expect(claims(good + 'Row-level security separates one account from another.')).toEqual([]);
    // A question asks; it does not claim. The reviewer-question map quotes "Are you FERPA compliant?" verbatim.
    expect(claims(good + '| Q24 | Are you FERPA compliant, and will you act as a school official? |\n')).toEqual([]);
    // A sentence wrapped across lines is one sentence: the hedge on the first line covers the second.
    expect(claims(good + 'The product is not\nSOC 2 certified.')).toEqual([]);
    expect(claims(good + 'The product is\nFERPA compliant.')).toHaveLength(1);
    // A table row is its own unit; a hedge in the row above does not rescue it.
    expect(claims(good + '| a | not this |\n| b | bank-grade |\n')).toHaveLength(1);
  });

  it('deadLinks sees a missing file and a missing heading, and passes real ones', () => {
    const files = new Set(['a/x.md', 'a/y.md']);
    const slugs = (p: string) => (p === 'a/y.md' ? headingSlugs('# Y\n\n## The part\n') : null);
    const body = '[ok](y.md) [ok2](y.md#the-part) [gone](z.md) [bad](y.md#nope) [here](#top) `[code](q.md)`\n';
    // `[here](#top)` is a link to the page itself and `[code](q.md)` is in a code span: neither is reported.
    expect(deadLinks('a/x.md', body, (p) => files.has(p), slugs)).toEqual(['a/x.md → z.md', 'a/x.md → y.md#nope (no such heading)']);
  });

  it('unreachable finds an orphan and not a page two hops away', () => {
    const bodies: Record<string, string> = {
      'docs/README.md': '[a](a.md)', 'docs/a.md': '[b](sub/b.md)', 'docs/sub/b.md': '[up](../README.md)', 'docs/orphan.md': 'nobody links here',
    };
    const all = Object.keys(bodies).filter((p) => p !== 'docs/README.md');
    expect(unreachable('docs/README.md', all, (p) => bodies[p] ?? '', (p) => p in bodies)).toEqual(['docs/orphan.md']);
  });
});
