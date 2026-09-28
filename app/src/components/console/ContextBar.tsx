import { CONTEXT_BAR } from '../../lib/ops/console';
import { ENVIRONMENT_SHAPE, type Environment } from '../../lib/environment';
import type { Grant } from '../../lib/capabilities';
import { MFA_FRESH_MINUTES, mfaFresh, type MfaLevel, type SupportGrant } from '../../lib/console/client';
import { Fields, when } from './Fields';

export interface Context {
  env: Environment;
  scope: string;
  operator: string;
  grants: readonly Grant[];
  /** `null` while unread; a string when it could not be read. */
  mfa: MfaLevel | null | string;
  session: Date | null | string;
  support: SupportGrant[] | null | string;
  now: Date;
}

/** "capability at scope", one per live grant, so the role line is the grants and not a selector. */
export function grantsSaid(grants: readonly Grant[]): string {
  if (grants.length === 0) return 'No live grants';
  return [...new Set(grants.map((g) => `${g.capability} at ${g.scopeKind}${g.scopeId ? ` ${g.scopeId}` : ''}`))].sort().join(' · ');
}

/** "Fresh", or how long ago; a sensitive action asks again either way past the window. */
export function mfaSaid(mfa: MfaLevel | null | string, now: Date): string {
  if (mfa === null) return 'Reading…';
  if (typeof mfa === 'string') return mfa;
  if (mfa.currentLevel !== 'aal2') return `Not verified this session (${mfa.currentLevel ?? 'no level'}); a sensitive action will ask`;
  if (!mfa.verifiedAt) return 'Verified this session; time unknown, so a sensitive action will ask';
  const minutes = Math.max(0, Math.round((now.getTime() - mfa.verifiedAt.getTime()) / 60_000));
  return mfaFresh(mfa, now)
    ? `Fresh — verified ${minutes} min ago`
    : `Verified ${minutes} min ago; past ${MFA_FRESH_MINUTES} min, so a sensitive action will ask again`;
}

export function supportSaid(support: SupportGrant[] | null | string): string {
  if (support === null) return 'Reading…';
  if (typeof support === 'string') return support;
  if (support.length === 0) return 'None';
  return support.map((g) => `${g.student} · ${g.reason} · ends ${when(g.expiresAt)}`).join(' · ');
}

/**
 * The bar at the top of every console page, exactly the fields
 * `CONTEXT_BAR` names, in its order. The environment is a word and a shape;
 * the operator is the signed-in identity; the role is the grants.
 */
export function ContextBar({ context }: { context: Context }) {
  const value: Record<string, string> = {
    Environment: ENVIRONMENT_SHAPE[context.env],
    Scope: context.scope,
    Operator: context.operator,
    Role: grantsSaid(context.grants),
    MFA: mfaSaid(context.mfa, context.now),
    Session:
      context.session === null
        ? 'Reading…'
        : typeof context.session === 'string'
          ? context.session
          : `Expires ${when(context.session.toISOString())}`,
    'Support access': supportSaid(context.support),
  };
  return (
    <section aria-label="Context" className="portal-panel" style={{ marginBottom: 'var(--sp-5)' }}>
      <Fields label="Context bar" items={CONTEXT_BAR.map((f) => ({ field: f.field, value: value[f.field] ?? 'Not shown' }))} />
    </section>
  );
}
