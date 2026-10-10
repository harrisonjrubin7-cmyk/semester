/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from './gateway/errors.ts';
import { ISOLATION_CONTROLS, ISOLATION_LAYERS } from './isolation/layers.ts';
import { PLATFORM_METRICS, PLATFORM_SERVICES } from './observability/telemetry.ts';
import { MIN_FIRST_PARTY_NOTICE_DAYS, MIN_SUNSET_NOTICE_DAYS } from './gateway/versioning.ts';

/**
 * The platform pages are held to the code.
 *
 * A page that describes a boundary and has drifted from it is worse than no
 * page: it is read as evidence. So the facts that can be checked are checked —
 * every error code is in the catalogue table with the right status and retry
 * flag, every isolation layer and control is in the matrix, every metric and
 * service is listed, every path a page cites exists, every ADR has its
 * sections and names a test that is really there — and the sentences that keep
 * the pages honest are checked too, because those are the ones that get edited
 * out first.
 */

const ROOT = resolve(import.meta.dirname, '../../..');
const SRC = import.meta.dirname;
const DOCS = join(ROOT, 'docs/platform');
const at = (p: string) => join(ROOT, p);
const read = (p: string) => readFileSync(at(p), 'utf8');

function mdFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) mdFiles(p, out);
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}
const PAGES = mdFiles(DOCS);
const rel = (p: string) => relative(ROOT, p).split('\\').join('/');
const withoutFences = (s: string) => s.replace(/```[\s\S]*?```/g, '');
/** One line of text, so a sentence wrapped across a blockquote still matches. */
const flat = (s: string) => s.replace(/^>\s?/gm, '').replace(/\s+/g, ' ');

const REQUIRED = ['README', 'PRIMITIVES', 'GATEWAY-STANDARDS', 'ISOLATION', 'EVENTS-AND-OUTBOX', 'OBSERVABILITY', 'OPERATIONS', 'MIGRATION', 'TRACEABILITY'];

describe('the pages exist', () => {
  it.each(REQUIRED)('%s.md', (name) => {
    expect(existsSync(join(DOCS, `${name}.md`))).toBe(true);
  });
});

