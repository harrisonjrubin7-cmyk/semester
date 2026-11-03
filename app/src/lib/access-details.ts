import type { Grant } from './capabilities';

/**
 * Why a protected place is open to the signed-in person, or closed to them.
 *
 * The role blueprint asks every protected page to answer "why can I see this?"
 * (§3.4). The answer comes from the grants the caller already holds, the
 * `my_capabilities` read the navigation uses, and it is matched the way the
 * database matches them: a grant opens a place only when both its capability
 * and its scope are the same (`private.has_capability` matches scope exactly,
 * so a platform grant does not open a school).
 *
 * This authorizes nothing. Row-level security checks each request again, and
 * the explanation says so. It also says what it cannot know: the read does not
 * carry the role's name or the date access ends. Showing those needs the read
 * itself to return them, which is a migration and not part of this file.
 */

export interface AccessScope {
  kind: string;
  id: string;
}

export interface AccessDetails {
  capability: string;
  scope: AccessScope;
  allowed: boolean;
  /** One line per grant that opens the place. Empty when it does not open. */
  because: string[];
  /** Places where the same capability is held, which do not open this one. */
  elsewhere: AccessScope[];
  /** What this explanation cannot tell the person. Always present. */
  limits: string[];
}

export const ACCESS_LIMITS: readonly string[] = [
  'This lists the permissions you hold for this place. It does not name your role or say when access ends.',
  'The server checks each request again. Seeing this explanation does not give you access.',
];

const sameScope = (a: AccessScope, b: AccessScope): boolean => a.kind === b.kind && a.id === b.id;

export function explainAccess(grants: readonly Grant[], capability: string, scope: AccessScope): AccessDetails {
  const held = capability === '' ? [] : grants.filter((g) => g.capability === capability);
  const opening = scope.id === '' ? [] : held.filter((g) => sameScope({ kind: g.scopeKind, id: g.scopeId }, scope));
  const others = held.filter((g) => !opening.includes(g));

  const because = opening.length > 0 ? [`You hold ${capability} for ${scope.kind} ${scope.id}.`] : [];
  const seen = new Set<string>();
  const elsewhere: AccessScope[] = [];
  for (const g of others) {
    const key = `${g.scopeKind}\u0000${g.scopeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    elsewhere.push({ kind: g.scopeKind, id: g.scopeId });
  }

  return {
    capability,
    scope,
    allowed: because.length > 0,
    because,
    elsewhere,
    limits: [...ACCESS_LIMITS],
  };
}
