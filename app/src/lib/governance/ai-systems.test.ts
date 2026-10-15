import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_RELEASE_GATE } from './ai-lifecycle';
import {
  DOORS, KILL_DRILLS, KILL_REACH, ROUTES, SYSTEMS, TIER_GATES, launchRequirements, routesOf, tierFloor, uncontained,
} from './ai-systems';

/**
 * Holds the child-level AI inventory to the tree. The census is the guard: it
 * finds every source file that reaches a model by import, and a file that is
 * not listed fails here, so a new AI call site cannot arrive as a shadow system.
 *
 * The probe is shown to work on both sides before it is believed: it must find
 * a file that calls a model by static import, one that calls by dynamic import,
 * and it must pass over a file that has a function called ask() and nothing to
 * do with a model (`lib/canvas.ts`) and one that is about AI and never calls
 * one (`lib/aiflags.ts`).
 */

const root = join(import.meta.dirname, '../../../..');
const src = join(root, 'app/src');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

/** The three ways a file in the app reaches a model, or the institution's gateway client. */
const DOORS_IN = [
  /import\s*(?:type\s*)?\{[^}]*\b(ask|readMaterial|readShots|readPages|askOpenAI)\b[^}]*\}\s*from\s*'[^']*\/(claude|openai)'/,
  /import\(\s*'[^']*\/(claude|openai)'\s*\)/,
  /\binstitutionIntelligence\b/,
];

const reachesAModel = (text: string) => DOORS_IN.some((re) => re.test(text));

const census = (): string[] =>
  walk(src)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !/\.live\./.test(f))
    .filter((f) => reachesAModel(readFileSync(f, 'utf8')))
    .map((f) => `app/${relative(join(root, 'app'), f)}`)
    .sort();

const listed = [...SYSTEMS.flatMap((s) => s.files), ...DOORS.flatMap((d) => d.files)];

