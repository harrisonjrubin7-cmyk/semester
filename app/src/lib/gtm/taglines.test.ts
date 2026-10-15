/**
 * The tagline decision memo says what the live site says. It is a decision aid,
 * so the one failure that matters is a memo whose facts have gone stale: a line
 * it calls live that has been removed, a line it quotes that no longer matches
 * the register, or a memo that has started reading like a decision.
 *
 * Three things are held: the six lines are the same words in the brand platform,
 * the memo and the copy register; each piece of evidence the memo cites is still
 * in the file it names; and the memo does not call itself decided.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const memo = read('docs/TAGLINE-DECISION-MEMO.md');
const platform = read('docs/BRAND-PLATFORM.md');
const copy = read('docs/gtm/BRAND-AND-MARKETING-STRATEGY.md');

/**
 * Plain text, for comparing a phrase against a file. Tags are stripped from HTML
 * only: in TSX the words can sit inside a JSX attribute (`lead="…"`), and
 * stripping `<…>` would delete them.
 */
const plain = (s: string, html = false): string =>
  (html ? s.replace(/<[^>]+>/g, ' ') : s)
    .replace(/&rsquo;|&#8217;|[‘’]/g, "'")
    .replace(/&ldquo;|&rdquo;|[“”]/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .toLowerCase();

/** The six lines as the brand platform writes them: `| T1 | **line** |`. */
function lines(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of platform.split('\n')) {
    const m = /^\| (T[1-6]) \| \*\*(.+?)\*\* \|/.exec(l);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const T = lines();

describe('the six lines', () => {
  it('are found in the brand platform', () => {
    expect(Object.keys(T).sort()).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
  });

  it('are the same words in the memo', () => {
    for (const [id, text] of Object.entries(T)) {
      const row = memo.split('\n').find((l) => l.startsWith(`| ${id} |`)) ?? '';
      expect(row.replace(/\*\*|~~/g, ''), `${id} in the memo`).toContain(text);
    }
  });

  it('are the same words in the copy register, M-37 to M-42', () => {
    const rows: Record<string, string> = { T1: 'M-37', T2: 'M-38', T3: 'M-39', T4: 'M-40', T5: 'M-41', T6: 'M-42' };
    for (const [id, m] of Object.entries(rows)) {
      const row = copy.split('\n').find((l) => l.startsWith(`| ${m} `)) ?? '';
      expect(row, `${m} exists`).not.toBe('');
      expect(row, `${m} carries ${id}`).toContain(`"${T[id]}"`);
    }
  });
});

describe('the memo', () => {
  it('cites evidence that is still in the file it names', () => {
    const section = memo.split(/^## 5\. Evidence/m)[1]?.split(/^## 6\. /m)[0] ?? '';
    let checked = 0;
    for (const line of section.split('\n')) {
      const m = /^\| `([^`]+)` \| "(.+)" \|$/.exec(line.trim());
      if (!m) continue;
      checked += 1;
      expect(plain(read(m[1]), m[1].endsWith('.html')), `"${m[2]}" in ${m[1]}`).toContain(plain(m[2]));
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });

  it('is a memo for decision, not a decision', () => {
    expect(memo).toContain('This is not a decision');
    expect(memo).toContain('Awaiting decision');
    expect(memo, 'it must not carry a decided date').not.toMatch(/\*\*Decided \d{4}-\d{2}-\d{2}\.\*\*/);
  });
});
