import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN, MIN_COHORT } from '../institution-ops';
import { HELPFUL_CAP, IMPORTANT_CAP } from '../notify';
import { optOutAlert } from './kpi';
import { DEFAULT_QUIET_HOURS, parseKeyword } from './messaging';
import { PILLARS } from './social';
import { SALES_STAGES } from './stages';

/**
 * `docs/market-readiness/GROWTH-OPERATING-PLAN.md`, held to the repository.
 *
 * The plan states, in prose, numbers the code enforces (daily caps, quiet
 * hours, the small-cell floor, the opt-out alert), the stages the sales code
 * defines, the pillars the social plan defines, and the claim IDs the claims
 * register defines. A plan that quotes a cap the code has since changed is the
 * page a reviewer would read back to us, so each of those is read out of the
 * source and compared. Where the plan says a guard is *not yet built*, nothing
 * here asserts that it is — see section 4.8 of the plan.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const PLAN_PATH = 'docs/market-readiness/GROWTH-OPERATING-PLAN.md';
const plan = read(PLAN_PATH);

/** Every tracked-looking file in the repository, so a bare `messaging.ts` can be resolved. */
function allFiles(dir = '', out: string[] = []): string[] {
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) allFiles(rel, out);
    else out.push(rel);
  }
  return out;
}
const FILES = allFiles();
const resolves = (token: string) => FILES.some((f) => f === token || f.endsWith(`/${token}`));

/** Backticked file names with a known extension; placeholders and globs are not paths. */
const FILE_TOKEN = /`([\w./,-]+\.(?:ts|tsx|md|json|sql|html))`/g;

/** Phrases that are a violation when affirmed, and fine inside a refusal. */
const AFFIRMATIONS = [
  /\bFERPA[- ]compliant\b/i,
  /\bWCAG[- ](?:2\.\d )?compliant\b/i,
  /\bSOC ?2 (?:certified|compliant)\b/i,
  /\bpenetration[- ]tested\b/i,
  /\bVanderbilt[- ]approved\b/i,
  /\benterprise[- ]ready\b/i,
  /\bproduction[- ]ready\b/i,
  /\bintegrated with your (?:SIS|LMS)\b/i,
  /\b24\/7 support\b/i,
];
const REFUSAL = /\b(prohibited|never|not|no|refus\w*|without|do not|don't|forbid\w*|held|hold)\b|CLM-\d{3}/i;

/** Lines where a prohibited claim is affirmed rather than refused. */
function affirmed(text: string): string[] {
  return text
    .split('\n')
    .filter((l) => AFFIRMATIONS.some((re) => re.test(l)) && !REFUSAL.test(l));
}

describe('the growth operating plan — what it cites exists', () => {
  it('names every file it points at', () => {
    const missing = [...plan.matchAll(FILE_TOKEN)]
      .flatMap((m) => m[1].split(','))
      .map((t) => t.trim())
      .filter((t) => !resolves(t));
    expect([...new Set(missing)]).toEqual([]);
  });

  it('links only to documents that exist', () => {
    const base = join(root, 'docs/market-readiness');
    const bad = [...plan.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)]
      .map((m) => m[1])
      .filter((href) => !/^[a-z]+:/i.test(href))
      .filter((href) => !existsSync(join(base, decodeURIComponent(href))));
    expect([...new Set(bad)]).toEqual([]);
  });

  it('cites only claim IDs that the claims register defines', () => {
    const register = read('PUBLIC-CLAIMS-APPROVAL-REGISTER.md');
    const defined = new Set([...register.matchAll(/^\| (CLM-\d{3}) \|/gm)].map((m) => m[1]));
    const cited = [...new Set([...plan.matchAll(/CLM-\d{3}/g)].map((m) => m[0]))];
    expect(defined.size).toBeGreaterThan(10);
    expect(cited.filter((c) => !defined.has(c))).toEqual([]);
  });
});

