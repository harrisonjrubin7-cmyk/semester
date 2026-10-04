/**
 * API versioning: a major in the path, additive change inside it, and a
 * published lifecycle for retiring one.
 *
 * This is the rule `docs/target-architecture/07-ENGINEERING-STANDARDS.md` §1
 * proposes — *URL major (`v1`) + additive-only evolution inside a major;
 * breaking change ⇒ new major, old one supported ≥ 12 months (≥ 90 days for
 * first-party clients)* — made executable, so the platform and the pack do not
 * grow two conventions. (A first draft of this file used dated versions pinned
 * by a header; the pack's rule is simpler for an institution to reason about
 * and was already written, so this follows it.)
 *
 * Lifecycle: `current` → `supported` → `deprecated` (announced; `Deprecation`
 * and `Sunset` headers on every response) → `sunset` (refused with
 * `version_unsupported`, naming the major to move to). A major is never sunset
 * on less than the notice a registry entry's audience is owed, which
 * `registryProblems` checks — an institution's integration is not broken by a
 * date a developer chose on a Friday.
 */

import { PlatformError } from './errors.ts';
import { HEADERS } from './headers.ts';

export type MajorStatus = 'current' | 'supported' | 'deprecated' | 'sunset';

export interface ApiMajor {
  major: number;
  status: MajorStatus;
  /** When it was announced as deprecated (ISO date). */
  deprecatedAt?: string;
  /** When it stops working (ISO date). */
  sunsetAt?: string;
  /** Only Semester's own clients call it, so the shorter notice applies. */
  firstPartyOnly?: boolean;
  /** Repo path of the migration guide. */
  guide?: string;
}

/** Minimum notice between announcing deprecation and sunset. */
export const MIN_SUNSET_NOTICE_DAYS = 365;
export const MIN_FIRST_PARTY_NOTICE_DAYS = 90;

export const API_MAJORS: readonly ApiMajor[] = [{ major: 1, status: 'current' }];

/** `/v1/tasks` → 1. `null` when the path carries no major. */
export function majorOf(path: string): number | null {
  const m = /^\/v(\d{1,3})(?:\/|$)/.exec(path);
  return m ? Number(m[1]) : null;
}

export interface Negotiated {
  major: ApiMajor;
  headers: Record<string, string>;
}

export function negotiateMajor(path: string, registry: readonly ApiMajor[], nowMs: number): Negotiated {
  const current = registry.find((v) => v.status === 'current');
  if (!current) throw new PlatformError('internal', 'No API major is current.');
  const requested = majorOf(path);
  if (requested === null) throw new PlatformError('version_unsupported', `Requests need a version in the path, such as /v${current.major}/…`);
  const v = registry.find((x) => x.major === requested);
  if (!v) throw new PlatformError('version_unsupported', `API v${requested} is not known. The current version is v${current.major}.`);
  if (v.status === 'sunset' || (v.sunsetAt !== undefined && Date.parse(v.sunsetAt) <= nowMs)) {
    throw new PlatformError('version_unsupported', `API v${requested} has been retired. Move to v${current.major}.`);
  }
  const headers: Record<string, string> = {};
  if (v.status === 'deprecated') {
    headers[HEADERS.deprecation] = v.deprecatedAt ?? 'true';
    if (v.sunsetAt) headers[HEADERS.sunset] = new Date(v.sunsetAt).toUTCString();
  }
  return { major: v, headers };
}

/** Problems with a registry itself: used by the architecture test, and callable by a release check. */
export function registryProblems(registry: readonly ApiMajor[]): string[] {
  const out: string[] = [];
  if (registry.filter((v) => v.status === 'current').length !== 1) out.push('exactly one major must be current');
  const seen = new Set<number>();
  for (const v of registry) {
    if (!Number.isInteger(v.major) || v.major < 1) out.push(`v${v.major}: not a major`);
    if (seen.has(v.major)) out.push(`v${v.major}: listed twice`);
    seen.add(v.major);
    if (v.status === 'deprecated') {
      const need = v.firstPartyOnly ? MIN_FIRST_PARTY_NOTICE_DAYS : MIN_SUNSET_NOTICE_DAYS;
      if (!v.deprecatedAt || !v.sunsetAt) out.push(`v${v.major}: deprecated without both dates`);
      else if (Date.parse(v.sunsetAt) - Date.parse(v.deprecatedAt) < need * 86_400_000) {
        out.push(`v${v.major}: less than ${need} days between deprecation and sunset`);
      }
    }
  }
  return out;
}
