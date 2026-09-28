/**
 * The AI kill switch, read the same way by everything that generates.
 *
 * `public.feature_kill_switch` has held a `kill.ai_generation` row since the
 * integration control plane landed, the flag registry names it as the
 * rollback for every AI feature, and the integration worker already stops on
 * its own switch (`app/server/integration/worker.ts` `killed()`). What was
 * missing was the check: nothing that actually called a model asked. A switch
 * nobody reads is a note in a register, not a control.
 *
 * Two rules, copied from the worker rather than reinvented:
 *
 *  - **A switch that cannot be read is thrown.** If the table is unreachable
 *    the answer is "engaged". The switch exists for the moment something has
 *    gone wrong, and that is the moment a read is likeliest to fail.
 *  - **The global row wins, and the school's row reaches only its school.**
 *    A null `tenant_id` is every tenant; a set one is that tenant alone.
 *
 * The decision is in `engagedFrom`, a pure function over rows, so the app's
 * test suite can hold it (`app/src/lib/aikillswitch.test.ts`) without a
 * database; `aiGenerationKilled` is the one line of I/O around it.
 */

export const AI_GENERATION = 'kill.ai_generation';

/** Said to the caller when the switch is engaged. One sentence, no blame. */
export const KILLED_MESSAGE =
  'AI generation is switched off right now. Everything else in Semester still works, and nothing you typed has been lost.';

export interface SwitchRow {
  switch_key: string;
  tenant_id: string | null;
  engaged: boolean;
}

/**
 * Whether the switch is engaged for `tenant`, given what the table said.
 *
 * `rows` is what a read for the one switch returned; `error` is whether the
 * read failed. `tenant` is null for a caller with no school — the shared key
 * serves individual accounts — and such a caller is stopped by the global row
 * only.
 */
export function engagedFrom(rows: readonly SwitchRow[] | null, error: boolean, tenant: string | null): boolean {
  if (error) return true;
  return (rows ?? []).some(
    (k) => k.switch_key === AI_GENERATION && k.engaged && (k.tenant_id === null || (tenant !== null && k.tenant_id === tenant)),
  );
}

/** The narrowest shape of a Supabase client this needs, so tests can hand one in. */
export interface SwitchReader {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): PromiseLike<{ data: unknown; error: unknown }>;
    };
  };
}

export async function aiGenerationKilled(db: SwitchReader, tenant: string | null): Promise<boolean> {
  try {
    const { data, error } = await db.from('feature_kill_switch').select('switch_key,tenant_id,engaged').eq('switch_key', AI_GENERATION);
    return engagedFrom(Array.isArray(data) ? (data as SwitchRow[]) : null, !!error, tenant);
  } catch {
    return true;
  }
}
