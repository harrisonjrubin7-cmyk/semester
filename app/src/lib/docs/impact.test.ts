import { describe, expect, it } from 'vitest';
import { RULES, WAIVER, impact } from './impact.ts';
import { stale } from './stale.ts';

/**
 * `impact()` is what `npm run docs:impact` runs against a pull request. These
 * hold it from both sides: a change that owes a page and brings none is found,
 * and a change that brings one — or says why not — is let through. The second
 * half is the control: a probe that flags everything looks exactly like one
 * that works until somebody tries to merge.
 */

const gw = 'app/server/institution/gateway.ts';

describe('impact', () => {
  it('finds a gateway change that brings no page', () => {
    const v = impact([gw, 'app/server/institution/gateway.test.ts'], '');
    expect(v.ok).toBe(false);
    expect(v.findings.map((f) => f.rule)).toEqual(['gateway']);
    expect(v.findings[0].because).toEqual([gw]);
  });

  it('lets it through when a reference page moves with it', () => {
    expect(impact([gw, 'docs/reference/API-GATEWAY.md'], '').ok).toBe(true);
    expect(impact([gw, 'docs/decisions/D-1200.md'], '').ok).toBe(true);
  });

  it('does not fire on a test, a check or a fixture alone', () => {
    expect(impact(['app/server/institution/gateway.test.ts', 'supabase/functions/lti/x.test.ts', 'supabase/foo.check.sql'], '').ok).toBe(true);
  });

  it('fires per rule, so one page cannot answer for another area', () => {
    const v = impact([gw, 'supabase/functions/lti/index.ts', 'docs/reference/ERRORS.md'], '');
    // The reference directory satisfies both rules: the page that moved is in it.
    expect(v.ok).toBe(true);
    const w = impact(['app/src/screens/Today.tsx', 'supabase/functions/lti/index.ts', 'CHANGELOG.md'], '');
    expect(w.findings.map((f) => f.rule)).toEqual(['edge-functions']);
  });

  it('asks a screen change for the changelog, help or support — and accepts any one', () => {
    expect(impact(['app/src/screens/Today.tsx'], '').findings.map((f) => f.rule)).toEqual(['screens']);
    for (const page of ['CHANGELOG.md', 'docs/help/students/x.md', 'docs/support/articles/y.md']) {
      expect(impact(['app/src/screens/Today.tsx', page], '').ok, page).toBe(true);
    }
    expect(impact(['app/src/screens/Today.test.tsx'], '').ok).toBe(true);
  });

  it('asks a tooling change for the developer docs', () => {
    for (const p of ['app/package.json', 'app/scripts/golden-path.mjs', '.github/workflows/ci.yml', 'app/vite.config.ts', 'app/tsconfig.app.json']) {
      expect(impact([p], '').findings.map((f) => f.rule), p).toEqual(['tooling']);
    }
    expect(impact(['app/package.json', 'docs/developers/TESTING-GUIDE.md'], '').ok).toBe(true);
    expect(impact(['app/package-lock.json'], '').ok).toBe(true);
  });

  it('accepts a stated reason and records it', () => {
    const v = impact([gw], 'Fix a typo in a comment.\n\nDocs: none because only a comment changed\n');
    expect(v.ok).toBe(true);
    expect(v.waived).toBe('only a comment changed');
    expect(v.findings).toHaveLength(1);
  });

  it('does not accept a waiver with no reason, or one that is not on a line of its own', () => {
    expect(impact([gw], 'Docs: none because').ok).toBe(false);
    expect(impact([gw], 'Docs: none because x').ok).toBe(false);
    expect(impact([gw], 'I wrote "Docs: none because it is fine, honest" in passing').ok).toBe(false);
    expect(WAIVER.test('Docs: none because the behaviour is unchanged')).toBe(true);
  });

  it('is what OWNERSHIP-AND-REVIEW.md says: every rule, its paths and its pages', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(import.meta.dirname, '../../../..');
    const page = readFileSync(join(root, 'docs/documentation/OWNERSHIP-AND-REVIEW.md'), 'utf8');
    for (const r of RULES) {
      expect(page, `rule ${r.id}`).toContain(`\`${r.id}\``);
      for (const w of r.anyOf) {
        expect(page, `${r.id} → ${w}`).toContain(`\`${w}\``);
        // A named file must exist; a directory may be empty in a partial checkout but must be a directory path.
        if (w.endsWith('/')) expect(w.startsWith('/')).toBe(false);
        else expect(existsSync(join(root, w)), `${w} named by rule ${r.id}`).toBe(true);
      }
    }
    expect(page).toContain('Docs: none because');
  });
});

describe('stale', () => {
  const card = (type: string, reviewed: string) =>
    `# T\n\n> **Type:** ${type} · **Audience:** students · **Owner:** \`product\` · **Truth:** reviewed · **Reviewed:** ${reviewed} · **Held by:** —\n\nx\n`;
  const pages = new Map([
    ['docs/help/a.md', card('help', '2026-06-01')],        // 92d → due 2026-09-01; overdue on 2026-10-04
    ['docs/help/b.md', card('help', '2026-07-10')],        // due 2026-10-10: six days left
    ['docs/help/c.md', card('help', '2026-10-01')],        // fresh
    ['docs/help/d.md', card('help', '2026-12-01')],        // future
    ['docs/help/e.md', 'no card'],
    ['docs/documentation/templates/tutorial.md', card('tutorial', '2020-01-01')], // a template is never due
  ]);

  it('sorts pages into overdue, due soon, fresh, future and unreadable', () => {
    const r = stale(pages, '2026-10-04');
    expect(r.overdue.map((d) => [d.page, d.overdueDays])).toEqual([['docs/help/a.md', 33]]);
    expect(r.dueSoon.map((d) => d.page)).toEqual(['docs/help/b.md']);
    expect(r.future).toEqual([{ page: 'docs/help/d.md', reviewed: '2026-12-01' }]);
    expect(r.unparsed).toEqual(['docs/help/e.md']);
  });

  it('gives a different answer on a different day — the control that it reads its argument', () => {
    expect(stale(pages, '2026-06-02').overdue).toEqual([]);
    expect(stale(pages, '2027-06-01').overdue.length).toBe(4);
  });
});