describe('the growth operating plan — the numbers it calls enforced are the code\'s', () => {
  it('quotes the in-app caps the notifier enforces', () => {
    expect(plan).toContain(`\`IMPORTANT_CAP = ${IMPORTANT_CAP}\``);
    expect(plan).toContain(`**${IMPORTANT_CAP} per day**`);
    expect(plan).toContain(`**${HELPFUL_CAP} per day**`);
  });

  it('quotes the SMS and push quiet hours the sender enforces', () => {
    const hh = (n: number) => String(n).padStart(2, '0');
    expect(plan).toContain(`${hh(DEFAULT_QUIET_HOURS.start)}:00–${hh(DEFAULT_QUIET_HOURS.end)}:00`);
  });

  it('quotes the small-cell floor', () => {
    expect(plan).toContain(`MIN_COHORT = ${MIN_COHORT}`);
  });

  it('quotes the opt-out alert at 0.1% of at least 1,000 delivered — and the code agrees', () => {
    expect(plan).toContain('**0.1%** of at least 1,000 delivered');
    expect(optOutAlert(2, 1000)).toBe(true);
    expect(optOutAlert(1, 1000)).toBe(false);
    expect(optOutAlert(50, 999)).toBe(false);
  });

  it('lists exactly the SMS keywords the parser treats as stop, and never "yes" as start', () => {
    const line = plan.split('\n').find((l) => l.includes('`STOPALL`')) ?? '';
    const stops = [...line.matchAll(/`([A-Z]+)`/g)].map((m) => m[1]).filter((w) => !['HELP', 'START', 'UNSTOP'].includes(w));
    expect(stops.length).toBeGreaterThanOrEqual(8);
    for (const w of stops) expect(parseKeyword(w), w).toBe('stop');
    expect(parseKeyword('START')).toBe('start');
    expect(parseKeyword('UNSTOP')).toBe('start');
    expect(parseKeyword('yes')).toBeNull();
  });

  it('repeats the never-collect list the institution code enforces', () => {
    for (const f of FORBIDDEN) expect(plan, f.id).toContain(`\`${f.id}\``);
  });
});

describe('the growth operating plan — it uses the repository\'s own vocabularies', () => {
  it('names only sales stages that exist, and there are sixteen', () => {
    expect(SALES_STAGES).toHaveLength(16);
    const used = ['target_account', 'discovery', 'qualified', 'multi_stakeholder_demo', 'technical_review',
      'security_privacy_accessibility_review', 'proposal', 'procurement_legal', 'contracted', 'implementation',
      'live', 'renewal', 'expansion'];
    for (const s of used) {
      expect(SALES_STAGES as readonly string[], s).toContain(s);
      expect(plan, s).toContain(`\`${s}\``);
    }
  });

  it('weights each content pillar once, and each column sums to 100%', () => {
    const rows = [...plan.matchAll(/^\| .*?\(`(\w+)`\) \| .*? \| (\d+)% \| (\d+)% \|/gm)];
    expect(rows.map((r) => r[1]).sort()).toEqual(PILLARS.map((p) => p.id).sort());
    expect(rows.reduce((n, r) => n + Number(r[2]), 0)).toBe(100);
    expect(rows.reduce((n, r) => n + Number(r[3]), 0)).toBe(100);
  });

  it('says the strongest capability status is the one the registry actually holds', () => {
    const reg = JSON.parse(read('docs/market-readiness/CAPABILITY-STATUS-REGISTRY.json')) as {
      allowedStatuses: string[];
      capabilities: { status: string }[];
    };
    const rank = (s: string) => reg.allowedStatuses.indexOf(s);
    const top = reg.capabilities.map((c) => c.status).sort((a, b) => rank(b) - rank(a))[0];
    expect(top).toBe('DESIGN_PARTNER');
    expect(plan).toContain('strongest capability status in');
    expect(plan).toContain('`DESIGN_PARTNER`');
  });
});

describe('the growth operating plan — it authorizes nothing the launch plan does not', () => {
  it('says no broad, paid or activation campaign is authorized, and the launch plan still agrees', () => {
    expect(plan).toContain('NO BROAD, PAID OR INSTITUTIONAL-ACTIVATION CAMPAIGN IS AUTHORIZED');
    expect(read('docs/commercial/LAUNCH-CAMPAIGN-PLAN.md')).toContain('BROAD/PAID LAUNCH NOT AUTHORIZED');
  });

  it('opens only G0 today', () => {
    expect(plan).toContain('**This is the only gate open today.**');
    expect(plan).toContain('**Not currently authorized.**');
  });

  it('affirms none of the prohibited claims', () => {
    expect(affirmed(plan)).toEqual([]);
  });

  it('would catch an affirmed claim, while letting a refusal through — the control', () => {
    expect(affirmed('Semester is FERPA compliant and production-ready.')).toHaveLength(1);
    expect(affirmed('We never say Semester is FERPA compliant.')).toEqual([]);
    expect(affirmed('Do not claim 24/7 support.')).toEqual([]);
  });
});
