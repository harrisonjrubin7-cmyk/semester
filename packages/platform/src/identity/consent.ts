/**
 * Consent: a student's recorded, scoped, revocable, time-limited permission.
 *
 * The existing `ConsentGrant` (policy.ts) is what a rule *reads* for the
 * support-access and share cases. This is what is *stored*: who gave it, to
 * whom, for what purpose, over which scopes and which named resources, on what
 * evidence, until when — and what happened to it since. `toPolicyGrant` turns
 * a live record into the shape the decision point reads, so there is one
 * lifecycle and one reading of "live".
 *
 * ## Rules this file will not bend
 *
 * - A consent has a **purpose**, and a request is checked against it. Consent
 *   given to share an agenda is not consent to train a model.
 * - **Named resources**, not categories alone: `scopes` says what kind of thing,
 *   `resourceIds` says which ones. A category with no resources grants nothing
 *   (the rule `allowsFamilyRequest` already holds for family grants).
 * - **Withdrawal wins** and is immediate; there is no grace period on revoke.
 * - Where the law gives someone else the right to consent (a minor, a legal
 *   guardian) the `grantedBy` is that person and `onBehalfOfPersonId` is the
 *   student. Which cases those are is for counsel and the institution; this
 *   module records that it happened and who stood in.
 */

import type { ConsentGrant } from '../seam/institution.ts';

export const CONSENT_PURPOSES = [
  'support_access',
  'guardian_sharing',
  'advisor_sharing',
  'agenda_sharing',
  'ai_context',
  'marketing',
  'research',
  'career_sharing',
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_EVIDENCE = ['in_app_confirmation', 'signed_form', 'institution_attested', 'verbal_logged'] as const;
export type ConsentEvidence = (typeof CONSENT_EVIDENCE)[number];

export interface ConsentRecord {
  id: string;
  tenantId: string;
  /** The person whose data it concerns. */
  subjectPersonId: string;
  /** The person who gave it. Equal to the subject unless someone lawfully stood in. */
  grantedByPersonId: string;
  onBehalfOfPersonId?: string;
  granteePersonId: string;
  purpose: ConsentPurpose;
  scopes: string[];
  resourceIds: string[];
  evidence: ConsentEvidence;
  policyVersion: string;
  ticketId?: string;
  grantedAt: string;
  expiresAt: string;
  withdrawnAt?: string;
}

export function consentIsLive(c: ConsentRecord, nowMs: number): boolean {
  const granted = Date.parse(c.grantedAt);
  const expires = Date.parse(c.expiresAt);
  if (!Number.isFinite(granted) || !Number.isFinite(expires)) return false;
  if (c.withdrawnAt !== undefined) return false;
  if (granted > nowMs || expires <= nowMs) return false;
  if (c.granteePersonId === c.subjectPersonId) return false;
  return c.scopes.length > 0 && c.resourceIds.length > 0;
}

export interface ConsentQuery {
  tenantId: string;
  subjectPersonId: string;
  granteePersonId: string;
  purpose: ConsentPurpose;
  scope: string;
  resourceId: string;
}

/** The live consent that covers this exact request, or `undefined`. Tenant, purpose, scope and resource must all match. */
export function findCoveringConsent(all: readonly ConsentRecord[], q: ConsentQuery, nowMs: number): ConsentRecord | undefined {
  return all.find(
    (c) =>
      c.tenantId === q.tenantId &&
      c.subjectPersonId === q.subjectPersonId &&
      c.granteePersonId === q.granteePersonId &&
      c.purpose === q.purpose &&
      c.scopes.includes(q.scope) &&
      c.resourceIds.includes(q.resourceId) &&
      consentIsLive(c, nowMs),
  );
}

/** Withdraw, idempotently: a second withdrawal keeps the first timestamp. */
export function withdraw(c: ConsentRecord, at: string): ConsentRecord {
  return c.withdrawnAt === undefined ? { ...c, withdrawnAt: at } : c;
}

/** The shape the policy decision point reads, for the two kinds it knows. */
export function toPolicyGrant(c: ConsentRecord): ConsentGrant | null {
  const kind = c.purpose === 'support_access' ? 'support_access' : c.purpose.endsWith('_sharing') ? 'share' : null;
  if (!kind) return null;
  return {
    id: c.id,
    kind,
    grantedBy: c.grantedByPersonId,
    grantedTo: c.granteePersonId,
    scopes: [...c.scopes],
    ...(c.ticketId !== undefined ? { ticketId: c.ticketId } : {}),
    expiresAt: c.expiresAt,
    revokedAt: c.withdrawnAt ?? null,
  };
}
