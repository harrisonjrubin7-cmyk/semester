import { finite, isoDay, obj, textValue } from './device-library';
import { FAMILY_CATEGORIES, type FamilyAccess, type FamilyCategory } from '@semester/institution';

export { FAMILY_CATEGORIES };
export type { FamilyAccess, FamilyCategory };

/**
 * A plan for what somebody else may see. It grants nothing.
 *
 * That sentence is the whole module, and it is worth being blunt about why.
 * The obvious way to build "let my parent see the bill" is to hand the parent
 * a login that can read the account. The account is everything: the grades,
 * the health administration, the calendar that says where somebody is at nine
 * on a Tuesday. A student who wanted one thing shared has shared their life.
 *
 * So nothing here is an account and nothing here is access. A `FamilyMember`
 * is a name and a set of intentions; a `FamilyItem` is one thing the student
 * has chosen to include. What a real recipient could actually read lives on a
 * server, as a `FamilyGrant` in `@semester/institution`, is checked per
 * operation by `allowsFamilyRequest`, and does not exist until the recipient
 * has accepted it. This side is preparation for that, and the screen says so.
 *
 * `familyPreview` is the honest expression of it: a *preview*, computed here,
 * over items the student typed here. It reaches no store, no inbox, no file
 * and no location.
 */

export const FAMILY_LABELS: Record<FamilyCategory, string> = {
  finances: 'Bills & payments',
  aid: 'Financial aid requirements',
  housing: 'Housing & move-in',
  calendar: 'Selected calendar events',
  academic: 'Selected academic summary',
  emergency: 'Public campus information',
  travel: 'Shared travel plans',
  'health-admin': 'Health administration only',
  career: 'Career support',
  communication: 'Support requests & check-ins',
};

export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  relationship: string;
  /** `YYYY-MM-DD`, or empty for no expiry. Compared as a string — see `familyPlanActive`. */
  expires: string;
  revoked: boolean;
  permissions: Record<FamilyCategory, FamilyAccess>;
}

export interface FamilyItem {
  id: string;
  memberId: string;
  category: FamilyCategory;
  title: string;
  body: string;
  due: string;
  kind: 'information' | 'request' | 'checklist' | 'budget';
  done: boolean;
  amount: number;
}

export interface FamilyLibrary {
  version: 1;
  members: FamilyMember[];
  items: FamilyItem[];
  /** What the student did, on this device. Not an audit log — see `readFamily`. */
  history: { id: string; at: number; memberId: string; message: string }[];
}

export const EMPTY_FAMILY: FamilyLibrary = { version: 1, members: [], items: [], history: [] };

export const FAMILY_ITEM_KINDS = ['information', 'request', 'checklist', 'budget'] as const;

export const FAMILY_LIMITS = {
  members: 20,
  items: 500,
  history: 500,
  name: 160,
  email: 254,
  title: 180,
  body: 8000,
  amount: 10_000_000,
} as const;

export const newFamilyMember = (): FamilyMember => ({
  id: crypto.randomUUID(),
  name: '',
  email: '',
  relationship: 'Family member',
  expires: '',
  revoked: false,
  // Everything off. A new plan that started with anything on would be a plan
  // somebody could save without ever having chosen what is in it.
  permissions: Object.fromEntries(FAMILY_CATEGORIES.map((c) => [c, 'none'])) as FamilyMember['permissions'],
});

export const newFamilyItem = (memberId: string): FamilyItem => ({
  id: crypto.randomUUID(),
  memberId,
  category: 'communication',
  title: '',
  body: '',
  due: '',
  kind: 'information',
  done: false,
  amount: 0,
});

/**
 * A family library out of storage or a file, or an error.
 *
 * Rebuilt field by field rather than returned as-is. Every other reader in
 * this app can hand back the value it validated; this one must not, because
 * an extra key on a permissions object is exactly the shape of a smuggled
 * grant. What comes out has the ten categories and nothing else.
 *
 * The other rule worth naming: an item must belong to a member that exists.
 * An orphaned item is one the student cannot see to delete and the preview
 * cannot attribute — and if a member were ever re-created with a reused id, it
 * would attach itself to them.
 */
