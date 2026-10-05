import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN } from './institution-ops';

/**
 * The two launch-readiness Phase 5 documents, held to the repository.
 *
 * `docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md` carries the SLO register;
 * a register that names a probe which does not exist, or says MEASURED with no
 * history filed, is the page a procurement reviewer would quote back to us.
 * `docs/PRODUCT-ANALYTICS-DATA-ETHICS.md` repeats the never-measure list and
 * promises no third-party analytics; both are checked against the code.
 */

const root = join(import.meta.dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const support = read('docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md');
const ethics = read('docs/PRODUCT-ANALYTICS-DATA-ETHICS.md');

const STATUSES = ['MEASURED', 'PROBED', 'UNPROBED'] as const;

interface Slo { id: string; probe: string; status: string; evidence: string }

function register(text: string): Slo[] {
  return text
    .split('\n')
    .filter((l) => /^\| SLO-\d+ \|/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .map(([id, , , probe, status, evidence]) => ({ id, probe, status, evidence }));
}

/** Backticked repository paths in a cell — anything with a slash and an extension. */
const paths = (cell: string) => [...cell.matchAll(/`([\w./-]+\/[\w.-]+\.\w+)`/g)].map((m) => m[1]);

function problems(slos: Slo[]): string[] {
  const out: string[] = [];
  for (const s of slos) {
    if (!(STATUSES as readonly string[]).includes(s.status)) out.push(`${s.id}: status ${s.status}`);
    if (paths(s.probe).length === 0) out.push(`${s.id}: names no probe file`);
    for (const p of paths(s.probe)) if (!existsSync(join(root, p))) out.push(`${s.id}: ${p} does not exist`);
    if (s.status === 'MEASURED') {
      const filed = paths(s.evidence).filter((p) => p.startsWith('docs/evidence/') && existsSync(join(root, p)));
      if (filed.length === 0) out.push(`${s.id}: MEASURED with no filed evidence`);
    }
  }
  return out;
}

describe('the SLO register', () => {
  const slos = register(support);

  it('reads six objectives, one per line', () => {
    expect(slos.map((s) => s.id)).toEqual(['SLO-1', 'SLO-2', 'SLO-3', 'SLO-4', 'SLO-5', 'SLO-6']);
  });

  it('names a real probe for each, and claims MEASURED only with a history filed', () => {
    expect(problems(slos)).toEqual([]);
  });

  it('would notice a missing probe, a made-up status and an unfiled MEASURED (controls)', () => {
    const s = slos[0];
    expect(problems([{ ...s, probe: '`app/scripts/nope.mjs`' }]).join()).toMatch(/does not exist/);
    expect(problems([{ ...s, status: 'GREEN' }]).join()).toMatch(/status GREEN/);
    expect(problems([{ ...s, status: 'MEASURED', evidence: '—' }]).join()).toMatch(/no filed evidence/);
  });
});

describe('the analytics and data-ethics page', () => {
  it('lists every never-measure id the code refuses, and no other', () => {
    const listed = [...ethics.matchAll(/^\| `(\w+)` \|/gm)].map((m) => m[1]);
    expect(listed.sort()).toEqual(FORBIDDEN.map((f) => f.id).sort());
  });

  it('keeps analytics and session-replay vendors out of the CSP it promises about', () => {
    const csp = /connect-src 'self'([^"]*)"/.exec(read('app/index.html'))![1];
    // The control: the parse found the list the page talks about.
    expect(csp).toContain('https://*.supabase.co');
    const vendors = /google-analytics|googletagmanager|segment\.(io|com)|mixpanel|amplitude|posthog|hotjar|fullstory|heap(analytics)?\.|logrocket|clarity\.ms|plausible|matomo/i;
    expect(csp).not.toMatch(vendors);
    expect(`${csp} https://cdn.segment.com`).toMatch(vendors);
  });
});
