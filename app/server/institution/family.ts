import {
  FAMILY_CATEGORIES,
  Refusal,
  allowsFamilyRequest,
} from '../../../packages/institution/src/index.ts';
import type {
  ActionInput,
  FamilyAccess,
  FamilyCategory,
  FamilyGrant,
  Receipt,
  UniversityRecord,
} from '../../../packages/institution/src/index.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import {
  SANDBOX_INSTITUTION,
  SANDBOX_MARK,
  already,
  connection,
  isStudent,
  matching,
  page,
  type SandboxStore,
} from './sandbox.ts';

/**
 * Authorized family access, against the sandbox, as a labelled demonstration.
 *
 * Phase 3's third domain. The brief's target end-state is *"verified,
 * revocable parent/guardian accounts with real access and payment
 * visibility"*, and almost all of the thinking was already done: the contract
 * in `packages/institution` carries `FamilyGrant`, `FamilyRequest` and
 * `allowsFamilyRequest`, and says exactly what was missing —
 *
 *   "A real grant lives in verified server storage, and every resource
 *    operation is checked against it… A permission object that arrived from a
 *    browser is a request, never an authority."
 *
 * The storage is what this adds, and the lifecycle around it: a student makes
 * a grant, the person it names accepts it, and the student can revoke it at
 * any moment. Until it is accepted it grants nothing; after it is revoked it
 * grants nothing; and nothing it grants is ever read from a request.
 *
 * ## The asymmetry is the feature, and it is the contract's
 *
 * `allowsFamilyRequest` makes `payment` not a level of reading:
 *
 *   "Paying requires `finances` *and* `payment` exactly. Reading requires
 *    `selected` or `view` — which `payment` is not, so **payment-only access
 *    discloses nothing**."
 *
 * So a parent who can pay the tuition bill **cannot read it** — not the
 * balance, not the history, not the aid. That is unusual and it is right: the
 * common real-world arrangement is a parent who pays and a student whose
 * record stays theirs. This adapter refuses the read rather than softening it,
 * and `family.test.ts` asserts the refusal from both directions.
 *
 * ## Four things a grant is not
 *
 * Not an account — the recipient is identified by whoever the institution
 * verified, never by an email typed into a box here. Not permanent — every
 * grant has an expiry and the screen shows it. Not silent — the student sees
 * every grant they have made and every one that is live. And not a category:
 * a category with no resources named grants nothing, which the contract
 * enforces and a test here checks.
 */

