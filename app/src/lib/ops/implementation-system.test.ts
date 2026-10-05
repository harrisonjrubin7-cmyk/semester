import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGES as MIGRATION_STAGES } from '../migration/center';

/**
 * `docs/institutional-implementation/` is the method an institution is moved through, and it
 * speaks in words the database owns: the nine stages
 * `implementation_projects.stage` accepts, the rollout states, the renewal
 * stages, the health statuses, the twelve migration stages. A method that
 * invents a stage the database would refuse, or leaves one with no home, is a
 * method nobody can follow in the product.
 *
 * So this holds the folder to the migrations, the way `lib/migration/center.test.ts`
 * holds the Migration Center screen to its migration, and to three things a
 * reader relies on: every link and anchor lands, every document carries its
 * control table and its claim ceiling, and every one of the ten phases has the
 * ten lines the method promises.
 *
 * The pure functions at the top are exercised against deliberately wrong input
 * (the controls), because a probe that has never failed is not known to be one.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');

const DIR = 'docs/institutional-implementation';
const DOCS = readdirSync(at(DIR)).filter((f) => f.endsWith('.md')).sort();
const doc = (name: string) => read(`${DIR}/${name}`);

const CORE = read('supabase/migrations/20260929070000_commercial_core.sql');
const ROLLOUT = read('supabase/migrations/20260928050000_tenant_rollout.sql');

// ── Pure helpers ────────────────────────────────────────────────────────────

/** The quoted values of `<column> in ( ... )`, the first one after `anchor`. */
export function enumAfter(sql: string, anchor: string, column: string): string[] {
  const from = sql.indexOf(anchor);
  if (from < 0) return [];
  const m = new RegExp(`\\b${column}\\s+in\\s*\\(([^)]*)\\)`).exec(sql.slice(from));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
}

/** `when 'state' then array['gate', …]` — the exit gates the rollout table enforces. */
export function exitGates(sql: string): Record<string, string[]> {
  const body = sql.split('create or replace function private.rollout_exit_gates')[1]?.split('$$;')[0] ?? '';
  const out: Record<string, string[]> = {};
  for (const m of body.matchAll(/when '([a-z_]+)' then array\[([^\]]*)\]/g)) out[m[1]] = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  return out;
}

/** Backticked tokens in a table cell. */
const ticked = (cell: string): string[] => [...cell.matchAll(/`([a-z_0-9]+)`/g)].map((m) => m[1]);

export interface CrosswalkRow { n: string; phase: string; stages: string[]; states: string[] }

