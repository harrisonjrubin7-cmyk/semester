import { useEffect, useState } from 'react';
import { cloud, cloudConfigured } from './cloud';

/**
 * What the database says this person may do — for deciding what to offer.
 *
 * `public.my_capabilities()` returns the caller's own live grants, with the
 * predicate every policy uses. This turns them into the two shapes the screens
 * need. It **authorizes nothing**: each table's row-level security still
 * decides what a request reaches. A wrong answer here can only hide a screen
 * from somebody entitled to it, or show an empty one to somebody who is not —
 * never hand anybody data.
 */

export interface Grant {
  capability: string;
  scopeKind: string;
  scopeId: string;
}

export function readGrants(rows: unknown): Grant[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .filter((r) => typeof r.capability === 'string' && typeof r.scope_kind === 'string' && typeof r.scope_id === 'string')
    .map((r) => ({ capability: r.capability as string, scopeKind: r.scope_kind as string, scopeId: r.scope_id as string }));
}

/**
 * The capabilities this person holds over one school: granted over that school,
 * or over the platform. Other scopes — a course, an office, another school —
 * do not count here.
 */
export function forSchool(grants: readonly Grant[], school: string): string[] {
  return [
    ...new Set(
      grants
        .filter((g) => (g.scopeKind === 'school' && g.scopeId === school && school !== '') || g.scopeKind === 'platform')
        .map((g) => g.capability),
    ),
  ].sort();
}

export async function loadMyCapabilities(): Promise<Grant[]> {
  if (!cloudConfigured) return [];
  const db = await cloud();
  const { data: user } = await db.auth.getUser();
  if (!user.user?.id) return [];
  const { data, error } = await db.rpc('my_capabilities');
  if (error) return [];
  return readGrants(data);
}

/** The caller's grants, loaded once per mount. Empty until loaded, and on any failure. */
export function useMyCapabilities(): Grant[] {
  const [grants, setGrants] = useState<Grant[]>([]);
  useEffect(() => {
    let live = true;
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => {});
    return () => { live = false; };
  }, []);
  return grants;
}