/** A grant as either side reads it. */
function grantRecord(g: FamilyGrant, mine: boolean, now: number): UniversityRecord {
  const state = g.revokedAt
    ? 'Revoked'
    : g.acceptedAt === null
      ? 'Invited — not yet accepted'
      : g.expiresAt <= now
        ? 'Expired'
        : 'Live';
  const when = (at: number | null) => (at ? new Date(at).toISOString().slice(0, 16).replace('T', ' ') : '—');

  return {
    id: g.id,
    area: 'family',
    title: `${SANDBOX_MARK} · ${g.category} — ${mine ? g.recipientId : g.studentId}`,
    summary: `${g.access} access to ${g.resourceIds.length} item${g.resourceIds.length === 1 ? '' : 's'}`,
    status: state,
    version: `${g.acceptedAt ?? 0}:${g.revokedAt ?? 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: mine ? 'Given to' : 'Given by', value: mine ? g.recipientId : g.studentId },
      { label: 'Category', value: g.category },
      { label: 'Access', value: g.access },
      { label: 'The items named', value: g.resourceIds.join(', ') || 'none — and a category alone grants nothing' },
      { label: 'Accepted', value: when(g.acceptedAt) },
      { label: 'Expires', value: when(g.expiresAt) },
      ...(g.revokedAt ? [{ label: 'Revoked', value: when(g.revokedAt) }] : []),
      {
        label: 'What this does not do',
        value:
          g.access === 'payment'
            ? 'Payment access lets them pay and read nothing — not the balance, not the history, not the aid.'
            : 'It covers only the items named above, and only until it expires or is revoked.',
      },
    ],
    dates: g.revokedAt ? undefined : [{ at: new Date(g.expiresAt).toISOString(), what: `Family access to ${g.category} expires` }],
    actions: g.revokedAt
      ? []
      : mine
        ? [{ id: 'revoke', label: 'Revoke this access', fields: [] }]
        : g.acceptedAt === null
          ? [
              { id: 'accept', label: 'Accept this access', fields: [] },
              { id: 'decline', label: 'Decline it', fields: [] },
            ]
          : [{ id: 'hand-back', label: 'Give this access back', fields: [] }],
  };
}

const commitGrant = (
  store: SandboxStore,
  row: FamilyGrant,
  key: string,
  what: string,
  at: string,
  change: (g: FamilyGrant) => void,
): Receipt => {
  change(row);
  store.saveGrant(row);
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message: `${SANDBOX_MARK} · ${what}. No real family account was changed.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
};

/** The fields an invite carries, read strictly. */
function readInvite(fields: Record<string, string>, now: number): {
  recipientId: string;
  category: FamilyCategory;
  access: FamilyAccess;
  resourceIds: string[];
  expiresAt: number;
} {
  const recipientId = (fields.recipient ?? '').trim();
  if (!recipientId) throw new Refusal('Name the person this is for.');

  const category = (fields.category ?? '').trim() as FamilyCategory;
  if (!FAMILY_CATEGORIES.includes(category)) {
    throw new Refusal(`Choose one of: ${FAMILY_CATEGORIES.join(', ')}.`);
  }

  const access = (fields.access ?? '').trim() as FamilyAccess;
  if (!['selected', 'view', 'payment'].includes(access)) {
    throw new Refusal('Access must be selected, view or payment. "none" is not a grant.');
  }
  if (access === 'payment' && category !== 'finances') {
    // The contract refuses this at the point of use; refusing it here means
    // the student is told when they make it rather than when it silently
    // fails to work.
    throw new Refusal('Payment access only means anything on finances.');
  }

  const resourceIds = (fields.items ?? '')
    .split(/[\n,]/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (!resourceIds.length) {
    throw new Refusal('Name the specific things this covers. A category on its own grants nothing.');
  }

  const days = Number((fields.days ?? '').trim());
  if (!Number.isFinite(days) || days < 1 || days > 400) {
    throw new Refusal('Say how many days this lasts, between 1 and 400. Access without an end is not a grant.');
  }

  return { recipientId, category, access, resourceIds, expiresAt: now + days * 86_400_000 };
}

/**
 * Whether this person may do this to this thing, right now.
 *
 * The single question every other domain asks before letting a family member
 * near anything. It is `allowsFamilyRequest` over the grants in storage —
 * never over anything the caller sent — and it is exported because billing
 * calls it and no second copy of this logic should exist.
 */
export function familyMay(
  store: SandboxStore,
  recipientId: string,
  studentId: string,
  category: FamilyCategory,
  resourceId: string,
  operation: 'read' | 'pay',
  now = Date.now(),
): boolean {
  return store
    .grantsTo(recipientId)
    .some((g) =>
      allowsFamilyRequest(
        g,
        { institutionId: SANDBOX_INSTITUTION, studentId, recipientId, category, resourceId, operation },
        now,
      ),
    );
}

export function familyAdapter(store: SandboxStore, clock: () => Date = () => new Date()): InstitutionAdapter {
  const own = (context: AdapterContext, id: string): { grant: FamilyGrant; mine: boolean } => {
    const grant = store.grant(id);
    if (!grant) throw new Refusal('No such family access in the sandbox.');
    const me = context.identity.userId;
    if (grant.studentId === me) return { grant, mine: true };
    if (grant.recipientId === me) return { grant, mine: false };
    // Neither side of it. A grant is between two people and nobody else.
    throw new Refusal('That is not yours to see.');
  };

  const adapter: InstitutionAdapter = {
    area: 'family',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('family', context, true),
    list: async (context, query) => {
      const me = context.identity.userId;
      const now = clock().getTime();
      const records = [
        ...store.grantsBy(me).map((g) => grantRecord(g, true, now)),
        ...store.grantsTo(me).map((g) => grantRecord(g, false, now)),
      ];
      return page(matching(records, query.search));
    },
    get: async (context, id) => {
      const grant = store.grant(id);
      if (!grant) return null;
      const me = context.identity.userId;
      if (grant.studentId !== me && grant.recipientId !== me) return null;
      return grantRecord(grant, grant.studentId === me, clock().getTime());
    },
    review: async (context, input) => {
      const now = clock().getTime();

      if (input.actionId === 'invite') {
        if (!isStudent(context)) throw new Refusal('Only the student can give access to their own record.');
        const asked = readInvite(input.fields, now);
        if (asked.recipientId === context.identity.userId) {
          throw new Refusal('You already have your own record.');
        }
        return {
          title: `Give ${asked.recipientId} ${asked.access} access to ${asked.category}`,
          details: [
            { label: 'Person', value: asked.recipientId },
            { label: 'Category', value: asked.category },
            { label: 'Access', value: asked.access },
            { label: 'The items named', value: asked.resourceIds.join(', ') },
            { label: 'Expires', value: new Date(asked.expiresAt).toISOString().slice(0, 10) },
            {
              label: 'They must accept it',
              value: 'Nothing is shared until they do, and you can revoke it at any moment.',
            },
            ...(asked.access === 'payment'
              ? [
                  {
                    label: 'What payment access is',
                    value: 'They can pay, and read nothing — not the balance, not the history, not the aid.',
                  },
                ]
              : []),
          ],
        };
      }

      const { grant, mine } = own(context, input.recordId);
      if (grant.revokedAt) throw new Refusal('That access has already been revoked.');

      if (input.actionId === 'revoke') {
        if (!mine) throw new Refusal('Only the student who gave this access can revoke it.');
        return {
          title: 'Revoke this access',
          details: [
            { label: 'Person', value: grant.recipientId },
            { label: 'Covers', value: `${grant.access} access to ${grant.category}` },
            { label: 'After this', value: 'It stops at once. They are not asked.' },
          ],
        };
      }
      if (input.actionId === 'hand-back') {
        if (mine) throw new Refusal('That is yours to revoke, not to hand back.');
        return {
          title: 'Give this access back',
          details: [
            { label: 'Given by', value: grant.studentId },
            { label: 'After this', value: 'It stops at once, and the student is not asked.' },
          ],
        };
      }
      if (input.actionId === 'accept' || input.actionId === 'decline') {
        if (mine) throw new Refusal('That is yours to give, not to accept.');
        if (grant.acceptedAt !== null) throw new Refusal('You have already accepted this.');
        if (grant.expiresAt <= now) throw new Refusal('That access expired before it was accepted.');
        return {
          title: input.actionId === 'accept' ? 'Accept this access' : 'Decline it',
          details: [
            { label: 'Given by', value: grant.studentId },
            { label: 'Covers', value: `${grant.access} access to ${grant.category}` },
            { label: 'The items named', value: grant.resourceIds.join(', ') },
            {
              label: 'After this',
              value:
                input.actionId === 'accept'
                  ? 'You can use it until it expires, unless it is revoked first.'
                  : 'It is gone. The student can offer it again.',
            },
          ],
        };
      }
      throw new Refusal('That is not something you can do to a family access.');
    },
    execute: async (context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;
      const at = clock();
      const now = at.getTime();
      const when = at.toISOString();

      if (input.actionId === 'invite') {
        if (!isStudent(context)) throw new Refusal('Only the student can give access to their own record.');
        const asked = readInvite(input.fields, now);
        if (asked.recipientId === context.identity.userId) throw new Refusal('You already have your own record.');
        const grant: FamilyGrant = {
          id: `${context.identity.userId}::${asked.recipientId}::${asked.category}::${now}`,
          institutionId: SANDBOX_INSTITUTION,
          studentId: context.identity.userId,
          recipientId: asked.recipientId,
          category: asked.category,
          access: asked.access,
          resourceIds: asked.resourceIds,
          /* Not accepted. A grant nobody accepted is not one. */
          acceptedAt: null,
          expiresAt: asked.expiresAt,
          revokedAt: null,
        };
        return commitGrant(store, grant, key, `Offered ${asked.access} access to ${asked.category}`, when, () => {});
      }

      const { grant, mine } = own(context, input.recordId);
      if (grant.revokedAt) throw new Refusal('That access has already been revoked.');

      if (input.actionId === 'revoke') {
        if (!mine) throw new Refusal('Only the student who gave this access can revoke it.');
        return commitGrant(store, grant, key, 'Revoked family access', when, (g) => {
          g.revokedAt = now;
        });
      }
      if (input.actionId === 'hand-back') {
        if (mine) throw new Refusal('That is yours to revoke, not to hand back.');
        return commitGrant(store, grant, key, 'Gave family access back', when, (g) => {
          g.revokedAt = now;
        });
      }
      if (input.actionId === 'accept') {
        if (mine) throw new Refusal('That is yours to give, not to accept.');
        if (grant.acceptedAt !== null) throw new Refusal('You have already accepted this.');
        if (grant.expiresAt <= now) throw new Refusal('That access expired before it was accepted.');
        return commitGrant(store, grant, key, 'Accepted family access', when, (g) => {
          g.acceptedAt = now;
        });
      }
      if (input.actionId === 'decline') {
        if (mine) throw new Refusal('That is yours to give, not to accept.');
        if (grant.acceptedAt !== null) throw new Refusal('You have already accepted this.');
        return commitGrant(store, grant, key, 'Declined family access', when, (g) => {
          g.revokedAt = now;
        });
      }
      throw new Refusal('That is not something you can do to a family access.');
    },
    reconcile: async (_context: AdapterContext, _input: ActionInput, key: string) => store.receipt(key),
  };
  return adapter;
}