describe('every path a page cites exists', () => {
  const PREFIX = /^(packages|app|docs|supabase|ops|scripts)\//;
  const PACKAGE_SHORT = /^(kernel|seam|observability|tenancy|identity|policy|events|gateway|engines|isolation|sdk|testing|reference)\/[\w.-]+\.ts$/;
  const ROOT_FILE = /^[A-Z][A-Z0-9_-]+\.md$/;

  const cited = (md: string): { token: string; where: 'repo' | 'package' | 'root' }[] => {
    const out: { token: string; where: 'repo' | 'package' | 'root' }[] = [];
    for (const m of withoutFences(md).matchAll(/`([^`\n]+)`/g)) {
      const t = m[1].trim();
      if (/[\s*<>{}$|()]/.test(t) || t.includes('…')) continue;
      if (PREFIX.test(t) && /\.[a-z]+$/.test(t)) out.push({ token: t, where: 'repo' });
      else if (PACKAGE_SHORT.test(t)) out.push({ token: t, where: 'package' });
      else if (ROOT_FILE.test(t)) out.push({ token: t, where: 'root' });
    }
    return out;
  };

  it('control: the extractor finds each kind', () => {
    const found = cited('`packages/platform/src/index.ts` `engines/files.ts` `SECRETS.md` `not a path` `x*.ts` ```\n`app/x.ts`\n```');
    expect(found.map((f) => f.where)).toEqual(['repo', 'package', 'root']);
  });

  for (const page of PAGES) {
    it(rel(page), () => {
      const missing = cited(readFileSync(page, 'utf8')).filter(({ token, where }) => {
        if (where === 'repo') return !existsSync(at(token));
        if (where === 'package') return !existsSync(join(SRC, token));
        // A bare page name is a sibling in docs/platform, a root file, or one under docs/.
        return !existsSync(join(DOCS, token)) && !existsSync(at(token)) && !existsSync(at(`docs/${token}`));
      });
      expect(missing.map((m) => m.token)).toEqual([]);
    });
  }

  it('every relative markdown link resolves', () => {
    const broken: string[] = [];
    for (const page of PAGES) {
      for (const m of withoutFences(readFileSync(page, 'utf8')).matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+)(?:#[^)]*)?\)/g)) {
        if (!existsSync(resolve(dirname(page), m[1]))) broken.push(`${rel(page)} → ${m[1]}`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('README', () => {
  const readme = read('docs/platform/README.md');
  const dirs = readdirSync(SRC).filter((n) => statSync(join(SRC, n)).isDirectory());

  it('lists every directory of the package, and only real ones', () => {
    for (const d of dirs) expect(readme, d).toMatch(new RegExp(`^\\s{2}${d}/\\s`, 'm'));
    const listed = [...readme.matchAll(/^\s{2}([a-z]+)\/\s{2,}/gm)].map((m) => m[1]);
    expect(listed.sort()).toEqual([...dirs].sort());
  });

  it('says plainly what has adopted it and that no route uses commands, policy or engines', () => {
    expect(flat(readme)).toMatch(/partially adopted by the institution surface/i);
    expect(flat(readme)).toContain("browser's university client uses the shared SDK");
    expect(flat(readme)).toMatch(/no route uses commands, policy or any engine yet/i);
  });

  it('says how it relates to the constitution and the target-architecture pack, and both exist', () => {
    expect(readme).toContain('docs/PLATFORM-CONSTITUTION.md');
    expect(readme).toContain('docs/target-architecture/');
    expect(flat(readme)).toContain('Where it lives is the pack\'s call');
  });

  it('names the two real overlaps with existing code', () => {
    expect(readme).toContain('app/src/lib/flags.ts');
    expect(readme).toContain('supabase/functions/_shared/entitlement.ts');
  });
});

describe('GATEWAY-STANDARDS error catalogue', () => {
  const page = read('docs/platform/GATEWAY-STANDARDS.md');
  const rows = new Map([...page.matchAll(/^\| `(\w+)` \| (\d{3}) \| (\*\*yes\*\*|no) \|/gm)].map((m) => [m[1], { status: Number(m[2]), retry: m[3] !== 'no' }]));

  it('has a row for every code, with the code\'s own status and retry flag, and no extras', () => {
    expect([...rows.keys()].sort()).toEqual(Object.keys(ERROR_CODES).sort());
    for (const [code, spec] of Object.entries(ERROR_CODES)) {
      expect(rows.get(code), code).toEqual({ status: spec.status, retry: spec.retryable });
    }
  });

  it('keeps the rule that only 429 and 503 are blind-retryable', () => {
    expect(page).toContain('**`retryable` is true only for 429 and 503**');
  });

  it('documents the idempotency lease and the sunset notice that the code enforces', () => {
    expect(page).toContain('(60 s)');
    expect(flat(page)).toContain('**At least 365 days** between announcing deprecation and sunset (**90** for a `firstPartyOnly` major)');
    expect(MIN_SUNSET_NOTICE_DAYS).toBe(365);
    expect(MIN_FIRST_PARTY_NOTICE_DAYS).toBe(90);
  });

  it('reconciles with the target-architecture pack rather than contradicting it', () => {
    expect(page).toContain('target-architecture/07-ENGINEERING-STANDARDS.md');
    expect(page).toContain('422');
  });
});

describe('ISOLATION matrix', () => {
  const page = read('docs/platform/ISOLATION.md');

  it('has a row per layer, naming the file that enforces it', () => {
    for (const layer of ISOLATION_LAYERS) expect(page, layer).toContain(`| **${layer}** |`);
    for (const c of ISOLATION_CONTROLS) expect(page, `${c.layer} → ${c.enforcedIn}`).toContain(c.enforcedIn.replace('packages/platform/src/', ''));
  });

  it('states the honest scope: no real adapter, the SQL has not run', () => {
    expect(flat(page)).toContain('**No real Postgres, Redis, object store, search engine or warehouse adapter exists yet**');
    expect(flat(page)).toContain('has not run');
  });

  it('counts the leaky adapters the way the test does', () => {
    const src = read('packages/platform/src/isolation/isolation.test.ts');
    const leaky = src.split('goes red against deliberately leaky adapters')[1].split("describe('isolation helpers'")[0];
    expect((leaky.match(/^ {2}it\('/gm) ?? []).length).toBe(7);
    expect(page).toContain('**seven deliberately leaky adapters**');
  });
});

describe('OBSERVABILITY', () => {
  const page = read('docs/platform/OBSERVABILITY.md');
  it('lists every platform metric and every platform service', () => {
    for (const m of PLATFORM_METRICS) expect(page, m.name).toContain(`\`${m.name}\``);
    for (const s of PLATFORM_SERVICES) expect(page, s.id).toMatch(new RegExp(`\\| \`${s.id}\` \\| ${s.tier} \\|`));
  });
  it('says the SLOs are targets and not measurements', () => {
    expect(page).toContain('**These are targets, not measurements.**');
  });
});