export function readFamily(v: unknown): FamilyLibrary {
  if (
    !obj(v) ||
    v.version !== 1 ||
    !Array.isArray(v.members) ||
    v.members.length > FAMILY_LIMITS.members ||
    !Array.isArray(v.items) ||
    v.items.length > FAMILY_LIMITS.items ||
    !Array.isArray(v.history) ||
    v.history.length > FAMILY_LIMITS.history
  ) {
    throw new Error('Invalid family planning backup.');
  }

  const ids = new Set<string>();
  const members = v.members.map((m: unknown) => {
    const shaped =
      obj(m) &&
      textValue(m.id, 100) &&
      !!m.id &&
      !ids.has(m.id) &&
      textValue(m.name, FAMILY_LIMITS.name) &&
      !!(m.name as string).trim() &&
      textValue(m.email, FAMILY_LIMITS.email) &&
      textValue(m.relationship, 100) &&
      isoDay(m.expires) &&
      typeof m.revoked === 'boolean' &&
      obj(m.permissions);
    if (!shaped) throw new Error('Check the family member’s name, date and permission choices.');

    const mm = m as unknown as FamilyMember & { permissions: Record<string, unknown> };
    if (mm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mm.email)) {
      throw new Error('Enter a valid email or leave it blank.');
    }

    /*
     * `payment` is only ever offered on finances.
     *
     * It is the one access that is not a level of reading — it lets somebody
     * pay and read nothing. Accepting it on `academic` would create a value
     * the server rule has no branch for, and an access level nothing checks is
     * the kind of thing that later gets treated as "at least view".
     */
    const bad = FAMILY_CATEGORIES.some((c) => {
      const allowed = c === 'finances' ? ['none', 'selected', 'view', 'payment'] : ['none', 'selected', 'view'];
      return !allowed.includes(String(mm.permissions[c]));
    });
    if (bad) throw new Error('Invalid family permission.');

    ids.add(mm.id);
    return {
      id: mm.id,
      name: mm.name,
      email: mm.email,
      relationship: mm.relationship,
      expires: mm.expires,
      revoked: mm.revoked,
      permissions: Object.fromEntries(
        FAMILY_CATEGORIES.map((c) => [c, mm.permissions[c]]),
      ) as FamilyMember['permissions'],
    };
  });

  const seen = new Set<string>();
  const items = v.items.map((i: unknown) => {
    const shaped =
      obj(i) &&
      textValue(i.id, 100) &&
      !!i.id &&
      !seen.has(i.id) &&
      textValue(i.memberId, 100) &&
      ids.has(i.memberId as string) &&
      FAMILY_CATEGORIES.includes(i.category as FamilyCategory) &&
      textValue(i.title, FAMILY_LIMITS.title) &&
      !!(i.title as string).trim() &&
      textValue(i.body, FAMILY_LIMITS.body) &&
      isoDay(i.due) &&
      FAMILY_ITEM_KINDS.includes(i.kind as FamilyItem['kind']) &&
      typeof i.done === 'boolean' &&
      finite(i.amount, 0, FAMILY_LIMITS.amount);
    if (!shaped) throw new Error('Check the selected family item and its date.');
    const ii = i as unknown as FamilyItem;
    seen.add(ii.id);
    return {
      id: ii.id,
      memberId: ii.memberId,
      category: ii.category,
      title: ii.title,
      body: ii.body,
      due: ii.due,
      kind: ii.kind,
      done: ii.done,
      amount: ii.amount,
    };
  });

  const history = v.history.map((h: unknown) => {
    if (!obj(h) || !textValue(h.id, 100) || !finite(h.at, 0, 1e15) || !textValue(h.memberId, 100) || !textValue(h.message, 500)) {
      throw new Error('Invalid local history.');
    }
    const hh = h as unknown as FamilyLibrary['history'][number];
    return { id: hh.id, at: hh.at, memberId: hh.memberId, message: hh.message };
  });

  return { version: 1, members, items, history };
}

/**
 * Whether a plan is live today.
 *
 * String comparison on `YYYY-MM-DD`, and `en-CA` because it is the locale that
 * formats a date in exactly that shape. Comparing dates as strings is usually
 * a smell; here it is the point — it compares *calendar days in the reader's
 * own timezone*, so a plan that expires today is live until the day turns
 * wherever the student is, not at some UTC instant in the middle of it.
 */
export function familyPlanActive(m: FamilyMember, day = new Date().toLocaleDateString('en-CA')): boolean {
  return !m.revoked && (!m.expires || m.expires >= day);
}

/**
 * What this member would see, if any of this were real.
 *
 * Preview only. It reads the items the student typed on this screen and
 * nothing else: no academic store, no inbox, no files, no live location. A
 * revoked or expired plan previews as empty, which is the behaviour worth
 * being able to demonstrate to somebody before they agree to anything.
 *
 * `payment` is deliberately absent from the filter. A payer sees nothing.
 */
export function familyPreview(library: FamilyLibrary, memberId: string, day?: string): FamilyItem[] {
  const m = library.members.find((x) => x.id === memberId);
  if (!m || !familyPlanActive(m, day)) return [];
  return library.items.filter(
    (i) => i.memberId === m.id && ['selected', 'view'].includes(m.permissions[i.category]),
  );
}

/** A line in the local record of what the student changed. Newest first, capped. */
export function familyHistory(lib: FamilyLibrary, memberId: string, message: string): FamilyLibrary {
  return {
    ...lib,
    history: [{ id: crypto.randomUUID(), at: Date.now(), memberId, message }, ...lib.history].slice(
      0,
      FAMILY_LIMITS.history,
    ),
  };
}
