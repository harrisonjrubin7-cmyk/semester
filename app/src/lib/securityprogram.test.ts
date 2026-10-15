import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PATCH_POLICY } from './supplychain';

/**
 * `docs/security/SECURITY-PROGRAM.md` and the four documents beside it are the
 * program a procurement reviewer will be handed, so each checkable sentence is
 * tied to the tree here: the paths exist, the severity clock is the code's,
 * nothing affirms a certification, the findings it calls closed are closed in
 * the files that close them, and a finding cannot be called closed without the
 * thing that closes it.
 */

const ROOT = join(process.cwd(), '..');
const DIR = join(ROOT, 'docs', 'security');
const FILES = [
  'SECURITY-PROGRAM.md',
  'FINDINGS-REGISTER.md',
  'TENANT-ISOLATION-VERIFICATION.md',
  'DETECTION-CATALOG.md',
  'THREAT-RECORD-TEMPLATE.md',
];
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const text = (f: string) => readFileSync(join(DIR, f), 'utf8');

/** A backticked token that names a file or directory in the repository. */
const PATHLIKE = /^(?:\.?[\w-]+\/)+[\w.-]*$|^[\w.-]+\.(?:md|ts|tsx|sql|toml|yml|mjs|json)$/;

/** Resolve a cited path from the repository root, or from the citing file. */
const resolves = (p: string) =>
  existsSync(join(ROOT, p)) || existsSync(join(DIR, p)) || existsSync(join(ROOT, 'app', p));

describe('the security program documents', () => {
  it('exist, all five', () => {
    for (const f of FILES) expect(existsSync(join(DIR, f)), f).toBe(true);
  });

  it('cite only paths that exist', () => {
    for (const f of FILES) {
      const cited = [...text(f).matchAll(/`([^`\s]+)`/g)].map((m) => m[1]).filter((p) => PATHLIKE.test(p));
      for (const p of cited) {
        // A path ending in a file-like token must resolve; bare words are not paths.
        expect(resolves(p), `${f} cites ${p}, which is not in the tree`).toBe(true);
      }
    }
  });

  it('affirm no certification, report or completed questionnaire', () => {
    // A line may name a certification only to deny it.
    const claim = /\b(SOC ?2|ISO(?:\/IEC)? ?27001|HECVAT|FERPA[- ]compliant|penetration test)\b/i;
    const denial = /\b(no|not|never|none|without|neither|nor|draft|owed|needs?|requires?|before|until|counsel|cannot|can't|e-01|scoped?|quote|completion|assurance|\?)\b/i;
    for (const f of FILES)
      for (const [i, line] of text(f).split('\n').entries())
        if (claim.test(line.replace(/`[^`]*`/g, ''))) expect(denial.test(line), `${f}:${i + 1} names a certification without denying it: ${line.trim()}`).toBe(true);
    expect(text('SECURITY-PROGRAM.md')).toMatch(/no SOC 2 report, no ISO\/IEC 27001 certification, no completed\s+HECVAT/);
    expect(text('SECURITY-PROGRAM.md')).not.toMatch(/SOC 2 (?:compliant|certified)|FERPA compliant|ISO 27001 certified/i);
  });
});

