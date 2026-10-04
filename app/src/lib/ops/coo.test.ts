import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The COO operating system, `docs/operations/coo/`, held to the things it
 * says about itself.
 *
 * The set is prose, and prose rots in four ways a reader cannot see: a link
 * to a page that moved, an ID used in one place and defined in none, a RACI
 * row with two accountable seats or none, and a page that loses the sentence
 * saying its numbers are targets and not promises. Each is checked below, and
 * each check has a control, a fixture it must catch, because a scan that finds
 * nothing is also what a scan that looks for the wrong thing finds.
 *
 * Nothing here checks that a process operates. The pages say they are
 * proposed, and this test does not make them anything else.
 */

const root = join(import.meta.dirname, '../../../..');
const DIR = join(root, 'docs/operations/coo');
const pages = readdirSync(DIR).filter((n) => n.endsWith('.md')).sort();
const text = (name: string) => readFileSync(join(DIR, name), 'utf8');
const ALL = pages.map((n) => ({ name: n, body: text(n) }));

/** Lines outside a fenced code block, with their 1-based numbers. */
function prose(body: string): { n: number; line: string }[] {
  const out: { n: number; line: string }[] = [];
  let fenced = false;
  body.split('\n').forEach((line, i) => {
    if (line.startsWith('```')) fenced = !fenced;
    else if (!fenced) out.push({ n: i + 1, line });
  });
  return out;
}

