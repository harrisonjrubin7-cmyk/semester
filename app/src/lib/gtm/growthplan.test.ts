import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN, MIN_COHORT } from '../institution-ops';
import { HELPFUL_CAP, IMPORTANT_CAP } from '../notify';
import { INDIVIDUAL_PAID_ACQUISITION_ENABLED } from '../plans';
import { optOutAlert } from './kpi';
import { DEFAULT_QUIET_HOURS } from './messaging';
import { SALES_STAGES } from './stages';

/**
 * `docs/gtm/GROWTH-OPERATING-PLAN.md`, held to the repository.
 *
 * The plan quotes the notification caps, the quiet-hour window and the
 * small-cell floor, cites claim ids, links to other pages and lists the things
 * Semester never measures. A page a reviewer quotes back to us must not have
 * drifted from the code or the register it cites.
 */

const root = join(import.meta.dirname, '../../../..');
const planPath = join(root, 'docs/gtm/GROWTH-OPERATING-PLAN.md');
const plan = readFileSync(planPath, 'utf8');
const claims = readFileSync(join(root, 'PUBLIC-CLAIMS-APPROVAL-REGISTER.md'), 'utf8');

/** `| NUM-1 | label | value | where |` rows, by id. */
function numbers(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (/^NUM-\d+$/.test(cells[0] ?? '')) out[cells[0]] = cells[2];
  }
  return out;
}

describe('the growth operating plan', () => {
  it('quotes the code, not its own opinion, for every held number', () => {
    expect(numbers(plan)).toEqual({
      'NUM-1': String(IMPORTANT_CAP),
      'NUM-2': String(HELPFUL_CAP),
      'NUM-3': String(DEFAULT_QUIET_HOURS.start),
      'NUM-4': String(DEFAULT_QUIET_HOURS.end),
      'NUM-5': String(MIN_COHORT),
    });
  });

  it('cites only claim ids that exist in the register', () => {
    const cited = new Set(plan.match(/CLM-\d{3}/g) ?? []);
    expect(cited.size).toBeGreaterThan(0);
    const missing = [...cited].filter((id) => !claims.includes(`| ${id} |`));
    expect(missing).toEqual([]);
  });

  it('links only to pages that exist', () => {
    const broken = [...plan.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)]
      .map((m) => m[1])
      .filter((href) => !/^[a-z]+:/.test(href))
      .filter((href) => !existsSync(resolve(dirname(planPath), href)));
    expect(broken).toEqual([]);
  });

  it('names every metric Semester refuses to collect', () => {
    const missing = FORBIDDEN.map((f) => f.id).filter((id) => !plan.includes(`\`${id}\``));
    expect(missing).toEqual([]);
  });

  it('quotes the sales stages in the order the code defines them', () => {
    const line = plan.split('\n').find((l) => l.includes('`target_account')) ?? '';
    const chain = (line.match(/`(target_account[^`]*)`/)?.[1] ?? '').split(/→|\|/).map((t) => t.trim());
    expect(chain).toEqual([...SALES_STAGES]);
  });

  it('states the paid-acquisition switch as the code holds it', () => {
    expect(plan).toContain(`\`INDIVIDUAL_PAID_ACQUISITION_ENABLED = ${INDIVIDUAL_PAID_ACQUISITION_ENABLED}\``);
  });

  it('quotes the opt-out alert threshold the code applies', () => {
    expect(plan).toContain('Opt-out alert above 0.1% of at least 1,000 delivered');
    expect(optOutAlert(2, 1000)).toBe(true);
    expect(optOutAlert(1, 1000)).toBe(false);
    expect(optOutAlert(50, 999)).toBe(false);
  });

  it('names only files that exist', () => {
    const all: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
        if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(e.name)) continue;
        const rel = dir ? `${dir}/${e.name}` : e.name;
        if (e.isDirectory()) walk(rel);
        else all.push(rel);
      }
    };
    walk('');
    const named = [...plan.matchAll(/`([\w./-]+\.(?:ts|tsx|md|json|sql))`/g)].map((m) => m[1]);
    const missing = [...new Set(named)].filter((t) => !all.some((f) => f === t || f.endsWith(`/${t}`)));
    expect(missing).toEqual([]);
  });
});
