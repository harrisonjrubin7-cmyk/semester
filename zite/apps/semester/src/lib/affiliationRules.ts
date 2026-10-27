// Independent learner and affiliation (S-76 E28). One person, one account: a personal workspace and any institution
// memberships hang off the same user id. Exactly one membership is "current" per request, chosen on the server by
// pickMembership(); the client never names the tenant. Private work stays in the tenant it was made in, so joining an
// institution moves nothing and shows the institution nothing from the personal workspace.
export type ActiveMembership = { id: string; personal: boolean; sample: boolean };

/** The member's stored choice if it is still active; otherwise an institution over a personal or sample workspace; ties by id. */
export function pickMembership(active: ActiveMembership[], preferred: string | null): ActiveMembership | null {
  if (!active.length) return null;
  const pref = preferred ? active.find((m) => m.id === preferred) : undefined;
  if (pref) return pref;
  const rank = (m: ActiveMembership) => (m.personal ? 2 : m.sample ? 1 : 0);
  return [...active].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))[0];
}

/** Why a join request is refused, or null. Administrator access is never self-requested. */
export function joinBlocker(p: { role: string; alreadyThere: 'none' | 'Active' | 'Pending' | 'Suspended' | string }): string | null {
  if (p.role === 'Administrator') return 'Administrator access is granted by an existing administrator, not requested.';
  if (p.alreadyThere === 'Active') return 'You are already a member there. Switch to it instead.';
  if (p.alreadyThere === 'Pending') return 'Your request to join is already waiting for approval.';
  if (p.alreadyThere === 'Suspended') return 'Your membership there is suspended. Contact the institution.';
  return null;
}
