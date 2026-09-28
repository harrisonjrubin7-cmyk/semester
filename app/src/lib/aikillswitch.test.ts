import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AI_GENERATION,
  KILLED_MESSAGE,
  aiGenerationKilled,
  engagedFrom,
  type SwitchRow,
} from '../../../supabase/functions/_shared/killswitch';

/**
 * `kill.ai_generation` has been a row in `feature_kill_switch`, the rollback
 * named by every AI flag in the registry, and the gap in AI-012 of the master
 * register: nothing that generated ever read it. These hold the shared
 * decision, and then hold the two runtimes to asking it before they generate.
 */

const row = (over: Partial<SwitchRow> = {}): SwitchRow => ({ switch_key: AI_GENERATION, tenant_id: null, engaged: true, ...over });

describe('whether generation is switched off', () => {
  it('is off for everyone when the global row is engaged', () => {
    expect(engagedFrom([row()], false, null)).toBe(true);
    expect(engagedFrom([row()], false, 'northstar')).toBe(true);
  });

  it('is off for one school when its own row is engaged, and on for the rest', () => {
    const rows = [row({ tenant_id: 'northstar' })];
    expect(engagedFrom(rows, false, 'northstar')).toBe(true);
    expect(engagedFrom(rows, false, 'eastfield')).toBe(false);
    // A caller with no school is not any school's tenant.
    expect(engagedFrom(rows, false, null)).toBe(false);
  });

  it('is on when the row is there but not engaged, and when there is no row', () => {
    expect(engagedFrom([row({ engaged: false })], false, 'northstar')).toBe(false);
    expect(engagedFrom([], false, 'northstar')).toBe(false);
    expect(engagedFrom(null, false, null)).toBe(false);
  });

  it('is only ever about its own switch', () => {
    expect(engagedFrom([row({ switch_key: 'kill.integration_sync' })], false, null)).toBe(false);
  });

  it('treats a switch that cannot be read as thrown', () => {
    expect(engagedFrom([], true, null)).toBe(true);
    expect(engagedFrom(null, true, 'northstar')).toBe(true);
  });
});

describe('reading it', () => {
  const reader = (answer: { data: unknown; error: unknown } | Error) => {
    const asked: unknown[][] = [];
    const db = {
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: unknown) => {
            asked.push([table, columns, column, value]);
            if (answer instanceof Error) return Promise.reject(answer);
            return Promise.resolve(answer);
          },
        }),
      }),
    };
    return { db, asked };
  };

  it('asks the table for the one switch, and reads the rows', async () => {
    const { db, asked } = reader({ data: [row()], error: null });
    expect(await aiGenerationKilled(db, null)).toBe(true);
    expect(asked).toEqual([['feature_kill_switch', 'switch_key,tenant_id,engaged', 'switch_key', AI_GENERATION]]);
    expect(await aiGenerationKilled(reader({ data: [], error: null }).db, 'northstar')).toBe(false);
  });

  it('is thrown when the read errors or throws', async () => {
    expect(await aiGenerationKilled(reader({ data: null, error: { message: 'no' } }).db, null)).toBe(true);
    expect(await aiGenerationKilled(reader(new Error('network')).db, null)).toBe(true);
  });

  it('says one sentence that blames nobody and reassures about the work', () => {
    expect(KILLED_MESSAGE).toMatch(/switched off right now/);
    expect(KILLED_MESSAGE).toMatch(/nothing you typed has been lost/);
  });
});

describe('the runtimes ask before they generate', () => {
  // Structural: the pure decision is tested above; this holds each place a
  // model is called to reading the switch first, so the check cannot be
  // quietly dropped from one of them.
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

  it('the shared-key edge function refuses before the body is read or the call counted', () => {
    const fn = read('../../../supabase/functions/claude/index.ts');
    const killed = fn.indexOf('await aiGenerationKilled(admin, null)');
    expect(killed).toBeGreaterThan(0);
    expect(killed).toBeLessThan(fn.indexOf('await req.text()'));
    expect(killed).toBeLessThan(fn.indexOf("admin.rpc('count_call'"));
    expect(fn).toContain('KILLED_MESSAGE');
  });

  it('the institution runtime hands the switch to the service, which refuses on it', () => {
    expect(read('../../../app/server/institution/intelligence-runtime.ts')).toContain('killSwitch: repository.killSwitchEngaged');
    expect(read('../../../app/server/institution/intelligence-repository.ts')).toContain("from('feature_kill_switch')");
    const service = read('../../../app/server/institution/intelligence.ts');
    expect(service).toContain("code: 'ai-generation-killed'");
  });
});
