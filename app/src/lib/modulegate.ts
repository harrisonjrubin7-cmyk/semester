import { useCallback, useEffect, useState } from 'react';
import { cloud, cloudConfigured } from './cloud';
import { flagDefinition } from './flags';
import { claimedSchoolOrThrow } from './schoolclaim';

/**
 * Whether a writeback module is on for the caller's school, read the way the
 * database decides it.
 *
 * The registration ledger's gate (`private.registration_gate` in
 * `20260929300000_registration_transaction.sql`) is two questions, in this
 * order: is a kill switch that stops the flag engaged, for every school or for
 * this one; and is the school's `feature_state` for the flag exactly
 * `production`. Stopped outranks off. The gradebook's passback gate asks the
 * same two about its own flag. This asks them through the same two reads —
 * `public.feature_state` and `public.feature_kill_switch` — so the screen and
 * the server cannot disagree about whether the school has it on.
 *
 * It **authorizes nothing**. Every write is checked again by the database,
 * which refuses with `flag_off` or `kill_switch` whatever this said. A wrong
 * answer here can only show a screen whose writes are then refused, or hide
 * one — never write anything.
 *
 * What it does not do is run `evaluateFlag` whole. That evaluator also wants
 * an approved SIS connection and scopes before a writeback flag counts as on,
 * which is right for the adapter that would send a change on to the school's
 * own system — and that adapter is not built. The ledger in Semester is what
 * these screens drive, and the ledger's gate is the two reads above.
 *
 * Reading fails loudly. A dropped request is `error`, never `off`: "your
 * school has not turned this on" is a claim about the school, and a lost
 * packet is not evidence about the school.
 */

export type ModuleGate =
  /** Still reading. */
  | { status: 'loading' }
  /** No account service in this build, or the school has not set the flag to production. */
  | { status: 'off' }
  /** A kill switch that stops this flag is engaged. */
  | { status: 'stopped'; switch: string }
  /** Nobody is signed in. */
  | { status: 'signed_out' }
  /** Signed in, with no school claimed. */
  | { status: 'no_school' }
  /** The reads failed; `message` says what. */
  | { status: 'error'; message: string }
  | { status: 'on'; school: string; userId: string };

interface SwitchRow {
  switch_key: string;
  tenant_id: string | null;
  engaged: boolean;
}

/** The whole decision, from what was read. Pure, so it can be held to the server's order. */
export function decideGate(
  flag: string,
  read: { school: string; state: string | null; switches: readonly SwitchRow[] },
): 'on' | 'off' | { stopped: string } {
  const stoppers = flagDefinition(flag)?.killSwitches ?? ['kill.writeback'];
  const hit = read.switches.find(
    (s) => s.engaged && (s.tenant_id === null || s.tenant_id === read.school) && (stoppers as readonly string[]).includes(s.switch_key),
  );
  if (hit) return { stopped: hit.switch_key };
  return read.state === 'production' ? 'on' : 'off';
}

export async function readModuleGate(flag: string): Promise<ModuleGate> {
  if (!cloudConfigured) return { status: 'off' };
  const db = await cloud();
  const { data: who, error: whoError } = await db.auth.getUser();
  if (whoError && whoError.name !== 'AuthSessionMissingError') {
    return { status: 'error', message: 'Could not check who is signed in.' };
  }
  const userId = who.user?.id;
  if (!userId) return { status: 'signed_out' };
  let school: string;
  try {
    school = await claimedSchoolOrThrow();
  } catch {
    return { status: 'error', message: 'Could not read which school your account belongs to.' };
  }
  if (!school) return { status: 'no_school' };
  const [state, switches] = await Promise.all([
    db.rpc('feature_state', { want_capability: flag, want_tenant: school }),
    db.from('feature_kill_switch').select('switch_key,tenant_id,engaged'),
  ]);
  if (state.error || switches.error) {
    return { status: 'error', message: 'Could not read whether your school has this turned on.' };
  }
  const decided = decideGate(flag, {
    school,
    state: typeof state.data === 'string' ? state.data : null,
    switches: (switches.data ?? []) as SwitchRow[],
  });
  if (decided === 'on') return { status: 'on', school, userId };
  if (decided === 'off') return { status: 'off' };
  return { status: 'stopped', switch: decided.stopped };
}

/** The gate for one flag, read once per mount, with a retry for the error state. */
export function useModuleGate(flag: string): ModuleGate & { retry: () => void } {
  const [gate, setGate] = useState<ModuleGate>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    readModuleGate(flag).then(
      (g) => { if (live) setGate(g); },
      () => { if (live) setGate({ status: 'error', message: 'Could not read whether your school has this turned on.' }); },
    );
    return () => { live = false; };
  }, [flag, attempt]);
  const retry = useCallback(() => {
    setGate({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { ...gate, retry };
}
