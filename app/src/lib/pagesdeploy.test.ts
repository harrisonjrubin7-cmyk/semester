import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * One workflow deploys the app to GitHub Pages: `pages.yml`.
 *
 * On 4 October 2026 two of GitHub's own starter workflows, `static.yml` and `jekyll-gh-pages.yml`, were
 * committed to `main` from the web interface. Both run on every push to `main` and both deploy to the
 * same `github-pages` environment as `pages.yml`. `static.yml` uploads the repository root (`path: '.'`)
 * as the site, and the last deployment wins: for a time the production origin served the repository's own
 * files and `/semester/` answered 404, while the real deploy reported success. Two deployers to one
 * environment is a race whose loser is the product, so this holds the number at one, and says who it is.
 *
 * It is a different rule from `supplychain.test.ts`, which holds *how* an Action is pinned; this holds
 * *who may publish*. See ADR-0012 (`docs/decisions/proposed/0012-*.md`).
 */

const root = join(import.meta.dirname, '../../..');
const dir = join(root, '.github/workflows');
const workflows = existsSync(dir) ? readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)) : [];
const text = (f: string) => readFileSync(join(dir, f), 'utf8');

/** The workflows that publish to GitHub Pages: those that run `actions/deploy-pages`. */
export const deployers = (files: Record<string, string>): string[] =>
  Object.keys(files).filter((f) => /^\s*(?:-\s+)?uses:\s*actions\/deploy-pages@/m.test(files[f]!)).sort();

describe('who may publish to GitHub Pages', () => {
  const files = Object.fromEntries(workflows.map((f) => [f, text(f)]));

  it('is pages.yml and nothing else', () => {
    expect(workflows.length).toBeGreaterThan(5);
    expect(deployers(files)).toEqual(['pages.yml']);
  });

  it('is not shared: nothing else names the github-pages environment', () => {
    const others = workflows.filter((f) => f !== 'pages.yml' && /environment:[\s\S]{0,60}github-pages/.test(files[f]!));
    expect(others).toEqual([]);
  });

  // The control: the checker is shown the fault that happened, so a rule that matches nothing cannot pass.
  it('sees a second deployer when there is one', () => {
    const fault = {
      'pages.yml': '      - uses: actions/deploy-pages@abc # v5\n',
      'static.yml': 'jobs:\n  deploy:\n    steps:\n      - name: Deploy to GitHub Pages\n        uses: actions/deploy-pages@v5\n',
      'ci.yml': '      - uses: actions/checkout@abc # v4\n',
    };
    expect(deployers(fault)).toEqual(['pages.yml', 'static.yml']);
    expect(deployers({ 'ci.yml': fault['ci.yml'] })).toEqual([]);
  });
});
