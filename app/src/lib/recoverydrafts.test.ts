import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KEEP_DAYS, type Drafts } from './draft';
import { DRAFT_HOMES, draftLine, draftRows } from './recoverydrafts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 30, 12);

describe('the drafts a device holds, as a list', () => {
  const drafts: Drafts = {
    'essay:out': { text: 'one two three', at: NOW - 2 * DAY },
    'solve:work': { text: 'newer draft here', at: NOW - 60_000 },
    'study-studio:guide:2026F:econ101': { text: 'a b', at: NOW - DAY },
    'mystery:field': { text: 'from a screen nobody listed', at: NOW - DAY },
  };

  it('lists newest first, and says which screen each belongs to', () => {
    const rows = draftRows(drafts, NOW);
    expect(rows.map((r) => r.key)).toEqual([
      'solve:work',
      'study-studio:guide:2026F:econ101',
      'mystery:field',
      'essay:out',
    ]);
    expect(rows.find((r) => r.key === 'essay:out')?.home).toBe('essay');
    expect(rows.find((r) => r.key === 'study-studio:guide:2026F:econ101')?.home).toBe('study');
  });

  it('keeps what follows the field, so a course-scoped draft says which course', () => {
    const row = draftRows(drafts, NOW).find((r) => r.key.startsWith('study-studio'))!;
    expect(row.about).toBe('2026F:econ101');
  });

  it('carries the whole text and a plain description, so it can be read without the screen', () => {
    const row = draftRows(drafts, NOW).find((r) => r.key === 'essay:out')!;
    expect(row.text).toBe('one two three');
    expect(row.what).toBe('An essay you were drafting');
  });

  it('does not pretend to know a screen it does not', () => {
    const row = draftRows(drafts, NOW).find((r) => r.key === 'mystery:field')!;
    expect(row.home).toBeNull();
    expect(row.what).toMatch(/does not know/);
  });

  it('counts words and the days left before the draft is dropped', () => {
    const essay = draftRows(drafts, NOW).find((r) => r.key === 'essay:out')!;
    expect(essay.words).toBe(3);
    expect(essay.daysLeft).toBe(KEEP_DAYS - 2);
  });

  it('leaves out one that has already expired, or is empty', () => {
    const rows = draftRows(
      {
        old: { text: 'gone', at: NOW - (KEEP_DAYS + 1) * DAY },
        blank: { text: '   ', at: NOW },
        edge: { text: 'still here', at: NOW - KEEP_DAYS * DAY },
      },
      NOW,
    );
    expect(rows.map((r) => r.key)).toEqual(['edge']);
    expect(rows[0].daysLeft).toBe(1);
  });

  it('is empty for no drafts', () => {
    expect(draftRows({}, NOW)).toEqual([]);
  });

  it('says a hand-over was not typed here', () => {
    const [row] = draftRows({ 'analyse:text': { text: 'a,b', at: NOW, from: 'Sent from Sheet' } }, NOW);
    expect(draftLine(row, 'just now')).toContain('filled in from another screen');
    expect(draftLine(row, 'just now')).not.toContain('last typed');
    expect(draftLine({ ...row, words: 1, daysLeft: 1, from: undefined }, '2 days ago')).toBe(
      '1 word · last typed 2 days ago · kept 1 more day',
    );
  });
});

// A screen that starts keeping drafts must be listed, or the one place that
// says what the device is holding will not mention it. The tree is read rather
// than trusted, the way the ledgers in `styles/` are.
describe('every screen that keeps a draft is listed', () => {
  const src = new URL('..', import.meta.url).pathname;
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.|\.d\.ts$/.test(e.name)) out.push(p);
    }
    return out;
  };

  const used = new Map<string, string>();
  for (const path of walk(src)) {
    if (path.endsWith('/lib/draft.ts') || path.endsWith('/lib/draft.hook.ts') || path.endsWith('/lib/recoverydrafts.ts')) continue;
    const text = readFileSync(path, 'utf8');
    for (const m of text.matchAll(/\b(?:useDraft|handOver|draftKey)\(\s*['"]([a-z0-9-]+)['"]/g)) {
      used.set(m[1], path.slice(src.length));
    }
  }

  it('reads the tree at all', () => {
    // A scan that finds nothing passes without checking anything.
    expect(used.size).toBeGreaterThanOrEqual(5);
  });

  it('has a home for each one', () => {
    const missing = [...used].filter(([key]) => !(key in DRAFT_HOMES)).map(([key, file]) => `${key} (${file})`);
    expect(missing, 'add the screen to DRAFT_HOMES in lib/recoverydrafts.ts').toEqual([]);
  });

  it('lists nothing that no screen keeps', () => {
    const stale = Object.keys(DRAFT_HOMES).filter((key) => !used.has(key));
    expect(stale, 'delete the entry: nothing writes that draft any more').toEqual([]);
  });
});
