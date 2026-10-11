import { cloud } from './cloud';

function message(error: { message?: string } | null, fallback: string): string {
  const said = error?.message?.trim();
  return said ? said : fallback;
}

/** Whether a live platform_admin or support_agent grant still needs this session elevated to aal2. */
export async function privilegedMfaRequired(): Promise<boolean> {
  const db = await cloud();
  const { data, error } = await db.rpc('privileged_mfa_required');
  if (error) throw new Error(message(error, 'Could not check whether this account needs a second factor.'));
  return data === true;
}

/** Recheck the privileged boundary when Auth replaces or elevates the current session. */
export async function watchMfaSession(onChange: () => void): Promise<() => void> {
  const db = await cloud();
  const { data } = db.auth.onAuthStateChange((event) => {
    if (event !== 'INITIAL_SESSION') onChange();
  });
  return () => data.subscription.unsubscribe();
}
