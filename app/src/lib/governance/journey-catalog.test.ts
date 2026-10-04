import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOMAINS,
  JOURNEYS,
  QUALITY_GATES,
  renderDebtTable,
  renderJourneyTables,
  rolesCovered,
  statusOf,
  summary,
  summaryLine,
  type Journey,
} from './journey-catalog';
import { ROLES } from '../rolelaunch';

/**
 * A catalog of journeys is only worth having if it cannot drift from the
 * things it points at, and cannot flatter itself.
 *
 *   - **Complete.** Every role in `rolelaunch.ts` and every domain has a
 *     journey. Adding a role without one turns this red, which is the point:
 *     a role nobody can describe a journey for is a role nobody tests.
 *   - **Real.** Every cited file exists, every command resolves to a script or
 *     a suite that exists. The control is that an absent path reads as absent,
 *     so a probe pointed at the wrong root cannot pass everything.
 *   - **Honest.** Status is arithmetic on `evidence` and `owed`. A P0 journey
 *     with nothing proving it is refused.
 *   - **Documented.** The document a person reads lists exactly these rows.
 */

const root = join(import.meta.dirname, '../../../..');
const app = join(root, 'app');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const scripts = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8')).scripts as Record<string, string>;

const JOURNEY_DOC = 'docs/quality-system/02-JOURNEYS.md';
const GATE_DOC = 'docs/quality-system/04-GATES-AND-CI.md';

/** The ways a `run` entry may name something that has to exist. */
function missingFromCommand(command: string): string[] {
  const missing: string[] = [];
  const npm = /^npm run ([a-z0-9:-]+)$/.exec(command);
  const suite = /^supabase\/check\.sh ([a-z0-9_-]+)$/.exec(command);
  const vitest = /^npx vitest run (.+)$/.exec(command);
  if (npm) {
    if (!scripts[npm[1]!]) missing.push(`npm script ${npm[1]}`);
  } else if (suite) {
    if (!existsSync(join(root, `supabase/${suite[1]}.check.sql`))) missing.push(`supabase/${suite[1]}.check.sql`);
  } else if (vitest) {
    for (const file of vitest[1]!.split(' ')) if (!existsSync(join(app, file))) missing.push(`app/${file}`);
  } else if (/^supabase\/[a-z]+\.sh$/.test(command)) {
    if (!existsSync(join(root, command))) missing.push(command);
  } else {
    missing.push(`a command shape this test does not know: ${command}`);
  }
  return missing;
}

function journey(over: Partial<Journey>): Journey {
  return {
    id: 'J-TEST-01',
    title: 'A test journey',
    domain: 'identity',
    roles: ['student'],
    priority: 'P1',
    gate: 'pull-request',
    layers: ['unit'],
    run: [],
    evidence: [],
    owed: [],
    synthetic: false,
    ...over,
  };
}

describe('the probe itself (controls)', () => {
  it('reads a path that is absent as absent, and one that is present as present', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'app/src/lib/no-such-journey-evidence.ts'))).toBe(false);
  });

  it('sees a command that names nothing real', () => {
    expect(missingFromCommand('npm run smoke:golden')).toEqual([]);
    expect(missingFromCommand('npm run smoke:no-such-thing')).toEqual(['npm script smoke:no-such-thing']);
    expect(missingFromCommand('supabase/check.sh no-such-suite')).toEqual(['supabase/no-such-suite.check.sql']);
    expect(missingFromCommand('npx vitest run src/no-such.test.ts')).toEqual(['app/src/no-such.test.ts']);
    expect(missingFromCommand('make it so')).toHaveLength(1);
  });

  it('derives status from evidence and what is owed, never from a typed word', () => {
    const proof = [{ path: 'README.md', shows: 'x' }];
    expect(statusOf(journey({}))).toBe('owed');
    expect(statusOf(journey({ evidence: proof }))).toBe('automated');
    expect(statusOf(journey({ evidence: proof, owed: ['a real run'] }))).toBe('partial');
    expect(statusOf(journey({ evidence: [], owed: ['everything'] }))).toBe('owed');
  });
});

describe('journey catalog: shape', () => {
  it('has unique, well-formed ids', () => {
    const ids = JOURNEYS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(/^J-[A-Z]{2,3}-\d{2}$/);
  });

  it('puts every journey in a known domain and at a known gate', () => {
    for (const j of JOURNEYS) {
      expect(DOMAINS, j.id).toContain(j.domain);
      expect(QUALITY_GATES, j.id).toContain(j.gate);
    }
  });

  it('gives every journey a title, a role and at least one layer', () => {
    for (const j of JOURNEYS) {
      expect(j.title.trim().length, j.id).toBeGreaterThan(10);
      expect(j.roles.length, j.id).toBeGreaterThan(0);
      expect(j.layers.length, j.id).toBeGreaterThan(0);
    }
  });

  it('marks a journey synthetic only if it has the synthetic layer, and the reverse', () => {
    for (const j of JOURNEYS) expect(j.synthetic, j.id).toBe(j.layers.includes('synthetic'));
  });
});