/** The rows of the `## Crosswalk` table. */
export function parseCrosswalk(md: string): CrosswalkRow[] {
  const body = md.split(/^## Crosswalk\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  return body
    .split('\n')
    .filter((l) => /^\|/.test(l) && !/^\|\s*(#|---)/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((c) => c.length === 4)
    .map(([n, phase, stages, states]) => ({ n, phase, stages: ticked(stages), states: ticked(states) }));
}

/** GitHub's heading slug: lower case, punctuation dropped, spaces to hyphens. */
export function slug(heading: string): string {
  return heading
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');
}

export function anchorsOf(md: string): Set<string> {
  const out = new Set<string>();
  for (const m of md.replace(/```[\s\S]*?```/g, '').matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) out.add(slug(m[1]));
  return out;
}

/** Relative links, and `#anchors` into the same or another file, that land nowhere. */
export function brokenLinks(
  file: string,
  text: string,
  files: { exists: (p: string) => boolean; anchors: (p: string) => Set<string> | null },
): string[] {
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const out: string[] = [];
  for (const m of prose.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|tel:)/.test(target)) continue;
    const [path, frag] = target.split('#');
    const resolved = path ? normalize(join(dirname(file), decodeURI(path))) : file;
    if (!files.exists(resolved)) {
      out.push(`${file} → ${target} (no such file)`);
      continue;
    }
    if (frag && resolved.endsWith('.md')) {
      const anchors = files.anchors(resolved);
      if (anchors && !anchors.has(frag)) out.push(`${file} → ${target} (no such heading)`);
    }
  }
  return out;
}

const real = {
  exists: (p: string) => existsSync(at(p)),
  anchors: (p: string) => (existsSync(at(p)) ? anchorsOf(read(p)) : null),
};

// ── The database's vocabularies ─────────────────────────────────────────────

const STORED_STAGES = enumAfter(CORE, 'create table if not exists public.implementation_projects', 'stage');
const ROLLOUT_STATES = enumAfter(ROLLOUT, 'create table if not exists public.tenant_rollout (', 'state');
const RENEWAL_STAGES = enumAfter(CORE, 'create table if not exists public.renewal_opportunities', 'stage');
const RENEWAL_OUTCOMES = enumAfter(CORE, 'create table if not exists public.renewal_opportunities', 'outcome');
const HEALTH = enumAfter(CORE, 'create table if not exists public.account_health_snapshots', 'status');

const PHASES = ['Discover', 'Design', 'Configure', 'Integrate', 'Migrate', 'Pilot', 'Parallel run', 'Go-live', 'Hypercare', 'Optimize'];
const PHASE_LINES = ['Purpose', 'Entry', 'Work', 'Roles', 'Cadence', 'Artifacts', 'Acceptance', 'Risk controls', 'Stop', 'Exit evidence'];

describe('the probes (controls — each must be shown a case it should reject)', () => {
  it('reads the real vocabularies, not an empty list that would pass everything', () => {
    expect(STORED_STAGES).toEqual(['discover', 'configure', 'integrate', 'validate', 'train', 'launch', 'hypercare', 'measure', 'expand']);
    expect(ROLLOUT_STATES).toContain('production_active');
    expect(ROLLOUT_STATES).not.toContain('resume_state');
    expect(RENEWAL_STAGES).toEqual(['review_120', 'exec_90', 'proposal_60', 'signature_30', 'decided']);
    expect(RENEWAL_OUTCOMES).toEqual(['pending', 'renewed', 'expanded', 'downgraded', 'churned']);
    expect(HEALTH).toHaveLength(7);
  });

  it('reads the real exit gates, one entry per rollout state', () => {
    const g = exitGates(ROLLOUT);
    expect(g.sandbox_uat).toEqual(['uat_signoff', 'rls_isolation_passed', 'sso_login_verified']);
    expect(g.expansion).toEqual([]);
    expect(Object.keys(g)).toEqual(expect.arrayContaining(ROLLOUT_STATES));
  });

  it('finds nothing after an anchor that is not there', () => {
    expect(enumAfter(CORE, 'create table no.such_table', 'stage')).toEqual([]);
  });

  it('parses a crosswalk, and keeps an invented stage so the check below can refuse it', () => {
    const md = '## Crosswalk\n\n| # | Phase | Stored stage | Rollout state |\n| --- | --- | --- | --- |\n| 6 | Pilot | `pilot` | `pilot_read_only` |\n\n## Next\n';
    expect(parseCrosswalk(md)).toEqual([{ n: '6', phase: 'Pilot', stages: ['pilot'], states: ['pilot_read_only'] }]);
    expect(parseCrosswalk(md)[0].stages.filter((s) => !STORED_STAGES.includes(s))).toEqual(['pilot']);
  });

  it('slugs headings the way the viewer does', () => {
    expect(slug('Phase 3 — Configure')).toBe('phase-3--configure');
    expect(slug('4. Stakeholder map')).toBe('4-stakeholder-map');
    expect(slug('Training workstream gate (stored stage `train`)')).toBe('training-workstream-gate-stored-stage-train');
  });

  it('catches a missing file and a missing heading, and ignores code and external links', () => {
    const files = { exists: (p: string) => p === 'a/B.md' || p === 'a/A.md', anchors: () => new Set(['here']) };
    expect(brokenLinks('a/A.md', '[x](C.md)', files)).toEqual(['a/A.md → C.md (no such file)']);
    expect(brokenLinks('a/A.md', '[x](B.md#gone)', files)).toEqual(['a/A.md → B.md#gone (no such heading)']);
    expect(brokenLinks('a/A.md', '[x](B.md#here) [y](#here) [z](https://x.edu) `[c](none.md)`', files)).toEqual([]);
    expect(brokenLinks('a/A.md', '[x](#gone)', files)).toEqual(['a/A.md → #gone (no such heading)']);
  });
});

describe('docs/institutional-implementation', () => {
  it('holds every document the README promises, and nothing is undeclared', () => {
    const readme = doc('README.md');
    expect(DOCS.length).toBeGreaterThanOrEqual(13);
    for (const f of DOCS.filter((d) => d !== 'README.md')) expect(readme, `${f} is not in the README`).toContain(`(${f})`);
  });

  it('opens every document with its control table and closes it with the claim ceiling', () => {
    for (const f of DOCS) {
      const t = doc(f);
      expect(t, f).toMatch(/\n\| Control \| Value \|\n\| --- \| --- \|\n\| Status \| \*\*/);
      expect(t, f).toMatch(/\n## Evidence state\n/);
      expect(t, f).toMatch(/\n## Claim ceiling\n/);
      expect(t, f).toMatch(/\n## Prohibited claims\n/);
    }
  });

  it('links only to files and headings that exist', () => {
    const broken = DOCS.flatMap((f) => brokenLinks(`${DIR}/${f}`, doc(f), real));
    expect(broken).toEqual([]);
  });

  describe('the crosswalk', () => {
    const rows = parseCrosswalk(doc('METHODOLOGY.md'));
    const phased = rows.filter((r) => /^\d+$/.test(r.n));

    it('lists the ten phases in the order the method promises', () => {
      expect(phased.map((r) => r.phase)).toEqual(PHASES);
      expect(phased.map((r) => Number(r.n))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('uses only stages the database accepts, and every one of the nine has a home', () => {
      const used = new Set(rows.flatMap((r) => r.stages));
      expect([...used].filter((s) => !STORED_STAGES.includes(s))).toEqual([]);
      expect(STORED_STAGES.filter((s) => !used.has(s))).toEqual([]);
    });

    it('uses only rollout states the table accepts, and every live state is somewhere in the path', () => {
      const used = new Set(rows.flatMap((r) => r.states));
      expect([...used].filter((s) => !ROLLOUT_STATES.includes(s))).toEqual([]);
      const live = ROLLOUT_STATES.filter((s) => !['directory', 'paused', 'suspended', 'offboarding', 'archived'].includes(s));
      expect(live.filter((s) => !used.has(s))).toEqual([]);
    });

    it('moves forward one rollout step at a time, as the table will only allow', () => {
      const rank = ['requested', 'claimed', 'security_review', 'sandbox_uat', 'pilot_read_only', 'pilot_write_enabled', 'production_limited', 'production_active', 'expansion'];
      let high = -1;
      for (const r of phased) {
        const ranks = r.states.map((x) => rank.indexOf(x));
        expect(Math.min(...ranks), `${r.phase} starts before ${rank[high] ?? 'the start'}`).toBeGreaterThanOrEqual(high);
        expect(ranks, `${r.phase} skips a state`).toEqual([...ranks].sort((a, b) => a - b));
        high = Math.max(high, ...ranks);
      }
    });

    it('moves forward: the first stage of a phase never precedes the last stage of the one before', () => {
      const order = (s: string) => STORED_STAGES.indexOf(s);
      let high = -1;
      for (const r of rows) {
        const lo = Math.min(...r.stages.map(order));
        expect(lo, `${r.phase} starts at ${r.stages[0]} after reaching ${STORED_STAGES[high] ?? 'nothing'}`).toBeGreaterThanOrEqual(high);
        high = Math.max(high, ...r.stages.map(order));
      }
    });
  });

  describe('the rollout exit gates', () => {
    const section = doc('METHODOLOGY.md').split('## Rollout exit gates the database enforces')[1]?.split(/^## /m)[0] ?? '';
    const rows = [...section.matchAll(/^\| `([a-z_]+)` \| ([^|]+) \|/gm)].map((m) => [m[1], ticked(m[2])] as const);

    it('lists every live state that has exit gates, with exactly the database’s gates', () => {
      const real = exitGates(ROLLOUT);
      const live = ['requested', 'claimed', 'security_review', 'sandbox_uat', 'pilot_read_only', 'pilot_write_enabled', 'production_limited', 'production_active'];
      expect(rows.map((r) => r[0])).toEqual(live);
      for (const [state, gates] of rows) expect(gates, state).toEqual(real[state]);
    });

    it('names every gate it cites in the phase tables from the database’s list', () => {
      const known = new Set(Object.values(exitGates(ROLLOUT)).flat());
      const cited = [...doc('METHODOLOGY.md').matchAll(/`((?:sponsor_qualified|security_\w+|dpa_\w+|uat_\w+|rls_\w+|sso_\w+|source_\w+|accessibility_\w+|data_quality\w+|workflow_\w+|cutover_checklist\w+|sponsor_go_live|expansion_decision|module_campus\w+|remediation|completion_\w+))`/g)].map((m) => m[1]);
      expect(cited.length).toBeGreaterThan(8);
      // `security_review` is a state, not a gate; the pattern above also matches it.
      // The scan finds a misspelt gate (`uat_sign_off`); a gate with a wholly new prefix is not scanned for,
      // which is what the table test above is for.
      expect(cited.filter((g) => !known.has(g) && !ROLLOUT_STATES.includes(g))).toEqual([]);
    });
  });

  describe('the phases', () => {
    const md = doc('METHODOLOGY.md');
    it.each(PHASES.map((p, i) => [i + 1, p] as const))('phase %i (%s) carries all ten lines, none empty', (n, name) => {
      const section = md.split(new RegExp(`^### Phase ${n} — ${name}\\s*$`, 'm'))[1]?.split(/^##+ /m)[0] ?? '';
      expect(section, `no section for phase ${n}`).not.toBe('');
      for (const label of PHASE_LINES) {
        const m = new RegExp(`\\| \\*\\*${label}\\*\\* \\| (.+?) \\|\\n`).exec(section);
        expect(m, `phase ${n} lacks "${label}"`).not.toBeNull();
        expect(m![1].trim().length, `phase ${n} "${label}" is empty`).toBeGreaterThan(10);
      }
    });

    it('names a stored stage and a rollout state only from the database', () => {
      const all = DOCS.map(doc).join('\n');
      const stages = [...all.matchAll(/[Ss]tored stage(?: after handoff)?:? `([a-z_]+)`/g)].map((m) => m[1]);
      expect(stages.length).toBeGreaterThan(0);
      expect(stages.filter((s) => !STORED_STAGES.includes(s))).toEqual([]);
      const states = [...all.matchAll(/[Rr]ollout(?: state)? `([a-z_]+)`(?: → `([a-z_]+)`)?/g)].flatMap((m) => [m[1], m[2]]).filter(Boolean);
      expect(states.length).toBeGreaterThan(0);
      expect(states.filter((s) => !ROLLOUT_STATES.includes(s))).toEqual([]);
    });
  });

  describe('the success system', () => {
    const md = doc('SUCCESS-SYSTEM.md');

    it('maps every stored health status, and only those', () => {
      const section = md.split('**Mapping to stored statuses**')[1]?.split(/\n\*\*|\n## /)[0] ?? '';
      const listed = [...section.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]);
      expect(listed.slice().sort()).toEqual(HEALTH.slice().sort());
    });

    it('names the renewal stages and outcomes the table accepts', () => {
      for (const s of RENEWAL_STAGES) expect(md, s).toContain(`\`${s}\``);
      for (const o of RENEWAL_OUTCOMES) expect(md, o).toContain(`\`${o}\``);
    });

    it('keeps the health weights the controlled model proposes (not re-tuned here)', () => {
      const model = read('docs/commercial/CUSTOMER-HEALTH-SCORE.md');
      const weights = (t: string) => [...t.matchAll(/^\| ([^|]+) \| (\d+)% \|/gm)].map((m) => `${m[1].trim().toLowerCase()}:${m[2]}`);
      const proposed = weights(model);
      expect(proposed).toHaveLength(7);
      const mine = [...md.matchAll(/^\| ([^|]+) \| (\d+)% \|/gm)].map((m) => `${m[1].trim().toLowerCase().replace(/ \/ /g, '/')}:${m[2]}`);
      expect(mine.map((x) => x.split(':')[1])).toEqual(proposed.map((x) => x.split(':')[1]));
    });
  });

  describe('the migration workbook', () => {
    it('lists the twelve stages of the Migration Center, in its order', () => {
      const md = doc('MIGRATION-WORKBOOK.md');
      const section = md.split('## 2. The twelve stages')[1]?.split(/^## /m)[0] ?? '';
      const listed = [...section.matchAll(/^\| \d+ \| `([a-z_]+)` \|/gm)].map((m) => m[1]);
      expect(listed).toEqual([...MIGRATION_STAGES]);
    });

    it('does not claim a load path exists', () => {
      const md = doc('MIGRATION-WORKBOOK.md');
      expect(md).toMatch(/NO PRODUCTION LOAD PATH EXISTS/);
      expect(md).toMatch(/nothing reads `roster_current`/);
    });
  });
});
