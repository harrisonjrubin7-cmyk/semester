import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_GENERATION, KILLED_MESSAGE } from '../../../supabase/functions/_shared/killswitch';

/**
 * The kill-switch drill (`app/scripts/killswitch-drill.mjs`) judges the
 * deployed runtime by the sentence the runtime says when engaged, read out of
 * `killswitch.ts` at run time. This holds the script to that module and to
 * the function it calls, so a renamed switch, a reworded refusal or a moved
 * function would go red here before the drill reported a false failure.
 */

const root = join(import.meta.dirname, '../../..');
const script = readFileSync(join(root, 'app/scripts/killswitch-drill.mjs'), 'utf8');
const module_ = readFileSync(join(root, 'supabase/functions/_shared/killswitch.ts'), 'utf8');

/** The script's own reader, copied so the test fails if either side drifts. */
const read = (source: string) => /export const KILLED_MESSAGE =\s*\n?\s*'([^']+)';/.exec(source)?.[1];

describe('the kill-switch drill', () => {
  it('reads the refusal sentence out of the module the runtime says it from', () => {
    expect(read(module_)).toBe(KILLED_MESSAGE);
    expect(script).toContain("/export const KILLED_MESSAGE =");
    expect(read("export const KILLED_MESSAGE =\n  'other';")).toBe('other'); // the reader reads, not a fixture
  });

  it('calls the deployed function by its path and engages the switch by its key', () => {
    expect(script).toContain("'/functions/v1/claude'");
    expect(script).toContain(`'${AI_GENERATION}'`);
    expect(script).toContain("on conflict ((coalesce(tenant_id, '')), switch_key)"); // the table's one-per-scope index
  });

  it('expects 503 while engaged and 200 either side, and never writes to production itself', () => {
    expect(script).toMatch(/status: 503, message: KILLED/);
    expect(script.match(/\{ status: 200 \}/g)?.length).toBe(2);
    expect(script).not.toMatch(/execute_sql|createClient|service_role/i);
  });

  it('asks for the switch to be released on every way out once it is engaged, and a thrown probe is a step, not a crash', () => {
    // The release prompt is the `finally`'s job after engagement, so a dropped
    // connection or a refused step cannot leave production switched off.
    expect(script).toMatch(/finally \{\s*if \(engaged && !released\)/);
    expect(script.match(/await release\(/g)?.length).toBe(2); // the normal path, and the finally
    expect(script).toMatch(/catch \(e\) \{[\s\S]*status: 0, message: `fetch failed/); // call() never throws
    expect(script).toMatch(/record\.verdict = !record\.error && record\.steps\.length === 3/); // a stopped drill is FAILED, and filed
  });

  it('is wired as npm run drill:killswitch', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'app/package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['drill:killswitch']).toBe('node scripts/killswitch-drill.mjs');
  });
});