describe('journey catalog: complete', () => {
  it('has a journey for every domain', () => {
    for (const domain of DOMAINS) {
      expect(JOURNEYS.some((j) => j.domain === domain), `no journey in ${domain}`).toBe(true);
    }
  });

  it('has a journey for every role in the role register', () => {
    const covered = rolesCovered();
    const missing = ROLES.map((r) => r.role).filter((role) => !covered.has(role));
    expect(missing, `roles with no journey: ${missing.join(', ')}`).toEqual([]);
  });

  it('names only roles that exist (a typo cannot cover a real role)', () => {
    const real = new Set(ROLES.map((r) => r.role));
    for (const j of JOURNEYS) {
      for (const role of j.roles) expect(real.has(role), `${j.id} names ${role}, which is not a role`).toBe(true);
    }
    expect(rolesCovered([journey({ roles: ['not_a_role'] })]).has('student')).toBe(false);
  });

  it('is the home of every critical flow: CF-01 to CF-10 each has a journey', () => {
    const plan = read('docs/engineering-operations/CRITICAL-FLOW-TEST-PLAN.md');
    const planned = [...plan.matchAll(/\| (CF-\d{2}) \|/g)].map((m) => m[1]!);
    expect(planned).toHaveLength(10);
    const cited = new Set(JOURNEYS.map((j) => j.cf).filter(Boolean));
    for (const cf of planned) expect(cited.has(cf), `${cf} has no journey`).toBe(true);
    for (const cf of cited) expect(planned, `a journey cites ${cf}, which the plan does not have`).toContain(cf);
  });
});

describe('journey catalog: real', () => {
  it('cites only files that exist', () => {
    for (const j of JOURNEYS) {
      for (const e of j.evidence) expect(existsSync(join(root, e.path)), `${j.id} cites ${e.path}, which is missing`).toBe(true);
    }
  });

  it('runs only scripts, suites and tests that exist', () => {
    for (const j of JOURNEYS) {
      for (const command of j.run) expect(missingFromCommand(command), `${j.id}: ${command}`).toEqual([]);
    }
  });
});

describe('journey catalog: honest', () => {
  it('never lets a P0 journey stand on nothing', () => {
    for (const j of JOURNEYS.filter((x) => x.priority === 'P0')) {
      expect(statusOf(j), `${j.id} is P0 with no evidence`).not.toBe('owed');
    }
  });

  it('says what is owed whenever it says nothing proves it', () => {
    for (const j of JOURNEYS) {
      if (j.evidence.length === 0) expect(j.owed.length, `${j.id} has no evidence and no stated debt`).toBeGreaterThan(0);
    }
  });

  it('counts what is owed rather than what is done', () => {
    // The reverse of reassurance: the summary must count what is owed.
    const counts = summary();
    expect(counts.automated + counts.partial + counts.owed).toBe(JOURNEYS.length);
    expect(summary([journey({ evidence: [{ path: 'README.md', shows: 'x' }], owed: ['y'] })]).partial).toBe(1);
  });

  it('holds a P0 journey to a gate no later than tenant launch', () => {
    for (const j of JOURNEYS.filter((x) => x.priority === 'P0')) expect(QUALITY_GATES, j.id).toContain(j.gate);
  });
});

describe('journey catalog: documented', () => {
  const doc = read(JOURNEY_DOC);
  const lines = doc.split('\n');

  /** The text between a region's markers; `undefined` when the markers are absent. */
  function region(text: string, name: string): string | undefined {
    const start = `<!-- journeys:${name}:start -->`;
    const end = `<!-- journeys:${name}:end -->`;
    const from = text.indexOf(start);
    const to = text.indexOf(end);
    return from < 0 || to < from ? undefined : text.slice(from + start.length, to).trim();
  }

  it('reads a region from a document, and sees one that is missing (control)', () => {
    expect(region('a <!-- journeys:x:start -->\nbody\n<!-- journeys:x:end --> b', 'x')).toBe('body');
    expect(region('no markers here', 'x')).toBeUndefined();
  });

  it('carries the generated regions exactly as the catalog renders them', () => {
    // `npm run journeys -- --write` rewrites them. A hand edit, a new journey
    // or a changed status that the document does not show fails here.
    expect(region(doc, 'summary')).toBe(summaryLine());
    expect(region(doc, 'debt')).toBe(renderDebtTable());
    expect(region(doc, 'table')).toBe(renderJourneyTables());
  });

  it('lists every journey with its title on the row that carries its id', () => {
    for (const j of JOURNEYS) {
      const row = lines.find((l) => l.includes(`\`${j.id}\``));
      expect(row, `${JOURNEY_DOC} has no row for ${j.id}`).toBeDefined();
      expect(row, `${j.id}'s row does not carry its title`).toContain(j.title);
    }
  });

  it('lists no journey the catalog does not have', () => {
    const known = new Set(JOURNEYS.map((j) => j.id));
    for (const token of doc.matchAll(/`(J-[A-Z]{2,3}-\d{2})`/g)) {
      expect(known.has(token[1]!), `${JOURNEY_DOC} names ${token[1]}, which is not in the catalog`).toBe(true);
    }
  });

  it('names every gate in the gates document', () => {
    const gates = read(GATE_DOC);
    for (const gate of QUALITY_GATES) expect(gates, `${GATE_DOC} does not name the ${gate} gate`).toContain(`\`${gate}\``);
  });

  it('gives the pack README the same counts the catalog has', () => {
    const readme = read('docs/quality-system/README.md');
    const counts = summary();
    expect(readme).toContain(`${JOURNEYS.length} journeys cover all ${ROLES.length} roles`);
    expect(readme).toContain(`${counts.automated} fully proved, ${counts.partial} partial`);
  });
});
