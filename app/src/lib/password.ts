/**
 * The floor on a password somebody is *choosing*. One number, so the sign-up
 * form, the recovery dialog and the change-password form cannot drift apart
 * (the reset link used to land on Supabase's own page, which enforces a
 * different floor than this app's form). Kept out of `cloud.ts` so the forms
 * can read it without importing the account client.
 */
export const PASSWORD_FLOOR = 8;

/** Why a chosen password is refused, in words; null when it is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_FLOOR) return `Use at least ${PASSWORD_FLOOR} characters.`;
  return null;
}
