/**
 * Who is signed in, at which school, and what mode that school runs
 * assignments in.
 *
 * Assignments are a Core module (D-151): a school's assignments live in
 * Semester only once the school has switched `lms_assignments` to Core, and
 * until then they stay in its own system. So the screen's first question is
 * not a feature flag but the mode, read the way the database reads it
 * (`effective_module_modes`, through `lib/modulemode.ts`), and every doubt
 * answers Connect: a read that failed is never evidence that a school is in
 * Core.
 */
import { useCallback, useEffect, useState } from 'react';
import { cloud, cloudConfigured } from '../cloud';
import { claimedSchoolOrThrow } from '../schoolclaim';
import { useModuleMode, type ResolvedMode } from '../modulemode';

export type Identity =
  | { status: 'loading' }
  /** No account service in this build. */
  | { status: 'off' }
  | { status: 'signed_out' }
  | { status: 'no_school' }
  | { status: 'error'; message: string }
  | { status: 'ready'; school: string; userId: string };

/** Who is signed in and which school they claim. Pure of React so it can be tested alone. */
export async function readIdentity(): Promise<Identity> {
  if (!cloudConfigured) return { status: 'off' };
  try {
    const db = await cloud();
    const { data, error } = await db.auth.getUser();
    if (error && error.name !== 'AuthSessionMissingError') return { status: 'error', message: 'Could not check who is signed in.' };
    const userId = data.user?.id;
    if (!userId) return { status: 'signed_out' };
    let school: string;
    try {
      school = await claimedSchoolOrThrow();
    } catch {
      return { status: 'error', message: 'Could not read which school your account belongs to.' };
    }
    return school ? { status: 'ready', school, userId } : { status: 'no_school' };
  } catch {
    return { status: 'error', message: 'Could not reach your account.' };
  }
}

export type Access =
  | { status: 'loading' }
  | { status: 'off' }
  | { status: 'signed_out' }
  | { status: 'no_school' }
  | { status: 'error'; message: string }
  /** Ready, with the mode. `mode.mode === 'core'` is the only state that shows the module. */
  | { status: 'ready'; school: string; userId: string; mode: ResolvedMode };

export function useAssignmentsAccess(): Access & { retry: () => void } {
  const [identity, setIdentity] = useState<Identity>({ status: 'loading' });
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true;
    void readIdentity().then((i) => { if (live) setIdentity(i); });
    return () => { live = false; };
  }, [tries]);
  const retry = useCallback(() => {
    setIdentity({ status: 'loading' });
    setTries((n) => n + 1);
  }, []);
  // A hook cannot be conditional; with no school the mode reads Connect.
  const mode = useModuleMode('lms_assignments', identity.status === 'ready' ? identity.school : '');
  if (identity.status === 'ready') return { status: 'ready', school: identity.school, userId: identity.userId, mode, retry };
  if (identity.status === 'error') return { status: 'error', message: identity.message, retry };
  switch (identity.status) {
    case 'off':
      return { status: 'off', retry };
    case 'signed_out':
      return { status: 'signed_out', retry };
    case 'no_school':
      return { status: 'no_school', retry };
    default:
      return { status: 'loading', retry };
  }
}

/** What to tell somebody whose school is not running assignments in Semester, or who cannot write to it. */
export function modeSentence(mode: ResolvedMode): string | null {
  if (mode.mode === 'core' && !mode.frozen) return null;
  if (mode.source === 'kill-switch') {
    return 'Your school has paused its Core modules for now. What was submitted is kept and you can read it, but nothing can be changed until the pause is lifted.';
  }
  if (mode.frozen) {
    return 'Your school has taken assignments back out of Semester Core. What was submitted is kept and you can read it, but nothing can be changed here.';
  }
  if (mode.source === 'unavailable') {
    return 'Semester could not read how your school runs assignments, so it is treating them as still in your school’s own system. Try again in a moment.';
  }
  return 'Your school has not switched assignments to Semester Core, so its assignments and submissions are still in your school’s own system. Your own planner for work you type in yourself is unchanged.';
}
