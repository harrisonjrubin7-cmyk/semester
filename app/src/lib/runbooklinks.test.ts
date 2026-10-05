import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The documents someone reads during an incident, a restore or a deploy link
 * to each other, and a dead link in one of those is found at the worst time.
 * This holds every relative link in them to a file that exists.
 *
 * Launch-readiness Phase 7 (documentation review). It is scoped rather than
 * repo-wide on purpose: across all 226 tracked Markdown files there were 261
 * dead relative links on 27 September, nearly all in generated reports and
 * archived plans that nobody follows in an emergency. In the operational set
 * below there were none, and this keeps it that way. Widening the set is the
 * next step, one directory at a time, fixing as it goes.
 */

const root = join(import.meta.dirname, '../../..');
const md = (dir: string) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.md')).map((f) => join(dir, f));

const OPERATIONAL = [
  'ROLLBACK.md', 'RESTORE.md', 'MONITORING.md', 'SECURITY.md', 'SECRETS.md', 'RETENTION.md',
  'REGRESSION-CHECKLIST.md', 'PILOT.md', 'README.md', 'SETUP.md', 'STAGING.md', 'MIGRATION-HISTORY.md', 'CLAUDE.md',
  'docs/RUNBOOKS.md', 'SEMESTER-OPERATING-SYSTEM.md',
  ...md('supabase'), ...md('docs/vanderbilt'), ...md('docs/market-readiness'),
];

/** Relative links that point nowhere. Code spans and fenced blocks are not links. */
function deadLinks(file: string, text: string, exists: (p: string) => boolean): string[] {
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const out: string[] = [];
  for (const m of prose.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|tel:|#)/.test(target)) continue;
    const path = target.split('#')[0];
    if (path && !exists(normalize(join(dirname(file), decodeURI(path))))) out.push(`${file} → ${target}`);
  }
  return out;
}

describe('the operational documents', () => {
  it('covers the runbooks it is meant to — the control for the check below', () => {
    expect(OPERATIONAL.length).toBeGreaterThanOrEqual(40);
    for (const f of ['ROLLBACK.md', 'RESTORE.md', 'supabase/DEPLOY.md', 'docs/vanderbilt/incident-routing.md']) expect(OPERATIONAL).toContain(f);
  });

  it('link only to files that exist', () => {
    const dead = OPERATIONAL.flatMap((f) => deadLinks(f, readFileSync(join(root, f), 'utf8'), (p) => existsSync(join(root, p))));
    expect(dead).toEqual([]);
  });

  it('would catch a dead link, and ignore one written inside code (controls)', () => {
    const none = () => false;
    expect(deadLinks('ROLLBACK.md', 'See [restore](RESTORE-OLD.md).', none)).toEqual(['ROLLBACK.md → RESTORE-OLD.md']);
    expect(deadLinks('README.md', 'Written as `[a link](x.md)`.', none)).toEqual([]);
    expect(deadLinks('README.md', '```\n[a](y.md)\n```', none)).toEqual([]);
    expect(deadLinks('README.md', '[site](https://x.edu) [top](#top)', none)).toEqual([]);
  });
});