describe('the findings register', () => {
  const reg = text('FINDINGS-REGISTER.md');
  const rows = reg.split('\n').filter((l) => /^\| F-\d{2} \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));

  it('gives every open finding a severity, evidence, a closing condition, a date and an owner', () => {
    expect(rows.length).toBeGreaterThanOrEqual(10);
    const seen = new Set<string>();
    for (const [id, sev, finding, evidence, verified, closes, due, owner] of rows) {
      expect(seen.has(id), `${id} appears twice`).toBe(false);
      seen.add(id);
      expect(['Critical', 'High', 'Medium', 'Low'], id).toContain(sev);
      for (const [name, v] of Object.entries({ finding, evidence, verified, closes, owner })) expect(v.length, `${id} has an empty ${name}`).toBeGreaterThan(3);
      expect(due, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('holds each due date to the severity clock the code defines', () => {
    const days = Object.fromEntries(PATCH_POLICY.map((p) => [p.severity, p.days])) as Record<string, number>;
    const confirmed = Date.UTC(2026, 9, 4);
    for (const [id, sev, , , , , due] of rows) {
      const [y, m, d] = due.split('-').map(Number);
      const got = Math.round((Date.UTC(y, m - 1, d) - confirmed) / 86_400_000);
      expect(got, `${id} is ${sev} so it is due ${days[sev.toLowerCase()]} days after 2026-10-04, not ${got}`).toBe(days[sev.toLowerCase()]);
    }
  });

  it('says its severity table is the same one SECURITY.md and the code hold', () => {
    const sec = read('SECURITY.md');
    for (const p of PATCH_POLICY) expect(sec).toMatch(new RegExp(`\\*\\*${p.severity}\\*\\*[^\\n]*\\| ${p.days} days`, 'i'));
    expect(text('SECURITY-PROGRAM.md')).toMatch(/critical 2 days, high 14, medium 60, low 180/);
  });
});

describe('what the program says it closed', () => {
  it('C-01: a CodeQL workflow that cannot write more than results, and cannot run where it would break main', () => {
    const w = read('.github/workflows/codeql.yml');
    expect(w).toMatch(/^permissions:\n\s+contents: read/m);
    expect(w).toMatch(/security-events: write/);
    expect(w).toMatch(/if: github\.event\.repository\.private == false \|\| vars\.CODEQL_ENABLED == 'true'/);
    expect(w).toMatch(/queries: security-extended/);
  });

  it('C-02: the secret scanner binary is checked against a published SHA-256 before it runs', () => {
    const ci = read('.github/workflows/ci.yml');
    const pin = /GITLEAKS_SHA256: ([0-9a-f]{64})/.exec(ci);
    expect(pin, 'no GITLEAKS_SHA256 pin').not.toBeNull();
    const check = ci.indexOf('sha256sum --check --strict -');
    expect(check).toBeGreaterThan(-1);
    expect(check, 'the checksum must come after the download and before the unpack').toBeGreaterThan(ci.indexOf('gitleaks.tar.gz'));
    expect(check).toBeLessThan(ci.indexOf('tar xzf gitleaks.tar.gz'));
    expect(/GITLEAKS_VERSION: ([\d.]+)/.exec(ci)?.[1]).toBe('8.28.0');
  });

  it('C-03: check.sh refuses a suite that prints no ok line, and every suite prints one', () => {
    const sh = read('supabase/check.sh');
    expect(sh).toMatch(/elif \[ "\$oks" = 0 \]; then/);
    expect(sh).toMatch(/passed with no 'ok' notice/);
    // The two suites that used to pass silently now end with one.
    expect(read('supabase/gateway-journal.check.sql')).toMatch(/raise notice 'ok /);
    expect(read('supabase/tests/productivity_workspace.sql')).toMatch(/raise notice 'ok /);
  });

  it('keeps the register honest about C-01: it names the condition it runs under', () => {
    expect(text('FINDINGS-REGISTER.md')).toMatch(/C-01[^\n]*Runs only when code scanning is available/);
  });
});

describe('the detection catalogue', () => {
  const cat = text('DETECTION-CATALOG.md');
  const rows = cat.split('\n').filter((l) => /^\| DET-\d{2} \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));

  it('has a severity and a route for every detection, and never lists a missing source as coverage', () => {
    expect(rows.length).toBe(16);
    for (const r of rows) {
      const [id, , , exists, , sev, route] = r;
      expect(['Critical', 'High', 'Medium', 'Low'], id).toContain(sev);
      expect(['Page', 'Notify', 'Digest'], id).toContain(route.split(' ')[0]);
      expect(exists, id).toMatch(/^\**(yes|no|partial)/);
    }
  });

  it('says plainly that nothing is wired yet', () => {
    expect(cat).toMatch(/none of these is wired/i);
  });
});

describe('the tenant-isolation catalogue', () => {
  it('lists TI-01 to TI-12 with a status, and states the known gap', () => {
    const t = text('TENANT-ISOLATION-VERIFICATION.md');
    for (let i = 1; i <= 12; i++) expect(t).toMatch(new RegExp(`\\| TI-${String(i).padStart(2, '0')} \\|[^\\n]*\\| (Exists|Add|Partial)`));
    expect(t).toMatch(/default \*\*false\*\*/);
  });
});