describe('OPERATIONS and MIGRATION', () => {
  it('runbooks say they have not been rehearsed', () => {
    expect(read('docs/platform/OPERATIONS.md')).toMatch(/Status: written, not rehearsed/);
  });
  it('migration says no phase after 0 has started, and forbids dual-write of decisions', () => {
    const m = read('docs/platform/MIGRATION.md');
    expect(flat(m)).toContain('No phase after 0 has started');
    expect(flat(m)).toContain('never with dual-write of authorization decisions');
    for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) expect(m).toContain(`### Phase ${n} `);
  });
  it('every phase has an exit gate or a stated rollback', () => {
    const m = read('docs/platform/MIGRATION.md');
    const phases = m.split(/^### Phase /m).slice(1);
    expect(phases).toHaveLength(8);
    for (const p of phases) expect(/Exit gate|exit gate|Rollback|rollback|Each removal/.test(p), p.slice(0, 40)).toBe(true);
  });
});

describe('TRACEABILITY', () => {
  const page = read('docs/platform/TRACEABILITY.md');
  it('maps all ten mission items, and every test it names exists', () => {
    for (let i = 1; i <= 10; i++) expect(page).toMatch(new RegExp(`^\\| ${i} \\|`, 'm'));
    for (const m of page.matchAll(/`([\w/.-]+\.test\.ts)`/g)) {
      const path = /^(app|packages)\//.test(m[1]) ? at(m[1]) : join(SRC, m[1]);
      expect(existsSync(path), m[1]).toBe(true);
    }
  });
  it('lists the preamble\'s required outputs', () => {
    for (const h of ['Assumptions', 'Risks and unresolved questions', 'Files changed or proposed', 'Tests added', 'Accessibility implications', 'Security and privacy implications', 'Operational and runbook implications', 'Traceability matrix updates']) {
      expect(page).toContain(`### ${h}`);
    }
  });
});

describe('ADRs', () => {
  const dir = join(DOCS, 'adr');
  const records = readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'README.md');
  const index = read('docs/platform/adr/README.md');

  it('are named for the decision and not numbered (the numbering collisions in CLAUDE.md)', () => {
    expect(records.length).toBeGreaterThanOrEqual(8);
    for (const r of records) expect(r, r).not.toMatch(/^\d+[-_]/);
  });

  it('are all indexed, and the index lists only real records', () => {
    for (const r of records) expect(index, r).toContain(`(${r})`);
    for (const m of index.matchAll(/\]\(([\w-]+\.md)\)/g)) expect(records, m[1]).toContain(m[1]);
  });

  it.each(records)('%s has every section and cites a test that exists', (name) => {
    const body = readFileSync(join(dir, name), 'utf8');
    expect(body).toMatch(/^# .+/m);
    expect(body).toMatch(/\*\*Status:\*\* /);
    for (const h of ['## Decision', '## Why', '## What it was chosen over', '## How it is held', '## What this constrains']) expect(body, h).toContain(h);
    const held = body.split('## How it is held')[1].split('\n## ')[0];
    const tests = [...held.matchAll(/`(packages\/platform\/src\/[\w/.-]+\.test\.ts)`/g)].map((m) => m[1]);
    expect(tests.length, 'names no test').toBeGreaterThan(0);
    for (const t of tests) expect(existsSync(at(t)), t).toBe(true);
  });
});

describe('what the pages must not claim', () => {
  it('never says production-ready, certified, compliant or secure-by-default about any of this', () => {
    const banned = /(production[- ]ready|\bcertified\b|\bcompliant\b|FERPA[- ]compliant|SOC ?2|bulletproof|guarantees? (that )?no)/i;
    const hits: string[] = [];
    for (const page of PAGES) {
      withoutFences(readFileSync(page, 'utf8')).split('\n').forEach((line, i) => {
        if (banned.test(line)) hits.push(`${rel(page)}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('control: the claim scanner would catch one', () => {
    expect(/(production[- ]ready|\bcertified\b)/i.test('This layer is production-ready.')).toBe(true);
  });
});
