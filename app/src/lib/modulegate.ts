import { useCallback, useEffect, useState } from 'react';
import { cloud, cloudConfigured } from './cloud';
import { narrowingAdmits, readNarrowing, type Narrowing } from './featurepolicy';
import { flagDefinition } from './flags';
import { claimedSchoolOrThrow } from './schoolclaim';
import { forSchool, loadMyCapabilitiesOrThrow } from './capabilities';

/**
 * Whether a writeback module is on for the caller's school, read the way the
 * database decides it.
 *
 * The registration ledger's gate (`private.registration_gate` in
 * `20260929300000_registration_transaction.sql`) is two questions, in this
 * order: is a kill switch that stops the flag engaged, for every school or for
 * this one; and is the school's `feature_state` for the flag exactly
 * `production`. Stopped outranks off. Since 20260929370000 it asks a third:
 * whether the flag's `permitted_roles` and `permitted_cohorts` admit the
 * caller (`private.feature_admits_caller`). The gradebook's passback gate asks
 * the first two about its own flag. This asks them through the same reads —
 * `public.feature_state`, `public.feature_kill_switch`, and the narrowing
 * through `lib/featurepolicy.ts` — so the screen and the server cannot
 * disagree about whether the school has it on for this caller.
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

/**
 * The whole decision, from what was read. Pure, so it can be held to the
 * server's order: stopped, then off, then narrowed. `narrowing` is required —
 * a caller that did not read the school's role and cohort limits cannot ask.
 */
export function decideGate(
  flag: string,
  read: { school: string; state: string | null; switches: readonly SwitchRow[]; narrowing: Narrowing; exempt?: boolean },
): 'on' | 'off' | { stopped: string } {
  const stoppers = flagDefinition(flag)?.killSwitches ?? ['kill.writeback'];
  const hit = read.switches.find(
    (s) => s.engaged && (s.tenant_id === null || s.tenant_id === read.school) && (stoppers as readonly string[]).includes(s.switch_key),
  );
  if (hit) return { stopped: hit.switch_key };
  if (read.state !== 'production') return 'off';
  return narrowingAdmits(read.narrowing) || read.exempt === true ? 'on' : 'off';
}

/**
 * `exemptCapability` mirrors a server gate that lets an office through a
 * narrowed pilot: `private.registration_gate` admits a holder of
 * `registration:administer` at the school whatever the role and cohort lists
 * say, so the registrar is never shown "not open to you" for a screen whose
 * writes the database would accept. It is read only when the narrowing
 * refuses, and a failed read is `error`, never a guess either way.
 */
export async function readModuleGate(flag: string, exemptCapability?: string): Promise<ModuleGate> {
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
  const [state, switches, narrowing] = await Promise.all([
    db.rpc('feature_state', { want_capability: flag, want_tenant: school }),
    db.from('feature_kill_switch').select('switch_key,tenant_id,engaged'),
    readNarrowing(db, flag, school).catch(() => null),
  ]);
  if (state.error || switches.error || !narrowing) {
    return { status: 'error', message: 'Could not read whether your school has this turned on.' };
  }
  let exempt = false;
  if (exemptCapability && !narrowingAdmits(narrowing)) {
    try {
      exempt = forSchool(await loadMyCapabilitiesOrThrow(), school).includes(exemptCapability);
    } catch {
      return { status: 'error', message: 'Could not check your staff permissions.' };
    }
  }
  const decided = decideGate(flag, {
    school,
    state: typeof state.data === 'string' ? state.data : null,
    switches: (switches.data ?? []) as SwitchRow[],
    narrowing,
    exempt,
  });
  if (decided === 'on') return { status: 'on', school, userId };
  if (decided === 'off') return { status: 'off' };
  return { status: 'stopped', switch: decided.stopped };
}

/** The gate for one flag, read once per mount, with a retry for the error state. */
export function useModuleGate(flag: string, exemptCapability?: string): ModuleGate & { retry: () => void } {
  const [gate, setGate] = useState<ModuleGate>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    readModuleGate(flag, exemptCapability).then(
      (g) => { if (live) setGate(g); },
      () => { if (live) setGate({ status: 'error', message: 'Could not read whether your school has this turned on.' }); },
    );
    return () => { live = false; };
  }, [flag, exemptCapability, attempt]);
  const retry = useCallback(() => {
    setGate({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { ...gate, retry };
}
