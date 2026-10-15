import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The ecosystem coverage matrix (`docs/master/SEMESTER_ECOSYSTEM_COVERAGE_MATRIX.md`)
 * is rendered by `docs/master/tools/ecosystem.py` from the catalogs and the
 * repo audit, and re-checks every evidence path against the tree as it goes.
 *
 * Two things can make it lie. Somebody edits an input — or deletes a file a
 * row cites — and does not re-render, so the committed matrix still says
 * `implemented` about a screen that has gone. That is the first test. Or the
 * renderer's parsing breaks and drops rows, which would read as a smaller,
 * tidier ecosystem; the second test holds its totals against the audit's own
 * summary table, which the renderer does not read.
 */

const root = resolve(import.meta.dirname, '../../../..');
const master = join(root, 'docs/master');

function auditTotals(section: string): number[] {
  const text = readFileSync(join(master, 'REPO_AUDIT.md'), 'utf8');
  const block = text.slice(text.indexOf(`## Summary — ${section}`));
  const total = block.split('\n').find((l) => l.startsWith('| **Total**'));
  if (!total) throw new Error(`No total row under ${section}`);
  return [...total.matchAll(/\*\*(\d+)\*\*/g)].map((m) => Number(m[1]));
}

function matrixTotals(inventory: string): Record<string, number> {
  const text = readFileSync(join(master, 'SEMESTER_ECOSYSTEM_COVERAGE_MATRIX.md'), 'utf8');
  const lines = text.split('\n');
  const header = lines.find((l) => l.startsWith('| Inventory |'));
  const row = lines.find((l) => l.startsWith(`| ${inventory} |`));
  if (!header || !row) throw new Error(`No totals row for ${inventory}`);
  const keys = header.split('|').map((c) => c.trim()).filter(Boolean);
  const vals = row.split('|').map((c) => c.trim()).filter(Boolean);
  return Object.fromEntries(keys.map((k, i) => [k, Number(vals[i])]));
}

describe('ecosystem coverage matrix', () => {
  it('is in step with its inputs and with the files its rows cite', () => {
    const out = execFileSync('python3', [join(master, 'tools/ecosystem.py'), '--check'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(out).toContain('up to date');
  });

  it('accounts for every audited workflow step and screen, by the audit’s own count', () => {
    for (const [section, inventory] of [
      ['workflow steps (319)', 'Workflow steps'],
      ['screens (589)', 'Screens'],
    ] as const) {
      const [exists, partial, missing, total] = auditTotals(section);
      const m = matrixTotals(inventory);
      expect(m.Total).toBe(total);
      // Re-judged rows may only move a row up the ladder, never lose one.
      expect(m.implemented + m.verified + m.deployed).toBeGreaterThanOrEqual(exists);
      expect(m.specified + m['in progress'] + m.implemented + m.verified + m.deployed).toBe(
        exists + partial + missing,
      );
    }
  });
});