/** GitHub's heading slug: lower case, punctuation dropped, spaces to hyphens. */
const slug = (heading: string) => heading.trim().toLowerCase().replace(/`/g, '').replace(/[^\w\- ]/gu, '').replace(/ /g, '-');

function anchorsOf(body: string): Set<string> {
  const set = new Set<string>();
  for (const { line } of prose(body)) {
    const m = /^#{1,6}\s+(.*)$/.exec(line);
    if (m) set.add(slug(m[1]));
  }
  return set;
}

type Resolver = { exists: (path: string) => boolean; anchors: (path: string) => Set<string> };

/** Every relative link in a page that points at nothing. */
export function linkProblems(from: string, body: string, r: Resolver): string[] {
  const problems: string[] = [];
  for (const { n, line } of prose(body)) {
    for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:)/.test(target)) continue;
      const [path, anchor] = target.split('#');
      const file = path ? normalize(join(dirname(from), path)) : from;
      if (!r.exists(file)) problems.push(`${from}:${n} links to ${target}, which does not exist`);
      else if (anchor && file.endsWith('.md') && !r.anchors(file).has(anchor)) problems.push(`${from}:${n} links to ${target}, which has no such heading`);
    }
  }
  return problems;
}

const real: Resolver = {
  exists: (p) => existsSync(p),
  anchors: (p) => anchorsOf(readFileSync(p, 'utf8')),
};

/** Rows of the RACI matrix that do not have exactly one accountable seat. */
export function raciProblems(body: string): string[] {
  const problems: string[] = [];
  const ROLES = 12;
  for (const { n, line } of prose(body)) {
    const m = /^\|\s*([CPISVMO]-\d\d)\s*\|/.exec(line);
    if (!m) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells.length !== 3 + ROLES + 1) {
      problems.push(`${m[1]} (line ${n}) has ${cells.length} cells, not ${3 + ROLES + 1}`);
      continue;
    }
    if (!['1', '2', '3', 'E'].includes(cells[2])) problems.push(`${m[1]} has decision class "${cells[2]}"`);
    const accountable = cells.slice(3, 3 + ROLES).filter((c) => c === 'A').length;
    if (accountable !== 1) problems.push(`${m[1]} has ${accountable} accountable seats`);
  }
  return problems;
}

/** IDs used somewhere that are defined nowhere. */
export function undefinedIds(defined: Set<string>, used: Iterable<string>): string[] {
  return [...new Set(used)].filter((id) => !defined.has(id)).sort();
}

/** Capture group 1 of every match, line by line, outside code fences. */
const ids = (body: string, re: RegExp) => {
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  return prose(body).flatMap(({ line }) => [...line.matchAll(global)].map((m) => m[1]));
};

describe('the COO operating system set', () => {
  it('is the pages it says it is', () => {
    expect(pages).toEqual([
      '01-operating-cadence.md',
      '02-implementation-methodology.md',
      '03-raci-and-decision-rights.md',
      '04-support-operating-model.md',
      '05-incident-and-continuity.md',
      '06-vendor-quality-change.md',
      '07-knowledge-training-enablement.md',
      '08-marketplace-partner-trust-fulfillment.md',
      '09-dashboards-and-indicators.md',
      '10-tenant-launch-risk-and-readiness.md',
      '11-founder-to-team-transition.md',
      'README.md',
      'handoffs.md',
      'service-blueprints.md',
      'templates.md',
    ]);
  });

  describe('links', () => {
    it('all resolve to a file and, where given, a heading', () => {
      const problems = ALL.flatMap(({ name, body }) => linkProblems(join(DIR, name), body, real));
      expect(problems).toEqual([]);
    });

    it('control: a link to a missing file or heading is caught', () => {
      const fake: Resolver = { exists: (p) => p.endsWith('here.md'), anchors: () => new Set(['real-heading']) };
      const body = '[ok](here.md#real-heading) [gone](gone.md) [bad anchor](here.md#nope) [web](https://example.org/x) [fenced]\n```\n[ignored](gone.md)\n```';
      expect(linkProblems(join(DIR, 'x.md'), body, fake)).toHaveLength(2);
    });
  });

  describe('each page says what it is', () => {
    it('opens with a control table that names its status, evidence date and claim ceiling', () => {
      for (const { name, body } of ALL) {
        const head = body.split('\n').slice(0, 14).join('\n');
        expect(head, `${name} has no Status row`).toMatch(/^\| Status \| \*\*[A-Z]/m);
        expect(head, `${name} has no Evidence date row`).toMatch(/^\| Evidence date \| \d{4}-\d{2}-\d{2} /m);
        expect(head, `${name} has no Claim ceiling row`).toMatch(/^\| Claim ceiling \| .+/m);
      }
    });

    it('says it is proposed or an operating design, never in force', () => {
      for (const { name, body } of ALL) {
        const status = /^\| Status \| (.+) \|$/m.exec(body)?.[1] ?? '';
        expect(status, `${name}: ${status}`).toMatch(/PROPOSED|NOT YET OPERATED|NOT BEEN EXERCISED|TEMPLATES ARE UNUSED/);
      }
    });

    it('holds no contact route, credential or customer-identifying value', () => {
      for (const { name, body } of ALL) {
        expect(body, `${name} has an email address`).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
        expect(body, `${name} has a long digit run`).not.toMatch(/\b\d{13,19}\b/);
        expect(body, `${name} has a key-shaped string`).not.toMatch(/\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/);
      }
    });
  });

  describe('the RACI', () => {
    const raci = text('03-raci-and-decision-rights.md');

    it('gives every decision exactly one accountable seat, twelve role cells and a class', () => {
      expect(raciProblems(raci)).toEqual([]);
    });

    it('holds the sixty-four decisions the index says it holds, each once', () => {
      const found = ids(raci, /^\|\s*([CPISVMO]-\d\d)\s*\|/);
      expect(found).toHaveLength(64);
      expect(new Set(found).size).toBe(64);
      expect(text('README.md')).toContain('sixty-four decisions');
    });

    it('control: a row with two accountable seats, or none, is caught', () => {
      const row = (cells: string[]) => `| X-01 | text | 1 | ${cells.join(' | ')} | record |`.replace('X-01', 'C-01');
      expect(raciProblems(row(['A', 'A', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I']))).toHaveLength(1);
      expect(raciProblems(row(['C', 'R', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I']))).toHaveLength(1);
      expect(raciProblems(row(['A', 'R', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I']))).toEqual([]);
      expect(raciProblems('| C-01 | text | 1 | A | R | record |')).toHaveLength(1);
    });
  });

  describe('identifiers', () => {
    const everything = ALL.map((p) => p.body).join('\n');

    it('every service level used is defined in the catalog', () => {
      const defined = new Set(ids(text('04-support-operating-model.md'), /^\|\s*(SL-[A-Z]+-\d\d)\s*\|/));
      expect(defined.size).toBeGreaterThanOrEqual(30);
      expect(undefinedIds(defined, ids(everything, /\b(SL-[A-Z]+-\d\d)\b/g))).toEqual([]);
    });

    it('every handoff used is defined once in the handoffs page', () => {
      const defined = ids(text('handoffs.md'), /^###\s+(H-\d\d)\s/);
      expect(defined).toHaveLength(18);
      expect(new Set(defined).size).toBe(18);
      expect(undefinedIds(new Set(defined), ids(everything, /(?<![\w-])(H-\d\d)(?![\w-])/g))).toEqual([]);
    });

    it('every template used is defined once in the templates page', () => {
      const defined = ids(text('templates.md'), /^##\s+(TPL-\d\d)\s/);
      expect(defined).toHaveLength(26);
      expect(new Set(defined).size).toBe(26);
      expect(undefinedIds(new Set(defined), ids(everything, /(?<![\w-])(TPL-\d\d)(?![\w-])/g))).toEqual([]);
    });

    it('every dashboard metric used is defined once in the dictionary', () => {
      const defined = ids(text('09-dashboards-and-indicators.md'), /^\|\s*(D\d\.\d\d)\s*\|/);
      expect(defined.length).toBeGreaterThanOrEqual(80);
      expect(new Set(defined).size).toBe(defined.length);
      expect(undefinedIds(new Set(defined), ids(everything, /(?<![\w-])(D\d\.\d\d)(?![\w-])/g))).toEqual([]);
    });

    it('every hard gate used is defined once on the readiness page', () => {
      const defined = ids(text('10-tenant-launch-risk-and-readiness.md'), /^\|\s*(HG-\d\d)\s*\|/);
      expect(defined).toHaveLength(22);
      expect(new Set(defined).size).toBe(22);
      expect(undefinedIds(new Set(defined), ids(everything, /(?<![\w-])(HG-\d\d)(?![\w-])/g))).toEqual([]);
    });

    it('control: an ID used and never defined is caught', () => {
      expect(undefinedIds(new Set(['SL-SUP-01']), ['SL-SUP-01', 'SL-SUP-99', 'SL-SUP-99'])).toEqual(['SL-SUP-99']);
    });
  });

  describe('the ladder', () => {
    it('keeps the four rungs and starts every catalog row at SL0', () => {
      const readme = text('README.md');
      for (const rung of ['SL0', 'SL1', 'SL2', 'SL3']) expect(readme).toContain(`| ${rung} |`);
      const support = text('04-support-operating-model.md');
      expect(support).toContain('Every row is **SL0** today');
    });

    it('never states a service level as achieved', () => {
      for (const { name, body } of ALL) {
        for (const { n, line } of prose(body)) {
          expect(line, `${name}:${n}`).not.toMatch(/\b(we|Semester) (guarantee|guarantees|commits to|promises) /i);
          expect(line, `${name}:${n}`).not.toMatch(/\bour (uptime|availability) (is|was|has been) \d/i);
        }
      }
    });
  });
});