describe('the census probe', () => {
  it('finds a static importer, a dynamic importer, and the institutional client', () => {
    expect(reachesAModel(read('app/src/ai/converse.ts'))).toBe(true);
    expect(reachesAModel(read('app/src/components/ProductivityPreparation.tsx'))).toBe(true);
    expect(reachesAModel(read('app/src/lib/university.ts'))).toBe(true);
  });

  it('passes over a function named ask() that has nothing to do with a model, and over AI code that calls none', () => {
    expect(read('app/src/lib/canvas.ts')).toMatch(/function ask\(/);
    expect(reachesAModel(read('app/src/lib/canvas.ts'))).toBe(false);
    expect(reachesAModel(read('app/src/lib/aiflags.ts'))).toBe(false);
  });

  it('would fail on the one it was written because of: a dynamic import in a component', () => {
    const staticOnly = DOORS_IN[0];
    expect(staticOnly.test(read('app/src/components/ProductivityPreparation.tsx'))).toBe(false);
  });
});

describe('the child-level AI inventory', () => {
  it('lists every source file that reaches a model, exactly once', () => {
    const found = census();
    expect(found.length).toBeGreaterThan(25);
    const unlisted = found.filter((f) => !listed.includes(f));
    expect(unlisted, `an AI call site with no inventory entry: ${unlisted.join(', ')}`).toEqual([]);
    const twice = listed.filter((f, i) => listed.indexOf(f) !== i);
    expect(twice, `listed twice: ${twice.join(', ')}`).toEqual([]);
  });

  it('lists only files that exist', () => {
    for (const f of listed) expect(existsSync(join(root, f)), f).toBe(true);
  });

  it('has each id once, each system on a door that exists, and each family named in the family-level baseline', () => {
    const ids = [...SYSTEMS.map((s) => s.id), ...DOORS.map((d) => d.id)];
    expect(new Set(ids).size).toBe(ids.length);
    const baseline = read('docs/trust/AI-SYSTEM-INVENTORY.md');
    for (const s of SYSTEMS) {
      expect(s.doors.length, s.id).toBeGreaterThan(0);
      for (const d of s.doors) expect(DOORS.some((x) => x.id === d), `${s.id} → ${d}`).toBe(true);
      expect(baseline, `${s.id} is a child of ${s.family}`).toContain(`| ${s.family} |`);
    }
  });

  it('places no system below the tier its own properties require', () => {
    for (const s of SYSTEMS) {
      expect(s.tier, `${s.id} is tier ${s.tier}, its floor is ${tierFloor(s)}`).toBeGreaterThanOrEqual(tierFloor(s));
      if (s.effective) expect(s.effective.tier, s.id).toBeLessThan(s.tier);
    }
  });

  it('floors a tool-choosing agent at tier 3 and a tenant-source system at tier 2, whatever else they do', () => {
    expect(tierFloor({ action: 'A', agentLoop: true, data: 'T2' })).toBe(3);
    expect(tierFloor({ action: 'A', agentLoop: false, data: 'T1' })).toBe(2);
    expect(tierFloor({ action: 'C', agentLoop: false, data: 'T2' })).toBe(2);
    expect(tierFloor({ action: 'B', agentLoop: false, data: 'T2' })).toBe(1);
  });

  it('records a reconciliation for every system whose data reaches T3 or above, and for none that does not', () => {
    for (const s of SYSTEMS) {
      const high = ['T3', 'T4', 'T5', 'T6'].includes(s.data);
      expect(Boolean(s.reconcile), `${s.id} data ${s.data}`).toBe(high);
    }
    expect(SYSTEMS.some((s) => s.reconcile)).toBe(true);
  });

  it('keeps the high tiers where the hard cases are', () => {
    const tier3 = SYSTEMS.filter((s) => s.tier === 3).map((s) => s.id);
    expect(tier3).toEqual(['AI-01.1', 'AI-02.1']);
  });
});

describe('what a server kill switch can reach', () => {
  it('covers every route, and reaches exactly the two that ask a server', () => {
    expect(Object.keys(KILL_REACH).sort()).toEqual([...ROUTES].sort());
    expect(ROUTES.filter((r) => KILL_REACH[r] === 'server-switch')).toEqual(['shared-key', 'institution-gateway']);
  });

  it('is true of the code: the two reachable doors read the switch, and the consumer door does not', () => {
    expect(read('supabase/functions/claude/index.ts')).toContain('aiGenerationKilled');
    expect(read('app/server/institution/intelligence.ts')).toContain('killSwitch');
    const door = `${read('app/src/lib/claude.ts')}\n${read('app/src/lib/openai.ts')}`;
    expect(
      door,
      'the consumer door now mentions a kill switch: if it reads kill.ai_generation, move device-key, device-key-openai and proxy to server-switch in KILL_REACH and update docs/ai-governance/07',
    ).not.toMatch(/kill\.ai_generation|feature_kill_switch|aiGenerationKilled/);
  });

  it('names the routes a system cannot be stopped on, and the assistant is one of them', () => {
    const ask = SYSTEMS.find((s) => s.id === 'AI-01.1')!;
    expect(routesOf(ask)).toEqual(['shared-key', 'device-key', 'device-key-openai', 'proxy']);
    expect(uncontained(ask)).toEqual(['device-key', 'device-key-openai', 'proxy']);
    const institution = SYSTEMS.find((s) => s.id === 'AI-02.1')!;
    expect(uncontained(institution)).toEqual([]);
  });

  it('cites a drill only where one is on file, and only for a reachable route', () => {
    for (const [route, file] of Object.entries(KILL_DRILLS)) {
      expect(existsSync(join(root, file!)), file).toBe(true);
      expect(KILL_REACH[route as keyof typeof KILL_REACH], route).toBe('server-switch');
    }
    expect(KILL_DRILLS['institution-gateway']).toBeUndefined();
  });
});

describe('launch requirements by tier', () => {
  it('carry the whole release gate at every tier, and each tier carries the one below', () => {
    for (const tier of [0, 1, 2, 3] as const) {
      const need = launchRequirements(tier);
      for (const item of AI_RELEASE_GATE) expect(need, `tier ${tier} lacks ${item}`).toContain(item);
      if (tier > 0) {
        for (const item of launchRequirements((tier - 1) as 0 | 1 | 2)) expect(need).toContain(item);
        expect(need.length).toBeGreaterThan(launchRequirements((tier - 1) as 0 | 1 | 2).length);
      }
    }
  });

  it('never asks for the same thing twice', () => {
    const all = Object.values(TIER_GATES).flat();
    expect(new Set(all).size).toBe(all.length);
    for (const tier of [0, 1, 2, 3] as const) expect(new Set(launchRequirements(tier)).size).toBe(launchRequirements(tier).length);
  });
});

describe('the design this holds', () => {
  it('names every system and every door in its inventory chapter', () => {
    const index = read('docs/ai-governance/01-inventory-and-risk-tiering.md');
    for (const s of SYSTEMS) expect(index, s.id).toContain(s.id);
    for (const d of DOORS) expect(index, d.id).toContain(d.id);
  });

  it('prints, in the launch chapter, every requirement the code asks for at the highest tier', () => {
    const gates = read('docs/ai-governance/10-red-team-and-launch-gates.md');
    for (const need of launchRequirements(3)) expect(gates, need).toContain(need);
  });

  it('says in the shutdown chapter which routes a server switch cannot reach', () => {
    const shutdown = read('docs/ai-governance/07-incident-response-and-shutdown.md');
    for (const r of ROUTES.filter((x) => KILL_REACH[x] === 'none')) expect(shutdown, r).toContain(r);
  });
});
